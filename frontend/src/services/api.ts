import Constants from "expo-constants";

import {
  AdminOverview,
  AuthResponse,
  ChatMessage,
  ChatSendResponse,
  MemoryItem,
  OnboardingProfile,
  OnboardingQuestion,
  ProviderType,
  SubscriptionStatus,
} from "@/src/types/app";

const expoExtra =
  (Constants.expoConfig?.extra as { EXPO_PUBLIC_BACKEND_URL?: string }) ?? {};

const backendBaseRaw =
  expoExtra.EXPO_PUBLIC_BACKEND_URL ?? process.env.EXPO_PUBLIC_BACKEND_URL ?? "";

const backendBase = backendBaseRaw.endsWith("/")
  ? backendBaseRaw.slice(0, -1)
  : backendBaseRaw;

const apiBase = `${backendBase}/api`;

async function request<T>(
  path: string,
  options: RequestInit = {},
  token?: string,
): Promise<T> {
  if (!backendBase) {
    throw new Error("Backend URL não configurada");
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${apiBase}${path}`, {
    ...options,
    headers,
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : {};

  if (!response.ok) {
    const message = data?.detail || data?.message || "Erro de requisição";
    throw new Error(String(message));
  }

  return data as T;
}

export const api = {
  async register(email: string, password: string, name: string) {
    return request<AuthResponse>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password, name }),
    });
  },

  async login(email: string, password: string) {
    return request<AuthResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  },

  async me(token: string) {
    return request<AuthResponse["user"]>("/auth/me", {}, token);
  },

  async requestPasswordReset(email: string) {
    return request<{ message: string; reset_code?: string }>(
      "/auth/request-password-reset",
      {
        method: "POST",
        body: JSON.stringify({ email }),
      },
    );
  },

  async confirmPasswordReset(email: string, code: string, newPassword: string) {
    return request<{ message: string }>("/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ email, code, new_password: newPassword }),
    });
  },

  async getOnboardingQuestions() {
    const result = await request<{ questions: OnboardingQuestion[] }>(
      "/onboarding/questions",
    );
    return result.questions;
  },

  async saveOnboarding(
    token: string,
    answers: Record<string, string>,
  ): Promise<OnboardingProfile> {
    return request<OnboardingProfile>(
      "/onboarding/profile",
      {
        method: "POST",
        body: JSON.stringify({ answers, onboarding_version: "v1" }),
      },
      token,
    );
  },

  async getOnboarding(token: string) {
    return request<OnboardingProfile | null>("/onboarding/profile", {}, token);
  },

  async chatHistory(token: string) {
    return request<ChatMessage[]>("/chat/history", {}, token);
  },

  async sendChat(
    token: string,
    payload: {
      message: string;
      mode: "text" | "voice";
      provider: ProviderType;
      conversation_id?: string;
    },
  ) {
    return request<ChatSendResponse>(
      "/chat/send",
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
      token,
    );
  },

  async listMemory(token: string) {
    return request<MemoryItem[]>("/memory", {}, token);
  },

  async addMemory(
    token: string,
    payload: { memory_type: string; content: string; priority: string },
  ) {
    return request<MemoryItem>(
      "/memory",
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
      token,
    );
  },

  async subscriptionStatus(token: string) {
    return request<SubscriptionStatus>("/subscription/me", {}, token);
  },

  async checkout(token: string) {
    return request<{ checkout_url: string; session_id: string }>(
      "/subscription/checkout",
      {
        method: "POST",
        body: JSON.stringify({}),
      },
      token,
    );
  },

  async billingPortal(token: string) {
    return request<{ portal_url: string }>(
      "/subscription/portal",
      {
        method: "POST",
        body: JSON.stringify({}),
      },
      token,
    );
  },

  async adminOverview(token: string) {
    return request<AdminOverview>("/admin/overview", {}, token);
  },

  async adminUsers(token: string) {
    return request<AuthResponse["user"][]>("/admin/users", {}, token);
  },

  async adminEvents(token: string) {
    return request<Array<{ id: string; event_type: string; created_at: string }>>(
      "/admin/events",
      {},
      token,
    );
  },

  async adminUpdatePlan(
    token: string,
    userId: string,
    plan: "free" | "paid",
    subscriptionStatus: "inactive" | "active" | "trialing" | "past_due" | "canceled",
  ) {
    return request<{ message: string }>(
      `/admin/users/${userId}/plan`,
      {
        method: "PATCH",
        body: JSON.stringify({ plan, subscription_status: subscriptionStatus }),
      },
      token,
    );
  },

  async exportAccount(token: string) {
    return request<Record<string, unknown>>("/account/export", {}, token);
  },

  async deleteAccount(token: string) {
    return request<{ message: string }>(
      "/account/delete",
      {
        method: "DELETE",
      },
      token,
    );
  },
};
