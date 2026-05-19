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

export async function uploadUserDocument(userId: string, file: File): Promise<UserDocument> {
  if (!file || file.type !== "application/pdf") {
    throw new Error("Envie apenas arquivo PDF.");
  }

  const generatedId = generateDocumentId();
  const filePath = `${userId}/${generatedId}.pdf`;

  const { error: uploadError } = await supabase.storage
    .from("user-documents")
    .upload(filePath, file, {
      contentType: "application/pdf",
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
      analysis_consent_at: null,
      analysis_consent_version: null,
      deleted_at: null,
      extracted_summary: null,
    })
    .select(
      "id, user_id, file_path, file_name, mime_type, uploaded_at, analysis_status, analysis_consent_at, analysis_consent_version, deleted_at, extracted_summary",
    )
    .single();

  if (error) {
    const fallbackMessage = (error.message || "").toLowerCase();
    const missingColumns = fallbackMessage.includes("column user_documents") || fallbackMessage.includes("does not exist");

    if (!missingColumns) {
      await supabase.storage.from("user-documents").remove([filePath]);
      throw mapDocumentUploadError(error);
    }

    const { data: fallbackData, error: fallbackError } = await supabase
      .from("user_documents")
      .insert({
        user_id: userId,
        file_path: filePath,
        file_name: file.name,
        mime_type: file.type,
        extracted_summary: null,
      })
      .select("id, user_id, file_path, file_name, mime_type, uploaded_at, extracted_summary")
      .single();

    if (fallbackError) {
      await supabase.storage.from("user-documents").remove([filePath]);
      throw mapDocumentUploadError(fallbackError);
    }

    return {
      ...(fallbackData as Omit<UserDocument, "analysis_status" | "analysis_consent_at" | "analysis_consent_version" | "deleted_at">),
      analysis_status: "uploaded",
      analysis_consent_at: null,
      analysis_consent_version: null,
      deleted_at: null,
    } as UserDocument;
  }
  return data as UserDocument;
}

export async function listUserDocuments(userId: string): Promise<UserDocument[]> {
  const { data, error } = await supabase
    .from("user_documents")
    .select(
      "id, user_id, file_path, file_name, mime_type, uploaded_at, analysis_status, analysis_consent_at, analysis_consent_version, deleted_at, extracted_summary",
    )
    .eq("user_id", userId)
    .is("deleted_at", null)
    .order("uploaded_at", { ascending: false });

  if (!error) return (data ?? []) as UserDocument[];

  const message = (error.message || "").toLowerCase();
  const missingColumns = message.includes("column user_documents") || message.includes("does not exist");
  if (!missingColumns) throw error;

  const { data: fallbackData, error: fallbackError } = await supabase
    .from("user_documents")
    .select("id, user_id, file_path, file_name, mime_type, uploaded_at, extracted_summary")
    .eq("user_id", userId)
    .order("uploaded_at", { ascending: false });

  if (fallbackError) throw fallbackError;

  return (fallbackData ?? []).map((doc) => ({
    ...(doc as Omit<UserDocument, "analysis_status" | "analysis_consent_at" | "analysis_consent_version" | "deleted_at">),
    analysis_status: "uploaded",
    analysis_consent_at: null,
    analysis_consent_version: null,
    deleted_at: null,
  })) as UserDocument[];
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
  return data as UserDocument;
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

export async function getMessages(conversationId: string): Promise<Message[]> {
  const { data, error } = await supabase
    .from("messages")
    .select("id, conversation_id, user_id, role, content, energy, mode, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

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
