export type EnergyLevel = 1 | 2 | 3;
export type MedusaMode = "ACAO" | "FOCO" | "PROCESSO" | "TRAVA";

export interface ProfileOnboarding {
  education_level: string;
  profession: string;
  constraints: string;
  blockers: string;
  low_energy_works: string;
  guidance_style: string;
  known_patterns: string;
  never_do: string;
  routine: {
    days: string[];
    start_time: string;
    end_time: string;
    variable_schedule: boolean;
    notes: string;
  };
}

export interface Profile {
  id: string;
  created_at: string;
  display_name: string | null;
  onboarding: ProfileOnboarding | null;
  energy_default: EnergyLevel | null;
  terms_accepted_at: string | null;
  privacy_accepted_at: string | null;
  terms_version: string | null;
  privacy_version: string | null;
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
}
