import { useCallback, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { callClaudeProxy, gerarMemoria } from "@/services/medusa";
import { detectLoop } from "@/lib/loopDetector";
import type { EnergyLevel, Message, ProfileOnboarding } from "@/types/medusa";

interface UseChatOptions {
  session: Session;
  energy: EnergyLevel;
  onboarding: ProfileOnboarding | null;
  memory: unknown | null;
  conversationId: string | null;
}

export function useChat({ session, energy, onboarding, memory, conversationId }: UseChatOptions) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [limitReached, setLimitReached] = useState(false);
  const [interacoesRestantes, setInteracoesRestantes] = useState<number | null>(null);

  const userTexts = messages.filter((m) => m.role === "user").map((m) => m.content);
  const energyLog = [energy];
  const loopResult = detectLoop(userTexts, energyLog);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || loading) return;

      const newMessages: Message[] = [...messages, { role: "user", content: text }];
      setMessages(newMessages);
      setLoading(true);

      try {
        const result = await callClaudeProxy(session, {
          messages: newMessages,
          energy,
          onboarding,
          memory,
          activeLoop: loopResult.loop,
        });

        setMessages((prev) => [...prev, { role: "assistant", content: result.reply }]);
        if (result.limitReached) setLimitReached(true);
        if (result.interacoesRestantes !== undefined) {
          setInteracoesRestantes(result.interacoesRestantes);
        }
      } finally {
        setLoading(false);
      }
    },
    [messages, loading, session, energy, onboarding, memory, loopResult.loop],
  );

  const endSession = useCallback(async () => {
    if (messages.length >= 2) {
      await gerarMemoria(session, conversationId, messages, energy).catch(() => {});
    }
    setMessages([]);
    setLimitReached(false);
  }, [messages, session, conversationId, energy]);

  return {
    messages,
    loading,
    limitReached,
    interacoesRestantes,
    activeLoop: loopResult.loop,
    sendMessage,
    endSession,
    setMessages,
  };
}
