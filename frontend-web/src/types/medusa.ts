export type EnergyLevel = 1 | 2 | 3;
export type MedusaMode = "ACAO" | "FOCO" | "PROCESSO" | "TRAVA";

export interface ProfileOnboarding {
  display_name?: string | null;
  gender: string | null;
  gender_other: string | null;
  education_level: string;
  education_level_other: string | null;
  profession_category: string;
  profession_other: string | null;
  constraints: string[];
  constraints_other: string | null;
  blockers: string[];
  blockers_other: string | null;
  low_energy_works: string[];
  low_energy_works_other: string | null;
  guidance_style: string;
  never_do: string[];
  never_do_other: string | null;
  routine: {
    days: string[];
    periods: string[];
    notes: string;
  };
  age_confirmed?: boolean;
  age_confirmed_at?: string;
}

export type SubscriptionStatus = "free" | "trialing" | "active" | "past_due" | "canceled" | "incomplete";

export interface Profile {
  id: string;
  created_at: string;
  display_name: string | null;
  onboarding: ProfileOnboarding | null;
  energy_default: EnergyLevel | null;
  age_confirmed_at: string | null;
  age_confirmed_version: string | null;
  terms_accepted_at: string | null;
  privacy_accepted_at: string | null;
  terms_version: string | null;
  privacy_version: string | null;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  subscription_status?: SubscriptionStatus;
}

export interface UserDocument {
  id: string;
  user_id: string;
  file_path: string;
  file_name: string | null;
  mime_type: string | null;
  uploaded_at: string;
  analysis_status: "uploaded" | "awaiting_analysis" | "analyzing" | "analyzed" | "error";
  analysis_consent_at: string | null;
  analysis_consent_version: string | null;
  deleted_at: string | null;
  extracted_summary: string | null;
}

export interface UserConsent {
  id: string;
  user_id: string;
  terms_version: string;
  privacy_version: string;
  accepted_at: string;
  ip_hash: string | null;
  user_agent: string | null;
}

export interface Conversation {
  id: string;
  user_id: string;
  created_at: string;
  title: string | null;
}

export interface Message {
  id: string;
  conversation_id: string;
  user_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  energy: number | null;
  mode: string | null;
  created_at: string;
}

export interface MemoryRow {
  id: string;
  user_id: string;
  patterns: string[];
  triggers: string[];
  worked: string[];
  didnt_work: string[];
  context: string[] | Record<string, unknown>;
  updated_at: string;
}

export interface ClaudeProxyPayload {
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  energy: EnergyLevel;
  mode: MedusaMode;
  onboarding: ProfileOnboarding | null;
  memory: MemoryRow | null;
  activeLoop?: string | null;
  documents?: Array<{
    id: string;
    file_name: string;
    extracted_summary: string | null;
    analysis_consent_at: string;
    analysis_consent_version: string | null;
  }>;
}
