import React, { useEffect, useRef } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useAuth } from "@/hooks/useAuth";
import { useChat } from "@/hooks/useChat";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { ChatInput } from "@/components/chat/ChatInput";
import { Button } from "@/components/ui/Button";
import { colors, spacing, typography } from "@/components/ui/Theme";
import type { EnergyLevel } from "@/types/medusa";

export default function ChatScreen() {
  const { energy: energyParam } = useLocalSearchParams<{ energy: string }>();
  const energy = (Number(energyParam) || 2) as EnergyLevel;

  const { session, profile } = useAuth();
  const listRef = useRef<FlatList>(null);

  const {
    messages,
    loading,
    limitReached,
    interacoesRestantes,
    activeLoop,
    sendMessage,
    endSession,
  } = useChat({
    session: session!,
    energy,
    onboarding: profile?.onboarding ?? null,
    memory: null,
    conversationId: null,
  });

  useEffect(() => {
    if (messages.length > 0) {
      listRef.current?.scrollToEnd({ animated: true });
    }
  }, [messages]);

  async function handleEnd() {
    await endSession();
    router.replace("/app/checkin");
  }

  const energyLabels = { 1: "Energia 1 — Baixa", 2: "Energia 2 — Média", 3: "Energia 3 — Alta" };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Medusa</Text>
          <Text style={styles.headerSub}>{energyLabels[energy]}</Text>
        </View>
        <View style={styles.headerRight}>
          {interacoesRestantes !== null && (
            <Text style={styles.counter}>{interacoesRestantes} restantes</Text>
          )}
          <Button label="Encerrar" variant="ghost" onPress={handleEnd} style={styles.endBtn} />
        </View>
      </View>

      {/* Mensagens */}
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(_, i) => String(i)}
        renderItem={({ item }) => <MessageBubble message={item} />}
        contentContainerStyle={styles.messageList}
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            {energy === 1
              ? "Energia baixa. Uma coisa só. O que é mais urgente?"
              : energy === 2
              ? "Energia média. O que está na cabeça?"
              : "Energia alta. Por onde você quer ir?"}
          </Text>
        }
      />

      {/* Input */}
      {limitReached ? (
        <View style={styles.limitBanner}>
          <Text style={styles.limitText}>
            Você já conversou bastante hoje. Nos falamos amanhã.
          </Text>
        </View>
      ) : (
        <ChatInput onSend={sendMessage} loading={loading} disabled={limitReached} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingTop: spacing.xl + spacing.md,
  },
  headerTitle: { ...typography.subtitle },
  headerSub: { ...typography.caption },
  headerRight: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  counter: { ...typography.caption, color: colors.accent },
  endBtn: { paddingHorizontal: spacing.sm, minHeight: 36 },
  messageList: { paddingVertical: spacing.md },
  emptyText: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: "center",
    padding: spacing.xl,
    paddingTop: spacing.xl * 2,
  },
  limitBanner: {
    padding: spacing.md,
    backgroundColor: colors.bgCard,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  limitText: { ...typography.caption, textAlign: "center" },
});
