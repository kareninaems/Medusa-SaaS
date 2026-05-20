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
const anthropicModel =
  Deno.env.get("ANTHROPIC_MODEL") ?? MEDUSA_MODEL_DEFAULT;
const usePromptCaching =
  (Deno.env.get("ANTHROPIC_PROMPT_CACHING") ?? "false").toLowerCase() === "true";

const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function buildContext(
  payload: ClaudeProxyPayload,
  safeMessages: Array<{ role: "user" | "assistant"; content: string }>,
): string {
  const onboarding = payload.onboarding;
  const sessionMode = payload.mode || detectMode(safeMessages.at(-1)?.content || "");
  const now = new Date();
  const currentUserMessage =
    [...safeMessages]
      .reverse()
      .find((item) => item.role === "user")
      ?.content || "";
  const recentHistory = safeMessages
    .map((item, index) => `${index + 1}. ${item.role.toUpperCase()}: ${item.content}`)
    .join("\n");

  const onboardingProfile = onboardingToPrompt(onboarding);
  const memoryProfile = memoryToPrompt(payload.memory);
  const documentsProfile = documentsToPrompt(payload.documents);
  const outputInstruction = buildOutputInstruction(payload.energy, undefined);

  return `
${onboardingProfile || "PERFIL DO USUARIO: nao informado."}

${memoryProfile || "MEMORIA PERSISTENTE DO USUARIO: nao informada."}

${documentsProfile || "DOCUMENTOS COM CONSENTIMENTO: nenhum."}

CONTEXTO DA SESSAO:
- Data ISO: ${now.toISOString()}
- Data local: ${now.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}
- Energia atual: ${payload.energy}
- Modo atual: ${sessionMode}

HISTORICO RECENTE:
${recentHistory || "Sem historico."}

MENSAGEM ATUAL DO USUARIO:
${currentUserMessage || "Nao informada"}

INSTRUCAO DE SAIDA:
${outputInstruction || "Maximo 3 passos acionaveis. Sem diagnosticar, sem prescrever, sem decidir pelo usuario."}
`.trim();
}

function pickUsageValue(value: unknown): number | null {
  return typeof value === "number" ? value : null;
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

serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (!anthropicApiKey) {
    return new Response(
      JSON.stringify({ error: "ANTHROPIC_API_KEY não configurada" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  try {
    const authHeader = request.headers.get("Authorization") || "";
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

    const systemPrompt = `${SYSTEM_PROMPT}\n\n${buildContext(payload, safeMessages)}`;
    const anthropicPayload: Record<string, unknown> = {
      model: anthropicModel,
      max_tokens: 700,
      temperature: 0.4,
      messages: safeMessages,
      system: usePromptCaching
        ? [
            {
              type: "text",
              text: systemPrompt,
              cache_control: { type: "ephemeral" },
            },
          ]
        : systemPrompt,
    };

    const anthropicResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": anthropicApiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
        ...(usePromptCaching
          ? { "anthropic-beta": "prompt-caching-2024-07-31" }
          : {}),
      },
      body: JSON.stringify(anthropicPayload),
    });

    const raw = await anthropicResponse.json();

    if (!anthropicResponse.ok) {
      await writeAuditLog({
        userId: user.id,
        model: anthropicModel,
        status: "error",
      });
      return new Response(
        JSON.stringify({
          error: raw?.error?.message || "Falha ao chamar Claude",
        }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const contentBlocks = Array.isArray(raw?.content) ? raw.content : [];
    const reply = contentBlocks
      .filter((block: { type?: string }) => block?.type === "text")
      .map((block: { text?: string }) => block.text || "")
      .join("\n")
      .trim();

    if (!reply) {
      await writeAuditLog({
        userId: user.id,
        model: anthropicModel,
        status: "empty_reply",
      });

      return new Response(
        JSON.stringify({ error: "Claude retornou resposta vazia" }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const usage = raw?.usage || {};
    await writeAuditLog({
      userId: user.id,
      model: anthropicModel,
      status: "success",
      inputTokens: usage.input_tokens,
      outputTokens: usage.output_tokens,
      cacheCreationTokens:
        usage.cache_creation_input_tokens ?? usage.cache_creation_tokens,
      cacheReadTokens: usage.cache_read_input_tokens ?? usage.cache_read_tokens,
    });

    return new Response(
      JSON.stringify({
        reply,
        model: anthropicModel,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    await writeAuditLog({
      userId: null,
      model: anthropicModel,
      status: "exception",
    });

    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Erro interno",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
