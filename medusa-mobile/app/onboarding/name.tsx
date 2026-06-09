import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput } from "react-native";
import { router } from "expo-router";
import { Button } from "@/components/ui/Button";
import { colors, spacing, typography } from "@/components/ui/Theme";

export default function NameScreen() {
  const [name, setName] = useState("");

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Text style={styles.title}>Como posso te chamar?</Text>
      <Text style={styles.sub}>Pode ser seu primeiro nome, apelido — o que você preferir.</Text>

      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder="Seu nome"
        placeholderTextColor={colors.textMuted}
        autoFocus
        maxLength={40}
        returnKeyType="next"
      />

      <Button
        label="Continuar"
        onPress={() => router.push({ pathname: "/onboarding/context", params: { name } })}
        disabled={!name.trim()}
        style={styles.btn}
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
    fontSize: 18,
    borderWidth: 1,
    borderColor: colors.border,
  },
  btn: { marginTop: spacing.sm },
});
