import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const EXTRACTION_PROMPT = `Analise a conversa abaixo entre o usuario e a Medusa (assistente para neurodivergentes).

Retorne APENAS um JSON valido, sem markdown, sem comentarios:

{
  "resumo_conversa": "resumo do que foi conversado em ate 3 frases",
  "has_task": true ou false,
  "task_summary": "descricao curta da tarefa combinada (max 120 chars, ou null se nao houver)",
  "topicos_importantes": ["topico1", "topico2"],
  "padroes_observados": ["padrao1"],
  "estado_emocional": "como o usuario parecia estar (1 frase)"
}

Regras:
- has_task = true APENAS se houve compromisso claro com verbo de acao (ex: "vou escrever", "vou ligar").
- "Vou tentar", "quem sabe", "talvez", "depois vejo" NAO sao tarefas.
- Nao invente nada que nao esteja na conversa.
- task_summary = null se has_task = false.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Nao autorizado" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anthropicApiKey = Deno.env.get("ANTHROPIC_API_KEY")!;
  const anthropicModel = Deno.env.get("ANTHROPIC_MODEL") ?? "claude-haiku-4-5-20251001";

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) {
    return new Response(JSON.stringify({ error: "Token invalido" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const body = await req.json();
  const conversationId: string | null = body?.conversation_id ?? null;
  const rawMessages: Array<{ role: string; content: string }> = body?.messages ?? [];
  // energia passada pelo frontend (1=baixa, 2=media, 3=alta); null se nao informada
  const energiaSessao: number | null = typeof body?.energy === "number" ? body.energy : null;

  if (rawMessages.length < 2) {
    return new Response(JSON.stringify({ ok: true, reason: "poucas mensagens" }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const conversationText = rawMessages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .slice(-20)
    .map((m) => `${m.role === "user" ? "Usuario" : "Medusa"}: ${m.content}`)
    .join("\n");

  const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": anthropicApiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: anthropicModel,
      max_tokens: 400,
      temperature: 0.1,
      messages: [{
        role: "user",
        content: `${EXTRACTION_PROMPT}\n\n---CONVERSA---\n${conversationText}\n---FIM---`,
      }],
    }),
  });

  if (!anthropicRes.ok) {
    return new Response(JSON.stringify({ ok: false, error: "Claude indisponivel" }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const raw = await anthropicRes.json();
  const textOutput = (raw?.content ?? [])
    .filter((b: { type?: string }) => b.type === "text")
    .map((b: { text?: string }) => b.text ?? "")
    .join("").trim();

  interface MemoriaExtraida {
    resumo_conversa: string;
    has_task: boolean;
    task_summary: string | null;
    topicos_importantes: string[];
    padroes_observados: string[];
    estado_emocional: string;
  }

  let memoria: MemoriaExtraida = {
    resumo_conversa: "",
    has_task: false,
    task_summary: null,
    topicos_importantes: [],
    padroes_observados: [],
    estado_emocional: "",
  };

  try {
    const jsonMatch = textOutput.match(/\{[\s\S]*\}/);
    if (jsonMatch) memoria = JSON.parse(jsonMatch[0]);
  } catch {
    // falha silenciosa — salva o que tiver
  }

  const now = new Date().toISOString();
  const hoje = now.split("T")[0];

  // ── Salvar follow-up se houve tarefa concreta ─────────────────────────────
  if (memoria.has_task && memoria.task_summary) {
    await adminClient
      .from("follow_ups")
      .update({ status: "expired", resolved_at: now })
      .eq("user_id", user.id)
      .eq("status", "pending");

    await adminClient.from("follow_ups").insert({
      user_id: user.id,
      conversation_id: conversationId,
      task_summary: memoria.task_summary.slice(0, 200),
      context: memoria.resumo_conversa.slice(0, 400),
      resumo_conversa: memoria.resumo_conversa.slice(0, 400),
      has_task: true,
      status: "pending",
      memoria_extraida: {
        topicos: memoria.topicos_importantes,
        padroes: memoria.padroes_observados,
        emocional: memoria.estado_emocional,
      },
    });
  }

  // ── Consolidar na memoria do perfil (ultimas 10 sessoes) ──────────────────
  const { data: profile } = await adminClient
    .from("profiles")
    .select("memoria_consolidada")
    .eq("id", user.id)
    .single();

  const memoriaAtual: unknown[] = Array.isArray(profile?.memoria_consolidada)
    ? profile.memoria_consolidada
    : [];

  const novaMemoria = [
    ...memoriaAtual.slice(-9),
    {
      data: now,
      resumo: memoria.resumo_conversa,
      topicos: memoria.topicos_importantes,
      padroes: memoria.padroes_observados,
      emocional: memoria.estado_emocional,
      teve_tarefa: memoria.has_task,
      tarefa: memoria.task_summary,
    },
  ];

  await adminClient
    .from("profiles")
    .update({
      memoria_consolidada: novaMemoria,
      ultimo_contexto: memoria.resumo_conversa.slice(0, 120) || null,
    })
    .eq("id", user.id);

  // ── Upsert na sessao diaria (linha do tempo) ──────────────────────────────
  // Buscar sessao existente para calcular media acumulada de energia
  const { data: sessaoExistente } = await adminClient
    .from("sessoes_diarias")
    .select("energia_media, energia_minima, energia_maxima, loops_detectados")
    .eq("user_id", user.id)
    .eq("data", hoje)
    .maybeSingle();

  // Calcular nova media/min/max de energia
  let novaEnergiMedia: number | null = null;
  let novaEnergiaMinima: number | null = null;
  let novaEnergiaMaxima: number | null = null;

  if (energiaSessao !== null) {
    if (sessaoExistente?.energia_media != null) {
      // Media ponderada simples entre valor anterior e atual
      novaEnergiMedia = (Number(sessaoExistente.energia_media) + energiaSessao) / 2;
    } else {
      novaEnergiMedia = energiaSessao;
    }
    novaEnergiaMinima = sessaoExistente?.energia_minima != null
      ? Math.min(sessaoExistente.energia_minima, energiaSessao)
      : energiaSessao;
    novaEnergiaMaxima = sessaoExistente?.energia_maxima != null
      ? Math.max(sessaoExistente.energia_maxima, energiaSessao)
      : energiaSessao;
  } else {
    novaEnergiMedia = sessaoExistente?.energia_media ?? null;
    novaEnergiaMinima = sessaoExistente?.energia_minima ?? null;
    novaEnergiaMaxima = sessaoExistente?.energia_maxima ?? null;
  }

  // Mesclar loops do dia (sem duplicatas)
  const loopsAnteriores: string[] = Array.isArray(sessaoExistente?.loops_detectados)
    ? sessaoExistente.loops_detectados
    : [];
  const loopsNovos = Array.isArray(memoria.padroes_observados)
    ? memoria.padroes_observados.filter(Boolean)
    : [];
  const loopsMerged = [...new Set([...loopsAnteriores, ...loopsNovos])];

  await adminClient
    .from("sessoes_diarias")
    .upsert({
      user_id: user.id,
      data: hoje,
      energia_media: novaEnergiMedia,
      energia_minima: novaEnergiaMinima,
      energia_maxima: novaEnergiaMaxima,
      loops_detectados: loopsMerged,
      resumo_emocional: memoria.estado_emocional || null,
      resumo_sessao: memoria.resumo_conversa.slice(0, 400) || null,
      teve_tarefa: memoria.has_task,
      updated_at: now,
    }, { onConflict: "user_id,data" });

  return new Response(JSON.stringify({ ok: true, memoria }), {
    status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
