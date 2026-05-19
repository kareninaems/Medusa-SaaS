import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  LayoutAnimation,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  UIManager,
  View,
} from "react-native";

import { theme } from "@/src/constants/theme";
import { api } from "@/src/services/api";
import { ChatMessage, ProviderType, User } from "@/src/types/app";
import { Card } from "@/src/components/ui/card";
import { PrimaryButton } from "@/src/components/ui/primary-button";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface ChatScreenProps {
  token: string;
  user: User;
  onRequirePaywall: (reason?: string) => void;
}

export function ChatScreen({ token, user, onRequirePaywall }: ChatScreenProps) {
  const scrollRef = useRef<ScrollView>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [provider, setProvider] = useState<ProviderType>("openai");
  const [conversationId, setConversationId] = useState<string | undefined>(undefined);
  const [remainingFreeMessages, setRemainingFreeMessages] = useState<number | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadHistory = async () => {
      setLoading(true);
      try {
        const history = await api.chatHistory(token);
        setMessages(history);
        if (history.length > 0) {
          setConversationId(history[history.length - 1].id);
        }
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : "Erro ao carregar chat");
      } finally {
        setLoading(false);
      }
    };
    loadHistory();
  }, [token]);

  const appendMessage = (message: ChatMessage) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setMessages((current) => [...current, message]);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 120);
  };

  const sendMessage = async (mode: "text" | "voice") => {
    const content = mode === "voice" ? (input.trim() || "Ativar modo voz") : input.trim();
    if (!content || sending) return;

    setSending(true);
    setError("");

    const userMessage: ChatMessage = {
      id: `local-${Date.now()}`,
      role: "user",
      content,
      mode,
      provider,
      model: undefined,
      created_at: new Date().toISOString(),
    };
    appendMessage(userMessage);
    setInput("");

    try {
      const response = await api.sendChat(token, {
        message: content,
        mode,
        provider,
        conversation_id: conversationId,
      });

      if (response.paywall_required) {
        onRequirePaywall(response.paywall_reason);
        if (typeof response.remaining_messages_today === "number") {
          setRemainingFreeMessages(response.remaining_messages_today);
        }
        return;
      }

      setConversationId(response.conversation_id);
      if (typeof response.remaining_messages_today === "number") {
        setRemainingFreeMessages(response.remaining_messages_today);
      }
      if (response.assistant_message) {
        appendMessage(response.assistant_message);
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Falha ao enviar mensagem");
    } finally {
      setSending(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <Card style={styles.modelCard}>
        <Text style={styles.modelTitle}>Modelo ativo</Text>
        <View style={styles.modelRow}>
          {([
            ["openai", "GPT"],
            ["anthropic", "Claude"],
            ["gemini", "Gemini"],
          ] as Array<[ProviderType, string]>).map(([item, label]) => (
            <PrimaryButton
              key={item}
              label={label}
              variant={provider === item ? "primary" : "ghost"}
              onPress={() => setProvider(item)}
              style={styles.modelButton}
              testID={`chat-provider-${item}`}
            />
          ))}
        </View>
        <Text style={styles.helperText}>
          Plano: {user.plan.toUpperCase()} • Status: {user.subscription_status}
        </Text>
        {user.plan === "free" ? (
          <Text style={styles.helperText}>
            Restante hoje: {typeof remainingFreeMessages === "number" ? remainingFreeMessages : "—"}
          </Text>
        ) : null}
      </Card>

      {loading ? (
        <ActivityIndicator color={theme.colors.brand} style={styles.loading} />
      ) : (
        <ScrollView ref={scrollRef} style={styles.chatList} contentContainerStyle={styles.chatContent}>
          {messages.map((message) => (
            <View
              key={message.id}
              style={[styles.bubble, message.role === "user" ? styles.userBubble : styles.assistantBubble]}
            >
              <Text style={message.role === "user" ? styles.userText : styles.assistantText}>
                {message.content}
              </Text>
            </View>
          ))}
          {messages.length === 0 ? (
            <Text style={styles.emptyText}>Comece com uma pergunta para construir sua memória individual.</Text>
          ) : null}
        </ScrollView>
      )}

      {!!error && <Text style={styles.error}>{error}</Text>}

      <View style={styles.composer}>
        <TextInput
          testID="chat-message-input"
          value={input}
          onChangeText={setInput}
          placeholder="Digite sua mensagem"
          placeholderTextColor={theme.colors.textSecondary}
          style={styles.input}
          multiline
        />
        <Pressable
          onPress={() => sendMessage("voice")}
          style={({ pressed }) => [styles.iconButton, pressed && styles.iconPressed]}
          testID="chat-voice-button"
        >
          <Ionicons name="mic" size={20} color="#fff" />
        </Pressable>
      </View>

      <PrimaryButton
        label="Enviar"
        onPress={() => sendMessage("text")}
        loading={sending}
        testID="chat-send-button"
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: theme.spacing.md,
  },
  modelCard: {
    gap: theme.spacing.sm,
  },
  modelTitle: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: "700",
  },
  modelRow: {
    flexDirection: "row",
    gap: 8,
  },
  modelButton: {
    flex: 1,
    minHeight: 42,
  },
  helperText: {
    color: theme.colors.textSecondary,
    fontSize: 13,
  },
  loading: {
    marginTop: 12,
  },
  chatList: {
    flex: 1,
    borderRadius: 24,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  chatContent: {
    padding: theme.spacing.md,
    gap: 10,
  },
  bubble: {
    maxWidth: "90%",
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  userBubble: {
    alignSelf: "flex-end",
    backgroundColor: theme.colors.brand,
  },
  assistantBubble: {
    alignSelf: "flex-start",
    backgroundColor: theme.colors.surfaceMuted,
  },
  userText: {
    color: "#fff",
    fontSize: 15,
    lineHeight: 22,
  },
  assistantText: {
    color: theme.colors.text,
    fontSize: 15,
    lineHeight: 22,
  },
  emptyText: {
    color: theme.colors.textSecondary,
    textAlign: "center",
    marginTop: 24,
  },
  error: {
    color: theme.colors.danger,
    fontSize: 14,
  },
  composer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  input: {
    flex: 1,
    minHeight: 52,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.pill,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: theme.colors.surface,
    color: theme.colors.text,
  },
  iconButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.colors.accent,
    justifyContent: "center",
    alignItems: "center",
  },
  iconPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.97 }],
  },
});
