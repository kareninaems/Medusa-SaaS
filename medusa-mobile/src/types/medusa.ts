export type EnergyLevel = 1 | 2 | 3;
export type MedusaMode = "ACAO" | "FOCO" | "PROCESSO" | "TRAVA";
export type SubscriptionStatus =
  | "free"
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "incomplete";

export interface ProfileOnboarding {
  display_name?: string | null;
  gender?: string | null;
  gender_other?: string | null;
  education_level?: string;
  profession_category?: string;
  profession_other?: string | null;
  guidance_style?: string;
  routine?: { days: string[]; periods: string[]; notes: string };
  name?: string;
  identifications?: string[];
  identification_other?: string | null;
  in_treatment?: "sim" | "nao" | "prefiro nao responder" | null;
  daily_difficulties?: string[];
  instruction_preference?: string | null;
  deadline_reaction?: string | null;
  blockers?: string[];
  unblockers?: string[];
  energy_period?: string | null;
  medusa_goals?: string[];
  constraints?: string[];
  low_energy_works?: string[];
  never_do?: string[];
  response_style?: string;
  known_patterns?: string[];
  triggers?: string[];
  works?: string[];
  does_not_work?: string[];
  contexto_trabalho?: string | null;
  principais_desafios?: string | null;
}

export interface Profile {
  id: string;
  created_at: string;
  display_name: string | null;
  role?: "user" | "admin";
  onboarding: ProfileOnboarding | null;
  onboarding_step?: number;
  energy_default: EnergyLevel | null;
  subscription_status: SubscriptionStatus | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  terms_accepted_at: string | null;
  terms_version: string | null;
  privacy_accepted_at: string | null;
  privacy_version: string | null;
  ultimo_contexto?: string | null;
  memoria_consolidada?: unknown[] | null;
}

export interface Message {
  role: "user" | "assistant";
  content: string;
}

export interface FollowUp {
  id: number;
  user_id: string;
  task_summary: string;
  context: string | null;
  resumo_conversa?: string | null;
  status: "pending" | "done" | "not_done" | "expired";
  created_at: string;
}
