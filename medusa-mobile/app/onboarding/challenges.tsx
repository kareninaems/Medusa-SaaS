import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Button } from "@/components/ui/Button";
import { colors, spacing, typography } from "@/components/ui/Theme";

export default function ChallengesScreen() {
  const { name, context } = useLocalSearchParams<{ name: string; context: string }>();
  const [challenges, setChallenges] = useState("");

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Text style={styles.title}>O que mais trava você?</Text>
      <Text style={styles.sub}>
        Procrastinação, foco, sobrecarga, clareza de prioridades? Pode ser mais de um.
      </Text>

      <TextInput
        style={styles.input}
        value={challenges}
        onChangeText={setChallenges}
        placeholder="Ex: fico travado em tarefas grandes, perco o fio entre sessões..."
        placeholderTextColor={colors.textMuted}
        multiline
        maxLength={500}
        autoFocus
      />

      <Button
        label="Continuar"
        onPress={() =>
          router.push({
            pathname: "/onboarding/finish",
            params: { name, context, challenges },
          })
        }
        disabled={!challenges.trim()}
        style={styles.btn}
      />
      <Button
        label="Pular"
        variant="ghost"
        onPress={() =>
          router.push({
            pathname: "/onboarding/finish",
            params: { name, context, challenges: "" },
          })
        }
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    padding: spacing.xl,
    justifyContent: "center",
    gap: spacing.md,
  },
  title: { ...typography.title },
  sub: { ...typography.body, color: colors.textMuted },
  input: {
    backgroundColor: colors.bgInput,
    borderRadius: 10,
    padding: spacing.md,
    color: colors.text,
    fontSize: 15,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 120,
    textAlignVertical: "top",
  },
  btn: { marginTop: spacing.sm },
});
