import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.3";

import { SYSTEM_PROMPT } from "./system_prompt.ts";

type MedusaMode = "ACAO" | "FOCO" | "PROCESSO" | "TRAVA";

interface ClaudeProxyPayload {
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  energy: 1 | 2 | 3;
  mode: MedusaMode;
  onboarding: {
    education_level?: string;
    profession?: string;
    constraints?: string;
    blockers?: string;
    low_energy_works?: string;
    guidance_style?: string;
    known_patterns?: string;
    never_do?: string;
    routine?: {
      days?: string[];
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
  Deno.env.get("ANTHROPIC_MODEL") ?? "claude-haiku-4-5-20251001";
const usePromptCaching =
  (Deno.env.get("ANTHROPIC_PROMPT_CACHING") ?? "false").toLowerCase() === "true";

const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function buildContext(payload: ClaudeProxyPayload): string {
  const onboarding = payload.onboarding;
  const routine = onboarding?.routine;
  const memory = payload.memory;

  const printJson = (value: unknown): string => {
    if (!value) return "vazio";
    if (Array.isArray(value)) return value.join(" | ") || "vazio";
    if (typeof value === "string") return value;
    try {
      return JSON.stringify(value);
    } catch {
      return "vazio";
    }
  };

  return `
## CONTEXTO DO USUÁRIO
Energia atual: ${payload.energy}
Modo atual: ${payload.mode}

Escolaridade: ${onboarding?.education_level || "não informado"}
Profissão/Ocupação: ${onboarding?.profession || "não informado"}
Restrições: ${onboarding?.constraints || "não informado"}
O que trava: ${onboarding?.blockers || "não informado"}
O que funciona sem energia: ${onboarding?.low_energy_works || "não informado"}
Estilo de orientação preferido: ${onboarding?.guidance_style || "não informado"}
Padrões já reconhecidos: ${onboarding?.known_patterns || "não informado"}
Limites da resposta (nunca fazer): ${onboarding?.never_do || "não informado"}

Rotina:
- Dias principais: ${(routine?.days || []).join(", ") || "não informado"}
- Início típico: ${routine?.start_time || "não informado"}
- Fim típico: ${routine?.end_time || "não informado"}
- Horário variável: ${routine?.variable_schedule ? "sim" : "não"}
- Blocos difíceis: ${routine?.notes || "não informado"}

Memória:
- Patterns: ${printJson(memory?.patterns)}
- Triggers: ${printJson(memory?.triggers)}
- Worked: ${printJson(memory?.worked)}
- Didnt_work: ${printJson(memory?.didnt_work)}
- Context: ${printJson(memory?.context)}

## INSTRUÇÃO ADICIONAL
Use escolaridade, profissão, rotina e restrições para ajustar densidade da linguagem,
timing das sugestões e realismo dos passos.
Nunca decida pela pessoa. Sugira; o usuário decide.
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
      .map((item) => ({ role: item.role, content: item.content?.trim() || "" }))
      .filter((item) => !!item.content)
      .slice(-16);

    if (!safeMessages.length) {
      return new Response(JSON.stringify({ error: "Nenhuma mensagem enviada" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `${SYSTEM_PROMPT}\n\n${buildContext(payload)}`;
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
        reply: reply || "Sem resposta processável da Medusa.",
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
