import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing, typography } from "@/components/ui/Theme";
import type { Message } from "@/types/medusa";

export function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";
  return (
    <View style={[styles.wrapper, isUser ? styles.wrapperUser : styles.wrapperAssistant]}>
      <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAssistant]}>
        <Text style={[styles.text, isUser && styles.textUser]}>{message.content}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginVertical: spacing.xs, paddingHorizontal: spacing.md },
  wrapperUser: { alignItems: "flex-end" },
  wrapperAssistant: { alignItems: "flex-start" },
  bubble: {
    maxWidth: "82%",
    padding: spacing.sm + 4,
    borderRadius: radius.lg,
  },
  bubbleUser: {
    backgroundColor: colors.accent,
    borderBottomRightRadius: radius.sm,
  },
  bubbleAssistant: {
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderBottomLeftRadius: radius.sm,
  },
  text: { ...typography.body },
  textUser: { color: "#fff" },
});
