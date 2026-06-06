import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.3";

import {
  buildOutputInstruction,
  detectMode,
  documentsToPrompt,
  MAX_HISTORY,
  MAX_MESSAGE_CHARS,
  MEDUSA_MODEL_DEFAULT,
  memoryToPrompt,
  onboardingToPrompt,
  SYSTEM_PROMPT,
} from "./medusaPrompt.ts";

type MedusaMode = "ACAO" | "FOCO" | "PROCESSO" | "TRAVA";

interface ClaudeProxyPayload {
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  energy: 1 | 2 | 3;
  mode?: MedusaMode;
  onboarding: {
    display_name?: string;
    gender?: string;
    gender_other?: string | null;
    education_level?: string;
    profession?: string;
    profession_category?: string;
    profession_other?: string | null;
    constraints?: string | string[];
    constraints_other?: string | null;
    blockers?: string | string[];
    blockers_other?: string | null;
    low_energy_works?: string | string[];
    low_energy_works_other?: string | null;
    guidance_style?: string;
    known_patterns?: string | string[];
    never_do?: string | string[];
    never_do_other?: string | null;
    routine?: {
      days?: string[];
      periods?: string[];
      start_time?: string;
      end_time?: string;
      variable_schedule?: boolean;
      notes?: string;
    };
  } | null;
  memory: {
    patterns?: string[];
    triggers?: string[];
    worked?: string[];
    didnt_work?: string[];
    context?: string[];
  } | null;
  activeLoop?: string | null;
  documents?: Array<{
    id?: string;
    file_name?: string;
    extracted_summary?: string | null;
    analysis_consent_at?: string;
    analysis_consent_version?: string | null;
  }>;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const anthropicApiKey = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
const anthropicModel = Deno.env.get("ANTHROPIC_MODEL") ?? MEDUSA_MODEL_DEFAULT;
const usePromptCaching =
  (Deno.env.get("ANTHROPIC_PROMPT_CACHING") ?? "false").toLowerCase() === "true";

const CRISIS_SAFE_REPLY =
  "Isso é risco imediato. Eu não vou tentar resolver isso por chat.\n" +
  "Se você está em perigo agora, ligue 188 (CVV), 192 (SAMU) ou 190, ou vá para uma emergência.\n" +
  "Agora: afaste meios de se machucar e chame uma pessoa real para ficar com você.";

const CRISIS_TERMS = [
  "suicidio",
  "me matar",
  "quero morrer",
  "tentativa de suicidio",
  "autolesao",
  "autoagressao",
  "overdose",
  "nao aguento mais viver",
  "vou me machucar",
  "plano para morrer",
  "remedio para morrer",
  "tomar remedio para morrer",
];

const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const MAX_DOCUMENTS_IN_CONTEXT = 5;
const MAX_DOCUMENT_CONTEXT_CHARS = 4000;

// ── Time-awareness ──────────────────────────────────────────────────────────

type TimeCategory = "immediate" | "short" | "medium" | "day" | "long" | "first";

interface TimeSince {
  label: string;
  category: TimeCategory;
}

function getTimeSince(isoString: string | null): TimeSince {
  if (!isoString) return { label: "primeira vez aqui", category: "first" };
  const diffMs = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (minutes < 5) return { label: "agora mesmo", category: "immediate" };
  if (minutes < 120) return { label: `há ${minutes} minuto${minutes === 1 ? "" : "s"}`, category: "short" };
  if (hours < 6) return { label: `há ${hours} hora${hours === 1 ? "" : "s"}`, category: "medium" };
  if (hours < 28) return { label: `há ${hours} hora${hours === 1 ? "" : "s"}`, category: "day" };
  return { label: `há ${days} dia${days === 1 ? "" : "s"}`, category: "long" };
}

function buildTimeInstruction(time: TimeSince, ultimoContexto: string | null): string {
  const ctx = ultimoContexto ? `Na ultima conversa: "${ultimoContexto}". ` : "";
  const oferta = ultimoContexto && time.category !== "immediate"
    ? ` Se fizer sentido, pergunte gentilmente: "Quer que eu retome o que conversamos da ultima vez?"`
    : "";
  switch (time.category) {
    case "first":
      return "E o primeiro acesso do usuario. Acolha com calor, sem assumir nada.";
    case "immediate":
      return "O usuario acabou de falar. Continue naturalmente, sem saudar de novo.";
    case "short":
      return `${ctx}Pausa rapida (${time.label}). Retome sem cerimonia.${oferta}`;
    case "medium":
      return `${ctx}O usuario retornou ${time.label}. Reconheca de forma leve, adapte ao periodo do dia.${oferta}`;
    case "day":
      return `${ctx}Nova sessao ${time.label}. Acolha o retorno sem cobrar.${oferta}`;
    case "long":
      return `${ctx}Retorno depois de ausencia longa (${time.label}). Demonstre que sentiu falta com leveza, sem culpa. Pergunte como foi o periodo se fizer sentido.${oferta}`;
  }
}

// ── Documents ───────────────────────────────────────────────────────────────

interface DocumentContextRow {
  file_name: string | null;
  extracted_summary: string | null;
  uploaded_at: string;
}

async function loadAnalyzedDocumentsForContext(userId: string): Promise<DocumentContextRow[]> {
  const { data, error } = await adminClient
    .from("user_documents")
    .select("file_name, extracted_summary, uploaded_at")
    .eq("user_id", userId)
    .eq("analysis_status", "analyzed")
    .not("analysis_consent_at", "is", null)
    .not("extracted_summary", "is", null)
    .order("uploaded_at", { ascending: false })
    .limit(20);

  if (error || !data) return [];

  const out: DocumentContextRow[] = [];
  let totalChars = 0;

  for (const row of data) {
    const summary = (row.extracted_summary || "").trim();
    if (!summary) continue;
    const normalizedSummary = summary.slice(0, 1200);
    const chunkSize = (row.file_name || "documento.pdf").length + normalizedSummary.length;
    if (out.length >= MAX_DOCUMENTS_IN_CONTEXT) break;
    if (totalChars + chunkSize > MAX_DOCUMENT_CONTEXT_CHARS) break;
    out.push({ file_name: row.file_name, extracted_summary: normalizedSummary, uploaded_at: row.uploaded_at });
    totalChars += chunkSize;
  }

  return out;
}

// ── Context builder ─────────────────────────────────────────────────────────

function buildContext(
  payload: ClaudeProxyPayload,
  safeMessages: Array<{ role: "user" | "assistant"; content: string }>,
  analyzedDocuments: DocumentContextRow[],
  timeSince: TimeSince,
  ultimoContexto: string | null,
): string {
  const onboarding = payload.onboarding;
  const sessionMode = payload.mode || detectMode(safeMessages.at(-1)?.content || "");

  const now = new Date();
  // Full date with weekday in Brazilian Portuguese (São Paulo timezone)
  const dataFormatada = now.toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const horaFormatada = now.toLocaleTimeString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  });
  const agora = `${dataFormatada} às ${horaFormatada}`;

  const currentUserMessage =
    [...safeMessages].reverse().find((item) => item.role === "user")?.content || "";
  const recentHistory = safeMessages
    .map((item, index) => `${index + 1}. ${item.role.toUpperCase()}: ${item.content}`)
    .join("\n");

  const onboardingProfile = onboardingToPrompt(onboarding);
  const memoryProfile = memoryToPrompt(payload.memory);
  const documentsProfile = documentsToPrompt(analyzedDocuments);
  const outputInstruction = buildOutputInstruction(payload.energy, undefined);
  const timeInstruction = buildTimeInstruction(timeSince, ultimoContexto);

  return `
${onboardingProfile || "PERFIL DO USUARIO: nao informado."}

${memoryProfile || "MEMORIA PERSISTENTE DO USUARIO: nao informada."}

${documentsProfile || "DOCUMENTOS ANALISADOS DO USUARIO: nenhum."}

REGRA DOCUMENTOS:
- Se o usuario perguntar se voce tem acesso ao laudo/documento, responda exatamente:
"Tenho acesso ao resumo operacional do documento analisado com seu consentimento, nao ao PDF bruto."

CONTEXTO DA SESSAO:
- Hoje: ${agora}
- Energia atual: ${payload.energy}
- Modo atual: ${sessionMode}
- Loop comportamental detectado: ${payload.activeLoop ?? "EM OBSERVACAO"}
${payload.activeLoop ? `- INSTRUCAO: o usuario esta no loop ${payload.activeLoop}. Leve isso em conta no tom e nas sugestoes sem nomear o loop diretamente na resposta, a menos que seja util.` : ""}

CONTINUIDADE TEMPORAL:
- Ultima interacao: ${timeSince.label}
- Instrucao de abertura: ${timeInstruction}

HISTORICO RECENTE:
${recentHistory || "Sem historico."}

MENSAGEM ATUAL DO USUARIO:
${currentUserMessage || "Nao informada"}

INSTRUCAO DE SAIDA:
${outputInstruction || "Maximo 3 passos acionaveis. Sem diagnosticar, sem prescrever, sem decidir pelo usuario."}
`.trim();
}

// ── Utilities ───────────────────────────────────────────────────────────────

function pickUsageValue(value: unknown): number | null {
  return typeof value === "number" ? value : null;
}

function normalizeText(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function hasCrisisSignal(messages: Array<{ role: "user" | "assistant"; content: string }>): boolean {
  return messages
    .filter((m) => m.role === "user")
    .some((m) => {
      const normalized = normalizeText(m.content || "");
      return CRISIS_TERMS.some((term) => normalized.includes(term));
    });
}

async function writeAuditLog(input: {
  userId: string | null;
  model: string;
  status: string;
  inputTokens?: unknown;
  outputTokens?: unknown;
  cacheCreationTokens?: unknown;
  cacheReadTokens?: unknown;
}) {
  await adminClient.from("audit_logs").insert({
    user_id: input.userId,
    model: input.model,
    status: input.status,
    input_tokens: pickUsageValue(input.inputTokens),
    output_tokens: pickUsageValue(input.outputTokens),
    cache_creation_tokens: pickUsageValue(input.cacheCreationTokens),
    cache_read_tokens: pickUsageValue(input.cacheReadTokens),
  });
}

// ── Handler ─────────────────────────────────────────────────────────────────

serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  let crisisDetected = false;
  let activeUserId: string | null = null;

  try {
    const authHeader = request.headers.get("Authorization") || "";
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!user.email_confirmed_at) {
      return new Response(JSON.stringify({ error: "Email não confirmado" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    activeUserId = user.id;

    const payload = (await request.json()) as ClaudeProxyPayload;
    const safeMessages = (payload.messages || [])
      .filter((item) => ["user", "assistant"].includes(item.role))
      .map((item) => ({
        role: item.role,
        content: (item.content?.trim() || "").slice(0, MAX_MESSAGE_CHARS),
      }))
      .filter((item) => !!item.content)
      .slice(-MAX_HISTORY);

    if (!safeMessages.length) {
      return new Response(JSON.stringify({ error: "Nenhuma mensagem enviada" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    crisisDetected = hasCrisisSignal(safeMessages);
    if (crisisDetected) {
      await writeAuditLog({ userId: user.id, model: anthropicModel, status: "crisis_detected" });
      return new Response(
        JSON.stringify({ reply: CRISIS_SAFE_REPLY, model: "crisis-fallback" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!anthropicApiKey) {
      return new Response(
        JSON.stringify({ error: "ANTHROPIC_API_KEY não configurada" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Fetch profile + documents in parallel
    const [analyzedDocuments, profileRow] = await Promise.all([
      loadAnalyzedDocumentsForContext(user.id),
      adminClient
        .from("profiles")
        .select("ultima_interacao, ultimo_contexto")
        .eq("id", user.id)
        .single()
        .then(({ data }) => data as { ultima_interacao: string | null; ultimo_contexto: string | null } | null),
    ]);

    const timeSince = getTimeSince(profileRow?.ultima_interacao ?? null);
    const ultimoContexto = profileRow?.ultimo_contexto ?? null;

    const systemPrompt = `${SYSTEM_PROMPT}\n\n${buildContext(payload, safeMessages, analyzedDocuments, timeSince, ultimoContexto)}`;
    const anthropicPayload: Record<string, unknown> = {
      model: anthropicModel,
      max_tokens: 700,
      temperature: 0.4,
      messages: safeMessages,
      system: usePromptCaching
        ? [{ type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } }]
        : systemPrompt,
    };

    const anthropicResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": anthropicApiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
        ...(usePromptCaching ? { "anthropic-beta": "prompt-caching-2024-07-31" } : {}),
      },
      body: JSON.stringify(anthropicPayload),
    });

    const raw = await anthropicResponse.json();

    if (!anthropicResponse.ok) {
      await writeAuditLog({ userId: user.id, model: anthropicModel, status: "error" });
      return new Response(
        JSON.stringify({ error: raw?.error?.message || "Falha ao chamar Claude" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const contentBlocks = Array.isArray(raw?.content) ? raw.content : [];
    const reply = contentBlocks
      .filter((block: { type?: string }) => block?.type === "text")
      .map((block: { text?: string }) => block.text || "")
      .join("\n")
      .trim();

    if (!reply) {
      await writeAuditLog({ userId: user.id, model: anthropicModel, status: "empty_reply" });
      return new Response(
        JSON.stringify({ error: "Claude retornou resposta vazia" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const usage = raw?.usage || {};
    const lastUserMsg = [...safeMessages].reverse().find((m) => m.role === "user")?.content ?? "";
    const novoContexto = lastUserMsg.slice(0, 120).replace(/\s+/g, " ").trim();

    // Save audit log + update interaction timestamp in parallel
    await Promise.all([
      writeAuditLog({
        userId: user.id,
        model: anthropicModel,
        status: "success",
        inputTokens: usage.input_tokens,
        outputTokens: usage.output_tokens,
        cacheCreationTokens: usage.cache_creation_input_tokens ?? usage.cache_creation_tokens,
        cacheReadTokens: usage.cache_read_input_tokens ?? usage.cache_read_tokens,
      }),
      adminClient
        .from("profiles")
        .update({ ultima_interacao: new Date().toISOString(), ultimo_contexto: novoContexto || null })
        .eq("id", user.id),
    ]);

    return new Response(
      JSON.stringify({ reply, model: anthropicModel }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    if (crisisDetected) {
      await writeAuditLog({ userId: activeUserId, model: anthropicModel, status: "crisis_fallback" });
      return new Response(
        JSON.stringify({ reply: CRISIS_SAFE_REPLY, model: "crisis-fallback" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    await writeAuditLog({ userId: null, model: anthropicModel, status: "exception" });
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
