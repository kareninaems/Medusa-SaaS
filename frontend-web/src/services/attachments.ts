import { FunctionsHttpError } from "@supabase/supabase-js";
import type { Session } from "@supabase/supabase-js";

import { supabase } from "../lib/supabase";

// Anexos do chat: a foto ou o PDF e lido uma vez pela IA e nao fica guardado.
// O que entra na conversa e a descricao em texto devolvida pela funcao "ler-anexo".

const MAX_IMAGE_SIDE = 1568;
const MAX_PDF_BYTES = 3 * 1024 * 1024;
export const ATTACHMENT_ACCEPT = "image/*,application/pdf";
export const MAX_USER_TEXT_WITH_ATTACHMENT = 600;

interface PreparedAttachment {
  kind: "image" | "pdf";
  media_type: string;
  data: string;
  file_name: string;
}

function readAsBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : "");
    };
    reader.onerror = () => reject(new Error("Não foi possível ler o arquivo."));
    reader.readAsDataURL(blob);
  });
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Não foi possível abrir a imagem. Tente JPG ou PNG."));
    };
    image.src = url;
  });
}

async function imageToJpegBase64(file: File): Promise<string> {
  const image = await loadImage(file);
  const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Não foi possível processar a imagem.");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
  if (!blob) throw new Error("Não foi possível processar a imagem.");
  return readAsBase64(blob);
}

export function isAcceptedAttachment(file: File): boolean {
  return file.type.startsWith("image/") || file.type === "application/pdf";
}

export async function prepareAttachment(file: File): Promise<PreparedAttachment> {
  const fileName = file.name.slice(0, 80);
  if (file.type === "application/pdf") {
    if (file.size > MAX_PDF_BYTES) throw new Error("PDF maior que 3 MB. Envie um arquivo menor.");
    return { kind: "pdf", media_type: "application/pdf", data: await readAsBase64(file), file_name: fileName };
  }
  if (file.type.startsWith("image/")) {
    return { kind: "image", media_type: "image/jpeg", data: await imageToJpegBase64(file), file_name: fileName };
  }
  throw new Error("Formato não aceito. Envie foto (JPG, PNG) ou PDF.");
}

export async function readAttachment(session: Session, file: File): Promise<string> {
  const body = await prepareAttachment(file);
  const { data, error } = await supabase.functions.invoke("ler-anexo", {
    body,
    headers: { Authorization: `Bearer ${session.access_token}` },
  });

  if (error) {
    if (error instanceof FunctionsHttpError) {
      const detail = await error.context.json().catch(() => null);
      if (detail?.error) throw new Error(String(detail.error));
    }
    throw new Error("Não foi possível ler o anexo. Tente de novo.");
  }
  const description = typeof data?.description === "string" ? data.description.trim() : "";
  if (!description) throw new Error("Não foi possível ler o anexo.");
  return description;
}

export function composeMessageWithAttachment(text: string, fileName: string, description: string): string {
  const userText = text.trim().slice(0, MAX_USER_TEXT_WITH_ATTACHMENT);
  const shortName = fileName.length > 40 ? `${fileName.slice(0, 37)}...` : fileName;
  const attachmentPart = `[Anexo: ${shortName}]\n${description.slice(0, 800)}`;
  return [userText, attachmentPart].filter(Boolean).join("\n\n");
}

export function conversationToText(messages: Array<{ role: string; content: string }>): string {
  const date = new Date().toLocaleDateString("pt-BR");
  const lines = messages
    .filter((message) => message.role === "user" || message.role === "assistant")
    .map((message) => `${message.role === "user" ? "Você" : "Medusa"}:\n${message.content.replace(/\*\*/g, "").trim()}`);
  return [`Conversa com a Medusa (${date})`, ...lines].join("\n\n");
}

export async function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.opacity = "0";
  document.body.appendChild(area);
  area.select();
  const ok = document.execCommand("copy");
  document.body.removeChild(area);
  if (!ok) throw new Error("Não foi possível copiar.");
}
