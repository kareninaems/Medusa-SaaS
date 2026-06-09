import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import type { EnergyLevel, FollowUp, Message, Profile, ProfileOnboarding } from "@/types/medusa";

const FUNCTION_NAME = "claude-proxy";

// ── Perfil ────────────────────────────────────────────────────────────────────

export async function ensureProfile(session: Session): Promise<Profile> {
  const { data: existing } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", session.user.id)
    .maybeSingle();

  if (existing) return existing as Profile;

  const { data, error } = await supabase
    .from("profiles")
    .insert({
      id: session.user.id,
      display_name: session.user.user_metadata?.full_name ?? null,
      subscription_status: "free",
    })
    .select()
    .single();

  if (error) throw error;
  return data as Profile;
}

export async function updateOnboarding(
  userId: string,
  onboarding: Partial<ProfileOnboarding>,
): Promise<void> {
  const { data: current } = await supabase
    .from("profiles")
    .select("onboarding")
    .eq("id", userId)
    .maybeSingle();

  const merged = { ...(current?.onboarding ?? {}), ...onboarding };

  const { error } = await supabase
    .from("profiles")
    .update({ onboarding: merged })
    .eq("id", userId);

  if (error) throw error;
}

export async function updateEnergy(userId: string, energy: EnergyLevel): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({ energy_default: energy })
    .eq("id", userId);
  if (error) throw error;
}

// ── Chat ──────────────────────────────────────────────────────────────────────

export async function callClaudeProxy(
  session: Session,
  payload: {
    messages: Message[];
    energy: EnergyLevel;
    onboarding: ProfileOnboarding | null;
    memory: unknown | null;
    activeLoop?: string | null;
  },
): Promise<{ reply: string; model: string; limitReached?: boolean; interacoesRestantes?: number }> {
  const { data, error } = await supabase.functions.invoke(FUNCTION_NAME, {
    body: payload,
    headers: { Authorization: `Bearer ${session.access_token}` },
  });

  if (error) throw error;
  if (!data?.reply) throw new Error("Edge Function sem resposta válida.");

  return {
    reply: data.reply,
    model: data.model ?? "claude",
    limitReached: data.limitReached ?? false,
    interacoesRestantes: data.interacoesRestantes,
  };
}

// ── Memória ───────────────────────────────────────────────────────────────────

export async function gerarMemoria(
  session: Session,
  conversationId: string | null,
  messages: Message[],
  energy?: EnergyLevel | null,
): Promise<void> {
  if (messages.length < 2) return;
  await supabase.functions.invoke("gerar-memoria", {
    body: { conversation_id: conversationId, messages, energy: energy ?? null },
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
}

// ── Follow-up ─────────────────────────────────────────────────────────────────

export async function getPendingFollowUp(userId: string): Promise<FollowUp | null> {
  const { data } = await supabase
    .from("follow_ups")
    .select("id, task_summary, context, resumo_conversa, status, created_at, user_id")
    .eq("user_id", userId)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (data as FollowUp | null) ?? null;
}

export async function resolveFollowUp(
  id: number,
  status: "done" | "not_done",
): Promise<void> {
  const { error } = await supabase
    .from("follow_ups")
    .update({ status, resolved_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

// ── Stripe ────────────────────────────────────────────────────────────────────

export async function createCheckoutSession(
  session: Session,
  returnUrl: string,
): Promise<string> {
  const { data, error } = await supabase.functions.invoke("stripe-checkout", {
    body: { return_url: returnUrl },
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
  if (error) throw error;
  return data.url as string;
}

export async function createPortalSession(
  session: Session,
  returnUrl: string,
): Promise<string> {
  const { data, error } = await supabase.functions.invoke("stripe-portal", {
    body: { return_url: returnUrl },
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
  if (error) throw error;
  return data.url as string;
}
