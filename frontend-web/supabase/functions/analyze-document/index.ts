import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const anthropicApiKey = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
const anthropicModel = Deno.env.get("ANTHROPIC_MODEL") ?? "claude-haiku-4-5-20251001";

const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function pickUsageValue(value: unknown): number | null {
  return typeof value === "number" ? value : null;
}

function uint8ToBase64(uint8: Uint8Array): string {
  const chunkSize = 0x8000;
  let binary = "";

  for (let index = 0; index < uint8.length; index += chunkSize) {
    const chunk = uint8.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

function sanitizeOperationalSummary(raw: string): string {
  const withoutPii = raw
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redigido-email]")
    .replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, "[redigido-cpf]")
    .replace(/\b(?:\+?55\s?)?(?:\(?\d{2}\)?\s?)?9?\d{4}-?\d{4}\b/g, "[redigido-telefone]")
    .replace(/\b\d{5}-?\d{3}\b/g, "[redigido-cep]")
    .trim();

  const sectionDefs = [
    { key: "diagnosticos", title: "Diagnósticos/hipóteses", matcher: /diagn[oó]sticos\/?hip[oó]teses?/i },
    { key: "inteligencia", title: "Inteligência/nível cognitivo", matcher: /intelig[eê]ncia\/?n[ií]vel cognitivo/i },
    { key: "perfil", title: "Perfil cognitivo", matcher: /perfil cognitivo/i },
    { key: "sobrecarga", title: "Sinais de sobrecarga", matcher: /sinais de sobrecarga/i },
    {
      key: "recomendacoes",
      title: "Recomendações operacionais para a Medusa",
      matcher: /recomenda[cç][oõ]es operacionais para a medusa/i,
    },
  ] as const;

  const buckets: Record<string, string[]> = {};
  for (const section of sectionDefs) buckets[section.key] = [];

  let currentKey: string | null = null;
  const lines = withoutPii
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 60);

  for (const line of lines) {
    const normalizedLine = line.replace(/^[-•\d.)\s]+/, "").trim();

    let switched = false;
    for (const section of sectionDefs) {
      if (section.matcher.test(normalizedLine)) {
        currentKey = section.key;
        const payload = normalizedLine.split(":").slice(1).join(":").trim();
        if (payload) buckets[currentKey].push(payload);
        switched = true;
        break;
      }
    }
    if (switched) continue;

    if (currentKey) {
      buckets[currentKey].push(normalizedLine);
    }
  }

  const fallback = "não informado no documento";
  const assembled = sectionDefs.map((section) => {
    const value = buckets[section.key].join(" ").replace(/\s+/g, " ").trim();
    return `${section.title}: ${value || fallback}`;
  });

  return assembled.join("\n").slice(0, 2200);
}

async function writeAuditLog(input: {
  userId: string;
  model: string;
  status: string;
  inputTokens?: unknown;
  outputTokens?: unknown;
}) {
  await adminClient.from("audit_logs").insert({
    user_id: input.userId,
    model: input.model,
    status: input.status,
    input_tokens: pickUsageValue(input.inputTokens),
    output_tokens: pickUsageValue(input.outputTokens),
  });
}

serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (!anthropicApiKey) {
    return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY não configurada" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
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

    const payload = await request.json();
    const documentId = String(payload?.document_id || "").trim();
    if (!documentId) {
      return new Response(JSON.stringify({ error: "document_id é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: documentRow, error: documentError } = await adminClient
      .from("user_documents")
      .select("id, user_id, file_path, file_name, mime_type, uploaded_at, analysis_status, analysis_consent_at, analysis_consent_version, deleted_at, extracted_summary")
      .eq("id", documentId)
      .eq("user_id", user.id)
      .single();

    if (documentError || !documentRow) {
      return new Response(JSON.stringify({ error: "Documento não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!documentRow.analysis_consent_at) {
      return new Response(JSON.stringify({ error: "Documento sem consentimento explícito" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!["awaiting_analysis", "error", "analyzed"].includes(documentRow.analysis_status)) {
      return new Response(JSON.stringify({ error: "Documento não está pronto para análise manual" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const download = await adminClient.storage.from("user-documents").download(documentRow.file_path);
    if (download.error || !download.data) {
      await adminClient
        .from("user_documents")
        .update({ analysis_status: "error" })
        .eq("id", documentId)
        .eq("user_id", user.id);

      await writeAuditLog({
        userId: user.id,
        model: anthropicModel,
        status: "document_analysis_storage_error",
      });

      return new Response(JSON.stringify({ error: "Falha ao ler PDF privado" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const buffer = await download.data.arrayBuffer();
    const binary = new Uint8Array(buffer);

    if (binary.byteLength > 8 * 1024 * 1024) {
      await adminClient
        .from("user_documents")
        .update({ analysis_status: "error" })
        .eq("id", documentId)
        .eq("user_id", user.id);

      await writeAuditLog({
        userId: user.id,
        model: anthropicModel,
        status: "document_analysis_file_too_large",
      });

      return new Response(JSON.stringify({ error: "PDF muito grande para análise" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const base64Pdf = uint8ToBase64(binary);
    const analysisPrompt = [
      "Extraia APENAS o que está escrito no documento, sem inferir, sem completar lacunas e sem diagnosticar por conta própria.",
      "Não incluir nome, CPF, endereço, telefone ou qualquer dado identificador.",
      "Não retornar texto integral do laudo.",
      "Responda em português, em até 12 linhas, neste formato EXATO:",
      "Diagnósticos/hipóteses: ...",
      "Inteligência/nível cognitivo: ...",
      "Perfil cognitivo: ...",
      "Sinais de sobrecarga: ...",
      "Recomendações operacionais para a Medusa: ...",
      "Regras adicionais obrigatórias:",
      "1) Diferencie diagnóstico fechado, hipótese e traço observado somente se o laudo explicitar.",
      "2) Se houver QI/percentil/classificação cognitiva, incluir literalmente; se não houver, escrever 'não informado no documento'.",
      "3) Se qualquer seção não estiver no laudo, escrever 'não informado no documento'.",
      "4) Não diagnosticar, não prescrever, não inventar.",
    ].join("\n");

    const anthropicResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": anthropicApiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: anthropicModel,
        max_tokens: 600,
        temperature: 0.2,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: analysisPrompt,
              },
              {
                type: "document",
                source: {
                  type: "base64",
                  media_type: "application/pdf",
                  data: base64Pdf,
                },
              },
            ],
          },
        ],
      }),
    });

    const raw = await anthropicResponse.json();
    if (!anthropicResponse.ok) {
      await adminClient
        .from("user_documents")
        .update({ analysis_status: "error" })
        .eq("id", documentId)
        .eq("user_id", user.id);

      await writeAuditLog({
        userId: user.id,
        model: anthropicModel,
        status: "document_analysis_llm_error",
      });

      return new Response(
        JSON.stringify({ error: raw?.error?.message || "Falha na análise com Claude" }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const contentBlocks = Array.isArray(raw?.content) ? raw.content : [];
    const textOutput = contentBlocks
      .filter((block: { type?: string }) => block?.type === "text")
      .map((block: { text?: string }) => block.text || "")
      .join("\n")
      .trim();

    const safeSummary = sanitizeOperationalSummary(textOutput);
    if (!safeSummary) {
      await adminClient
        .from("user_documents")
        .update({ analysis_status: "error" })
        .eq("id", documentId)
        .eq("user_id", user.id);

      await writeAuditLog({
        userId: user.id,
        model: anthropicModel,
        status: "document_analysis_empty_summary",
      });

      return new Response(JSON.stringify({ error: "Resumo vazio na análise" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: updated, error: updateError } = await adminClient
      .from("user_documents")
      .update({
        extracted_summary: safeSummary,
        analysis_status: "analyzed",
      })
      .eq("id", documentId)
      .eq("user_id", user.id)
      .select("id, user_id, file_path, file_name, mime_type, uploaded_at, analysis_status, analysis_consent_at, analysis_consent_version, deleted_at, extracted_summary")
      .single();

    if (updateError || !updated) {
      await writeAuditLog({
        userId: user.id,
        model: anthropicModel,
        status: "document_analysis_update_error",
      });

      return new Response(JSON.stringify({ error: "Falha ao salvar resultado da análise" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const usage = raw?.usage || {};
    await writeAuditLog({
      userId: user.id,
      model: anthropicModel,
      status: "document_analysis_success",
      inputTokens: usage.input_tokens,
      outputTokens: usage.output_tokens,
    });

    return new Response(JSON.stringify({
      ok: true,
      document: updated,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
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
