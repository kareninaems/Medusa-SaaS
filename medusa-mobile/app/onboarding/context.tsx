import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Button } from "@/components/ui/Button";
import { colors, spacing, typography } from "@/components/ui/Theme";

export default function ContextScreen() {
  const { name } = useLocalSearchParams<{ name: string }>();
  const [context, setContext] = useState("");

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Text style={styles.title}>Oi, {name}!</Text>
      <Text style={styles.sub}>
        Me conta um pouco sobre o que você faz. Trabalho, projetos, área de atuação — o que vier.
      </Text>

      <TextInput
        style={styles.input}
        value={context}
        onChangeText={setContext}
        placeholder="Ex: sou dev freelancer, tenho projetos pessoais e trabalho como analista..."
        placeholderTextColor={colors.textMuted}
        multiline
        maxLength={500}
        autoFocus
      />

      <Button
        label="Continuar"
        onPress={() =>
          router.push({ pathname: "/onboarding/challenges", params: { name, context } })
        }
        disabled={!context.trim()}
        style={styles.btn}
      />
      <Button
        label="Pular"
        variant="ghost"
        onPress={() =>
          router.push({ pathname: "/onboarding/challenges", params: { name, context: "" } })
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
