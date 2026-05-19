import type { Session } from "@supabase/supabase-js";

import { supabase } from "../lib/supabase";
import type {
  ClaudeProxyPayload,
  Conversation,
  EnergyLevel,
  MemoryRow,
  Message,
  Profile,
  ProfileOnboarding,
} from "../types/medusa";

const functionName = import.meta.env.VITE_SUPABASE_FUNCTION_NAME || "claude-proxy";

export async function ensureProfile(session: Session): Promise<Profile> {
  const { data: existing, error: fetchError } = await supabase
    .from("profiles")
    .select("id, created_at, display_name, onboarding, energy_default")
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
    })
    .select("id, created_at, display_name, onboarding, energy_default")
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
    .select("id, created_at, display_name, onboarding, energy_default")
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
  return {
    reply: data?.reply ?? "Sem resposta da Medusa.",
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

  const { error: resetProfileError } = await supabase
    .from("profiles")
    .update({ onboarding: null, energy_default: null })
    .eq("id", userId);
  if (resetProfileError) throw resetProfileError;
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
