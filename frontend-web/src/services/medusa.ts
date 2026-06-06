import type { Session } from "@supabase/supabase-js";

import { PRIVACY_VERSION, TERMS_VERSION } from "../constants/legal";
import { supabase } from "../lib/supabase";
import type {
  ClaudeProxyPayload,
  Conversation,
  EnergyLevel,
  MemoryRow,
  Message,
  Profile,
  ProfileOnboarding,
  UserDocument,
  UserConsent,
} from "../types/medusa";

const functionName = import.meta.env.VITE_SUPABASE_FUNCTION_NAME || "claude-proxy";
export const AGE_CONFIRM_VERSION = "2026-05";
export const DOCUMENT_ANALYSIS_CONSENT_VERSION = "2026-05";
export const DOCUMENT_STORAGE_NOT_READY_MESSAGE =
  "Armazenamento de documentos ainda não configurado. Você pode continuar sem PDF.";
export const DOCUMENT_SCHEMA_UPDATE_REQUIRED_MESSAGE =
  "Atualize o schema de documentos no Supabase para habilitar consentimento por documento.";

const PROFILE_COLUMNS = "*";

function normalizeUserDocument(row: Partial<UserDocument> & Record<string, unknown>): UserDocument {
  return {
    id: String(row.id ?? ""),
    user_id: String(row.user_id ?? ""),
    file_path: String(row.file_path ?? ""),
    file_name: (row.file_name as string | null) ?? null,
    mime_type: (row.mime_type as string | null) ?? null,
    uploaded_at: String(row.uploaded_at ?? new Date().toISOString()),
    analysis_status: (row.analysis_status as UserDocument["analysis_status"] | undefined) ?? "uploaded",
    analysis_consent_at: (row.analysis_consent_at as string | null | undefined) ?? null,
    analysis_consent_version: (row.analysis_consent_version as string | null | undefined) ?? null,
    deleted_at: (row.deleted_at as string | null | undefined) ?? null,
    extracted_summary: (row.extracted_summary as string | null | undefined) ?? null,
  };
}

function generateDocumentId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  const fallback = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx";
  return fallback.replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16);
    const value = char === "x" ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

function mapDocumentUploadError(error: unknown): Error {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const normalized = message.toLowerCase();

  const storageNotConfigured =
    normalized.includes("bucket not found") ||
    normalized.includes("storage") ||
    normalized.includes("relation \"user_documents\" does not exist") ||
    normalized.includes("column user_documents") ||
    normalized.includes("does not exist") ||
    normalized.includes("could not find the table") ||
    normalized.includes("permission denied") ||
    normalized.includes("policy");

  if (storageNotConfigured) {
    return new Error(DOCUMENT_STORAGE_NOT_READY_MESSAGE);
  }

  return new Error(message || DOCUMENT_STORAGE_NOT_READY_MESSAGE);
}

export async function ensureProfile(session: Session): Promise<Profile> {
  const { data: existing, error: fetchError } = await supabase
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .eq("id", session.user.id)
    .maybeSingle();

  if (fetchError) throw fetchError;
  if (existing) return existing as Profile;

  const defaultName = session.user.email?.split("@")[0] ?? "usuario";
  const { data, error } = await supabase
    .from("profiles")
    .insert({
      id: session.user.id,
      display_name: defaultName,
      onboarding: null,
      energy_default: null,
      terms_accepted_at: null,
      privacy_accepted_at: null,
      terms_version: null,
      privacy_version: null,
    })
    .select(PROFILE_COLUMNS)
    .single();

  if (error) throw error;
  return data as Profile;
}

export async function updateOnboarding(
  userId: string,
  displayName: string,
  onboarding: ProfileOnboarding,
): Promise<Profile> {
  const { data, error } = await supabase
    .from("profiles")
    .update({ display_name: displayName, onboarding })
    .eq("id", userId)
    .select(PROFILE_COLUMNS)
    .single();

  if (error) throw error;
  return data as Profile;
}

export async function updateEnergy(userId: string, energy: EnergyLevel): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({ energy_default: energy })
    .eq("id", userId);

  if (error) throw error;
}

export async function confirmAge(userId: string, supportsAgeColumns: boolean): Promise<Profile> {
  const confirmedAt = new Date().toISOString();
  if (supportsAgeColumns) {
    const { data, error } = await supabase
      .from("profiles")
      .update({
        age_confirmed_at: confirmedAt,
        age_confirmed_version: AGE_CONFIRM_VERSION,
      })
      .eq("id", userId)
      .select(PROFILE_COLUMNS)
      .single();

    if (error) throw error;
    return data as Profile;
  }

  const { data: current } = await supabase.from("profiles").select("onboarding").eq("id", userId).maybeSingle();
  const fallbackOnboarding = {
    ...(current?.onboarding ?? {}),
    age_confirmed: true,
    age_confirmed_at: confirmedAt,
  };

  const { data: fallbackData, error: fallbackError } = await supabase
    .from("profiles")
    .update({ onboarding: fallbackOnboarding })
    .eq("id", userId)
    .select(PROFILE_COLUMNS)
    .single();

  if (fallbackError) throw fallbackError;
  return fallbackData as Profile;
}

const ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/png"];

function getFileExtension(mimeType: string): string {
  if (mimeType === "image/jpeg") return ".jpg";
  if (mimeType === "image/png") return ".png";
  return ".pdf";
}

export async function uploadUserDocument(userId: string, file: File): Promise<UserDocument> {
  if (!file || !ALLOWED_TYPES.includes(file.type)) {
    throw new Error("Envie apenas PDF, JPG ou PNG.");
  }

  const generatedId = generateDocumentId();
  const ext = getFileExtension(file.type);
  const filePath = `${userId}/${generatedId}${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("user-documents")
    .upload(filePath, file, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) throw mapDocumentUploadError(uploadError);

  const { data, error } = await supabase
    .from("user_documents")
    .insert({
      user_id: userId,
      file_path: filePath,
      file_name: file.name,
      mime_type: file.type,
      analysis_status: "uploaded",
      extracted_summary: null,
    })
    .select("*")
    .single();

  if (error) {
    await supabase.storage.from("user-documents").remove([filePath]);
    throw mapDocumentUploadError(error);
  }
  return normalizeUserDocument(data as Record<string, unknown>);
}

export async function uploadUserDocuments(userId: string, files: File[]): Promise<UserDocument[]> {
  const results: UserDocument[] = [];
  for (const file of files) {
    const doc = await uploadUserDocument(userId, file);
    results.push(doc);
  }
  return results;
}

export async function listUserDocuments(userId: string): Promise<UserDocument[]> {
  const { data, error } = await supabase
    .from("user_documents")
    .select("*")
    .eq("user_id", userId)
    .order("uploaded_at", { ascending: false });

  if (error) throw error;

  return (data ?? [])
    .map((doc) => normalizeUserDocument(doc as Record<string, unknown>))
    .filter((doc) => !doc.deleted_at);
}

export async function grantDocumentAnalysisConsent(userId: string, documentId: string): Promise<UserDocument> {
  const consentAt = new Date().toISOString();

  const { data: current, error: currentError } = await supabase
    .from("user_documents")
    .select("analysis_status")
    .eq("id", documentId)
    .eq("user_id", userId)
    .single();
  if (currentError) {
    const msg = (currentError.message || "").toLowerCase();
    if (msg.includes("column") || msg.includes("does not exist")) {
      throw new Error(DOCUMENT_SCHEMA_UPDATE_REQUIRED_MESSAGE);
    }
    throw currentError;
  }

  const nextStatus = current?.analysis_status === "analyzed" ? "analyzed" : "awaiting_analysis";

  const { data, error } = await supabase
    .from("user_documents")
    .update({
      analysis_consent_at: consentAt,
      analysis_consent_version: DOCUMENT_ANALYSIS_CONSENT_VERSION,
      analysis_status: nextStatus,
    })
    .eq("id", documentId)
    .eq("user_id", userId)
    .select(
      "id, user_id, file_path, file_name, mime_type, uploaded_at, analysis_status, analysis_consent_at, analysis_consent_version, deleted_at, extracted_summary",
    )
    .single();

  if (error) {
    const msg = (error.message || "").toLowerCase();
    if (msg.includes("column") || msg.includes("does not exist")) {
      throw new Error(DOCUMENT_SCHEMA_UPDATE_REQUIRED_MESSAGE);
    }
    throw error;
  }
  return normalizeUserDocument(data as Record<string, unknown>);
}

export async function analyzeDocument(session: Session, documentId: string): Promise<UserDocument> {
  const { data, error } = await supabase.functions.invoke("analyze-document", {
    body: { document_id: documentId },
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  });

  if (error) {
    const message = (error.message || "").toLowerCase();
    if (message.includes("not found")) {
      throw new Error("Função de análise não encontrada. Faça deploy da Edge Function 'analyze-document'.");
    }
    if (message.includes("cors") || message.includes("failed to fetch") || message.includes("network")) {
      throw new Error("Falha de conexão com a função de análise. Verifique deploy/CORS da Edge Function.");
    }
    throw new Error(error.message || "Falha ao analisar documento");
  }

  if (!data?.document) {
    throw new Error("Resposta inválida da função de análise");
  }

  return normalizeUserDocument(data.document as Record<string, unknown>);
}

export async function triggerDocumentAnalysis(session: Session, documentId: string): Promise<{ ok: boolean }> {
  try {
    const { error } = await supabase.functions.invoke("analyze-document", {
      body: { document_id: documentId },
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });
    if (error) {
      console.error("[triggerDocumentAnalysis] Edge Function error:", error.message);
      return { ok: false };
    }
    return { ok: true };
  } catch (err) {
    console.error("[triggerDocumentAnalysis] Unexpected error:", err);
    return { ok: false };
  }
}

export async function deleteUserDocument(userId: string, document: Pick<UserDocument, "id" | "file_path">): Promise<void> {
  const { error: storageError } = await supabase.storage.from("user-documents").remove([document.file_path]);

  const storageMessage = storageError?.message?.toLowerCase() ?? "";
  const canIgnoreStorageError =
    storageMessage.includes("not found") || storageMessage.includes("object") || storageMessage.includes("no rows found");
  if (storageError && !canIgnoreStorageError) {
    throw storageError;
  }

  const { error } = await supabase
    .from("user_documents")
    .delete()
    .eq("id", document.id)
    .eq("user_id", userId);

  if (error) throw error;
}

export async function ensureConversation(userId: string): Promise<Conversation> {
  const { data: existing, error: fetchError } = await supabase
    .from("conversations")
    .select("id, user_id, created_at, title")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (fetchError) throw fetchError;
  if (existing) return existing as Conversation;

  const { data, error } = await supabase
    .from("conversations")
    .insert({
      user_id: userId,
      title: "Sessão Medusa",
    })
    .select("id, user_id, created_at, title")
    .single();

  if (error) throw error;
  return data as Conversation;
}

export async function getLatestConversation(userId: string): Promise<Conversation | null> {
  const { data, error } = await supabase
    .from("conversations")
    .select("id, user_id, created_at, title")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return (data as Conversation | null) ?? null;
}

export async function createConversation(userId: string, title = "Sessão Medusa"): Promise<Conversation> {
  const { data, error } = await supabase
    .from("conversations")
    .insert({
      user_id: userId,
      title,
    })
    .select("id, user_id, created_at, title")
    .single();

  if (error) throw error;
  return data as Conversation;
}

export async function getConversationById(userId: string, conversationId: string): Promise<Conversation | null> {
  const { data, error } = await supabase
    .from("conversations")
    .select("id, user_id, created_at, title")
    .eq("id", conversationId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return (data as Conversation | null) ?? null;
}

export async function getPreviousConversation(
  userId: string,
  currentConversationId?: string | null,
): Promise<Conversation | null> {
  let query = supabase
    .from("conversations")
    .select("id, user_id, created_at, title")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(6);

  if (currentConversationId) {
    query = query.neq("id", currentConversationId);
  }

  const { data, error } = await query;

  if (error) throw error;
  const rows = (data as Conversation[] | null) ?? [];
  return rows[0] ?? null;
}

export async function getMessages(conversationId: string): Promise<Message[]> {
  const { data, error } = await supabase
    .from("messages")
    .select("id, conversation_id, user_id, role, content, energy, mode, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data ?? []) as Message[];
}

export async function getLatestAssistantMessage(conversationId: string): Promise<Message | null> {
  const { data, error } = await supabase
    .from("messages")
    .select("id, conversation_id, user_id, role, content, energy, mode, created_at")
    .eq("conversation_id", conversationId)
    .eq("role", "assistant")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return (data as Message | null) ?? null;
}

export async function getRecentMessagesByUser(userId: string, days = 7): Promise<Message[]> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("messages")
    .select("id, conversation_id, user_id, role, content, energy, mode, created_at")
    .eq("user_id", userId)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(300);

  if (error) throw error;
  return (data ?? []) as Message[];
}

export async function insertMessage(input: {
  conversation_id: string;
  user_id: string;
  role: "user" | "assistant";
  content: string;
  energy: number;
  mode: string;
}): Promise<Message> {
  const { data, error } = await supabase
    .from("messages")
    .insert(input)
    .select("id, conversation_id, user_id, role, content, energy, mode, created_at")
    .single();

  if (error) throw error;
  return data as Message;
}

export async function getMemory(userId: string): Promise<MemoryRow | null> {
  const { data, error } = await supabase
    .from("memories")
    .select("id, user_id, patterns, triggers, worked, didnt_work, context, updated_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return (data as MemoryRow | null) ?? null;
}

export async function upsertMemory(
  userId: string,
  payload: Omit<MemoryRow, "id" | "updated_at" | "user_id">,
): Promise<MemoryRow> {
  const { data, error } = await supabase
    .from("memories")
    .upsert(
      {
        user_id: userId,
        patterns: payload.patterns,
        triggers: payload.triggers,
        worked: payload.worked,
        didnt_work: payload.didnt_work,
        context: payload.context,
      },
      { onConflict: "user_id" },
    )
    .select("id, user_id, patterns, triggers, worked, didnt_work, context, updated_at")
    .single();

  if (error) throw error;
  return data as MemoryRow;
}

export async function createCheckoutSession(session: Session): Promise<{ url: string }> {
  const { data, error } = await supabase.functions.invoke("stripe-checkout", {
    body: {},
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  });

  if (error) {
    const detail = (data as { detail?: string } | null)?.detail;
    throw new Error(detail || error.message || "Falha ao criar sessao de checkout");
  }

  if (!data?.url) {
    const d = data as Record<string, unknown> | null;
    const detail = (d?.detail as string) || (d?.error as string);
    const debugInfo = d ? JSON.stringify(d) : "data=null";
    throw new Error(detail || `Resposta invalida do checkout Stripe [${debugInfo}]`);
  }

  return { url: data.url as string };
}

export async function createPortalSession(session: Session): Promise<{ url: string }> {
  const { data, error } = await supabase.functions.invoke("stripe-portal", {
    body: {},
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  });

  if (error) {
    const detail = (data as { detail?: string } | null)?.detail;
    throw new Error(detail || error.message || "Falha ao abrir portal de assinatura");
  }

  if (!data?.url) {
    const detail = (data as { error?: string; detail?: string } | null)?.detail || (data as { error?: string } | null)?.error;
    throw new Error(detail || "Resposta invalida do portal Stripe");
  }

  return { url: data.url as string };
}

export async function sendLoopFeedback(
  session: Session,
  loop: string,
  triggeredIndices: number[],
  energyLevel: number,
  positive: boolean,
): Promise<void> {
  await supabase.functions.invoke("loop-feedback", {
    body: { loop, triggeredIndices, energyLevel, positive },
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
}

export async function callClaudeProxy(
  session: Session,
  payload: ClaudeProxyPayload,
): Promise<{ reply: string; model: string }> {
  const { data, error } = await supabase.functions.invoke(functionName, {
    body: payload,
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  });

  if (error) throw error;
  if (!data?.reply) {
    throw new Error("Edge Function retornou sem resposta válida.");
  }

  return {
    reply: data.reply,
    model: data?.model ?? "claude",
  };
}

export interface FollowUpResult {
  has_task: boolean;
  task_summary: string | null;
  context: string;
}

export async function extractFollowUp(
  session: Session,
  conversationId: string | null,
  messages: Array<{ role: string; content: string }>,
): Promise<FollowUpResult> {
  const { data, error } = await supabase.functions.invoke("extract-followup", {
    body: { conversation_id: conversationId, messages },
    headers: { Authorization: `Bearer ${session.access_token}` },
  });

  if (error || !data) return { has_task: false, task_summary: null, context: "" };
  return data as FollowUpResult;
}

export async function getPendingFollowUp(userId: string): Promise<{ id: number; task_summary: string; context: string | null } | null> {
  const { data, error } = await supabase
    .from("follow_ups")
    .select("id, task_summary, context")
    .eq("user_id", userId)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return data as { id: number; task_summary: string; context: string | null };
}

export async function resolveFollowUp(followUpId: number, status: "done" | "not_done"): Promise<void> {
  const { error } = await supabase
    .from("follow_ups")
    .update({ status, resolved_at: new Date().toISOString() })
    .eq("id", followUpId);

  if (error) throw error;
}

export async function resetUserData(userId: string): Promise<void> {
  const { error: deleteMessagesError } = await supabase
    .from("messages")
    .delete()
    .eq("user_id", userId);
  if (deleteMessagesError) throw deleteMessagesError;

  const { error: deleteConversationsError } = await supabase
    .from("conversations")
    .delete()
    .eq("user_id", userId);
  if (deleteConversationsError) throw deleteConversationsError;

  const { error: deleteMemoryError } = await supabase.from("memories").delete().eq("user_id", userId);
  if (deleteMemoryError) throw deleteMemoryError;

  const { data: docsToDelete, error: docsFetchError } = await supabase
    .from("user_documents")
    .select("file_path")
    .eq("user_id", userId);
  if (docsFetchError) throw docsFetchError;

  if (docsToDelete && docsToDelete.length > 0) {
    const paths = docsToDelete.map((doc) => doc.file_path).filter(Boolean);
    if (paths.length > 0) {
      await supabase.storage.from("user-documents").remove(paths);
    }
  }

  const { error: deleteDocumentsError } = await supabase.from("user_documents").delete().eq("user_id", userId);
  if (deleteDocumentsError) throw deleteDocumentsError;

  const { error: resetProfileError } = await supabase
    .from("profiles")
    .update({ onboarding: null, energy_default: null })
    .eq("id", userId);
  if (resetProfileError) throw resetProfileError;
}

export async function recordUserConsent(input: {
  userId: string;
  userAgent?: string;
}): Promise<UserConsent> {
  const acceptedAt = new Date().toISOString();

  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      terms_accepted_at: acceptedAt,
      privacy_accepted_at: acceptedAt,
      terms_version: TERMS_VERSION,
      privacy_version: PRIVACY_VERSION,
    })
    .eq("id", input.userId);

  if (profileError) throw profileError;

  const { data, error } = await supabase
    .from("user_consents")
    .insert({
      user_id: input.userId,
      terms_version: TERMS_VERSION,
      privacy_version: PRIVACY_VERSION,
      accepted_at: acceptedAt,
      ip_hash: null,
      user_agent: input.userAgent ?? null,
    })
    .select("id, user_id, terms_version, privacy_version, accepted_at, ip_hash, user_agent")
    .single();

  if (error) throw error;
  return data as UserConsent;
}

export function needsConsent(profile: Profile): boolean {
  return !profile.terms_accepted_at || !profile.privacy_accepted_at;
}

export function parseLinesToArray(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export function joinArrayToLines(value: string[] | null | undefined): string {
  return value?.join("\n") ?? "";
}
