// Edge Function: extract-followup
// Receives the last conversation messages, asks Claude if there was a real committed task,
// saves it to follow_ups table, and returns the structured result.
//
// Required env vars:
//   ANTHROPIC_API_KEY, ANTHROPIC_MODEL, SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const EXTRACTION_PROMPT = `Analise a conversa abaixo entre o usuario e a Medusa.
Determine se houve uma tarefa ou acao acordada para a proxima vez.

Definicao de "tarefa": algo concreto que o usuario se comprometeu a fazer, com verbo de acao claro (ex: "escrever", "ligar", "arrumar", "entregar", "comecar").
Desabafos, reflexoes, planos vagos ou frases de intencao sem compromisso real NAO sao tarefas.

Responda APENAS com um JSON valido no seguinte formato, sem comentarios ou markdown:

{"has_task":true,"task_summary":"descricao curta e direta da tarefa (max 120 chars)","context":"breve contexto do que foi conversado (max 2 frases)"}

Ou se nao houver tarefa:

{"has_task":false,"task_summary":null,"context":"breve contexto do que foi conversado (max 2 frases)"}`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
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
    return new Response(JSON.stringify({ error: "Invalid token" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const body = await req.json();
  const conversationId: string | null = body?.conversation_id ?? null;
  const rawMessages: Array<{ role: string; content: string }> = body?.messages ?? [];

  if (!rawMessages.length) {
    return new Response(JSON.stringify({ has_task: false, task_summary: null, context: "" }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Format conversation as readable text for Claude
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
      max_tokens: 300,
      temperature: 0.1,
      messages: [{
        role: "user",
        content: `${EXTRACTION_PROMPT}\n\n---CONVERSA---\n${conversationText}\n---FIM---`,
      }],
    }),
  });

  if (!anthropicRes.ok) {
    return new Response(JSON.stringify({ has_task: false, task_summary: null, context: "" }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const raw = await anthropicRes.json();
  const textOutput = (raw?.content ?? [])
    .filter((b: { type?: string }) => b.type === "text")
    .map((b: { text?: string }) => b.text ?? "")
    .join("").trim();

  let result: { has_task: boolean; task_summary: string | null; context: string } = {
    has_task: false, task_summary: null, context: "",
  };

  try {
    // Extract JSON even if model adds surrounding text
    const jsonMatch = textOutput.match(/\{[\s\S]*\}/);
    if (jsonMatch) result = JSON.parse(jsonMatch[0]);
  } catch {
    // Parsing failed — treat as no task
  }

  // Persist to follow_ups table if there's a real task
  if (result.has_task && result.task_summary) {
    // Only insert if no pending follow_up already exists for this user
    const { data: existing } = await adminClient
      .from("follow_ups")
      .select("id")
      .eq("user_id", user.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!existing) {
      await adminClient.from("follow_ups").insert({
        user_id: user.id,
        conversation_id: conversationId,
        task_summary: result.task_summary.slice(0, 200),
        context: (result.context ?? "").slice(0, 400),
        status: "pending",
      });
    }
  }

  return new Response(JSON.stringify(result), {
    status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
