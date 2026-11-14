import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.3";

// Le uma foto ou PDF enviado no chat e devolve uma descricao curta em texto.
// O arquivo NAO e armazenado: e enviado uma vez ao modelo e descartado.
// A descricao volta para o app, que a envia junto da mensagem ao claude-proxy.

interface LerAnexoPayload {
  kind?: "image" | "pdf";
  media_type?: string;
  data?: string;
  file_name?: string;
}

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

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_BASE64_CHARS = 5_600_000; // cerca de 4 MB de arquivo
const MAX_DESCRIPTION_CHARS = 800;
const DAILY_LIMIT = 30;
const STATUS_OK = "attachment_read";

const READER_PROMPT =
  "Voce le um anexo (foto, imagem ou PDF) que o usuario enviou a um assistente de organizacao pessoal. " +
  "Responda em portugues, em texto corrido, sem titulos e sem markdown, com no maximo 600 caracteres. " +
  "Se houver texto no anexo, transcreva o essencial: tarefas, datas, horarios, valores, nomes de compromissos e frases. " +
  "Se nao houver texto (foto, desenho, logotipo, ilustracao), descreva objetivamente o que aparece: elementos, cores e cena. " +
  "Sempre descreva alguma coisa. " +
  "Nao diagnostique, nao interprete exames nem saude, nao identifique pessoas pelo rosto e nao de conselhos. " +
  "Responda 'Anexo ilegivel' somente se a imagem estiver totalmente em branco, totalmente preta ou corrompida.";

// Prefixo que deixa claro para a Medusa que o texto veio do anexo, nao da pessoa.
const DESCRIPTION_PREFIX = "Conteúdo lido automaticamente do anexo (não foi escrito pelo usuário): ";

function json(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function writeAuditLog(userId: string | null, status: string, usage?: Record<string, unknown>) {
  const pick = (value: unknown) => (typeof value === "number" ? value : null);
  await adminClient.from("audit_logs").insert({
    user_id: userId,
    model: anthropicModel,
    status,
    input_tokens: pick(usage?.input_tokens),
    output_tokens: pick(usage?.output_tokens),
  });
}

serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return json({ error: "Método não permitido" }, 405);
  }

  let activeUserId: string | null = null;

  try {
    const authHeader = request.headers.get("Authorization") || "";
    if (!authHeader) return json({ error: "Não autorizado" }, 401);

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();
    if (userError || !user) return json({ error: "Token inválido" }, 401);
    activeUserId = user.id;

    const payload = (await request.json()) as LerAnexoPayload;
    const kind = payload.kind;
    const mediaType = payload.media_type ?? "";
    const data = typeof payload.data === "string" ? payload.data : "";

    const validKind =
      (kind === "image" && IMAGE_TYPES.includes(mediaType)) ||
      (kind === "pdf" && mediaType === "application/pdf");
    if (!validKind) {
      return json({ error: "Formato não aceito. Envie foto (JPG, PNG) ou PDF." }, 400);
    }
    if (!data) return json({ error: "Anexo vazio." }, 400);
    if (data.length > MAX_BASE64_CHARS) {
      return json({ error: "Arquivo grande demais. O limite é 4 MB." }, 413);
    }
    if (!/^[A-Za-z0-9+/]+=*$/.test(data)) {
      return json({ error: "Anexo inválido." }, 400);
    }

    if (!anthropicApiKey) return json({ error: "ANTHROPIC_API_KEY não configurada" }, 500);

    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);
    const { count } = await adminClient
      .from("audit_logs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("status", STATUS_OK)
      .gte("created_at", startOfDay.toISOString());
    if ((count ?? 0) >= DAILY_LIMIT) {
      return json({ error: `Limite de ${DAILY_LIMIT} anexos por dia atingido.` }, 429);
    }

    const attachmentBlock =
      kind === "image"
        ? { type: "image", source: { type: "base64", media_type: mediaType, data } }
        : { type: "document", source: { type: "base64", media_type: "application/pdf", data } };

    const anthropicResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": anthropicApiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: anthropicModel,
        max_tokens: 400,
        temperature: 0,
        system: READER_PROMPT,
        messages: [
          {
            role: "user",
            content: [attachmentBlock, { type: "text", text: "Leia este anexo." }],
          },
        ],
      }),
    });

    const raw = await anthropicResponse.json();

    if (!anthropicResponse.ok) {
      await writeAuditLog(user.id, "attachment_error");
      return json({ error: raw?.error?.message || "Falha ao ler o anexo" }, 502);
    }

    const blocks = Array.isArray(raw?.content) ? raw.content : [];
    const readText = blocks
      .filter((block: { type?: string }) => block?.type === "text")
      .map((block: { text?: string }) => block.text || "")
      .join("\n")
      .trim();
    const description = readText ? (DESCRIPTION_PREFIX + readText).slice(0, MAX_DESCRIPTION_CHARS) : "";

    if (!description) {
      await writeAuditLog(user.id, "attachment_empty");
      return json({ error: "Não foi possível ler o anexo." }, 502);
    }

    await writeAuditLog(user.id, STATUS_OK, raw?.usage ?? {});
    return json({ description }, 200);
  } catch (error) {
    await writeAuditLog(activeUserId, "attachment_exception").catch(() => {});
    return json({ error: error instanceof Error ? error.message : "Erro interno" }, 500);
  }
});
