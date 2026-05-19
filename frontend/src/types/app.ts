export type PlanType = "free" | "paid";
export type ProviderType = "openai" | "anthropic" | "gemini";
export type ChatMode = "text" | "voice";

export interface User {
  id: string;
  email: string;
  name: string;
  plan: PlanType;
  subscription_status: string;
  is_admin: boolean;
  onboarding_completed: boolean;
  created_at: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface OnboardingQuestion {
  key: string;
  question: string;
}

export interface OnboardingProfile {
  user_id: string;
  answers: Record<string, string>;
  profile_summary: string;
  onboarding_version: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  provider?: string;
  model?: string;
  mode: ChatMode;
  created_at: string;
}

export interface ChatSendResponse {
  conversation_id: string;
  paywall_required: boolean;
  paywall_reason?: string;
  remaining_messages_today?: number;
  assistant_message?: ChatMessage;
}

export interface MemoryItem {
  id: string;
  user_id: string;
  memory_type: string;
  content: string;
  priority: string;
  source: string;
  relevance_score: number;
  created_at: string;
}

export interface SubscriptionStatus {
  plan: PlanType;
  subscription_status: string;
  provider: string;
  renew_at?: string;
  stripe_customer_id?: string;
}

export interface AdminOverview {
  users_total: number;
  users_paid: number;
  users_free: number;
  onboarding_completed: number;
  chat_messages_today: number;
  conversion_rate: number;
}