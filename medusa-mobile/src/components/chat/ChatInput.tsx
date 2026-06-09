import React, { useState } from "react";
import { ActivityIndicator, StyleSheet, TextInput, TouchableOpacity, View } from "react-native";
import { colors, radius, spacing } from "@/components/ui/Theme";

interface ChatInputProps {
  onSend: (text: string) => void;
  loading: boolean;
  disabled?: boolean;
}

export function ChatInput({ onSend, loading, disabled }: ChatInputProps) {
  const [text, setText] = useState("");

  function handleSend() {
    if (!text.trim() || loading) return;
    onSend(text.trim());
    setText("");
  }

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        value={text}
        onChangeText={setText}
        placeholder="Descreva o que está pegando agora."
        placeholderTextColor={colors.textMuted}
        multiline
        maxLength={1500}
        editable={!disabled && !loading}
        onSubmitEditing={handleSend}
      />
      <TouchableOpacity
        style={[styles.sendBtn, (!text.trim() || loading || disabled) && styles.sendBtnDisabled]}
        onPress={handleSend}
        disabled={!text.trim() || loading || disabled}
      >
        {loading
          ? <ActivityIndicator color={colors.accent} size="small" />
          : <SendIcon />}
      </TouchableOpacity>
    </View>
  );
}

function SendIcon() {
  return (
    // Seta simples em SVG — substituir por ícone do @expo/vector-icons se preferir
    <View style={styles.icon} />
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "flex-end",
    padding: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.bg,
    gap: spacing.xs,
  },
  input: {
    flex: 1,
    backgroundColor: colors.bgInput,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.text,
    fontSize: 15,
    maxHeight: 120,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: { opacity: 0.4 },
  icon: { width: 0, height: 0, borderLeftWidth: 10, borderLeftColor: "#fff", borderTopWidth: 6, borderTopColor: "transparent", borderBottomWidth: 6, borderBottomColor: "transparent", marginLeft: 2 },
});
