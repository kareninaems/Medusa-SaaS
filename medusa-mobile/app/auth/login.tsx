import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from "react-native";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/Button";
import { colors, spacing, typography } from "@/components/ui/Theme";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"login" | "signup">("login");

  async function handleSubmit() {
    setError(null);
    setLoading(true);
    try {
      if (mode === "login") {
        const { error: e } = await supabase.auth.signInWithPassword({ email, password });
        if (e) throw e;
      } else {
        const { error: e } = await supabase.auth.signUp({ email, password });
        if (e) throw e;
        setError("Verifique seu email para confirmar o cadastro.");
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro ao autenticar.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Text style={styles.title}>🐙 Medusa</Text>
      <Text style={styles.subtitle}>
        {mode === "login" ? "Entrar na conta" : "Criar conta"}
      </Text>

      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor={colors.textMuted}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <TextInput
        style={styles.input}
        placeholder="Senha"
        placeholderTextColor={colors.textMuted}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      {error && <Text style={styles.error}>{error}</Text>}

      <Button
        label={mode === "login" ? "Entrar" : "Cadastrar"}
        onPress={handleSubmit}
        loading={loading}
        style={{ marginTop: spacing.sm }}
      />
      <Button
        label={mode === "login" ? "Não tenho conta" : "Já tenho conta"}
        variant="ghost"
        onPress={() => { setMode(mode === "login" ? "signup" : "login"); setError(null); }}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    justifyContent: "center",
    padding: spacing.xl,
    gap: spacing.sm,
  },
  title: { fontSize: 36, textAlign: "center", marginBottom: spacing.xs },
  subtitle: { ...typography.subtitle, textAlign: "center", marginBottom: spacing.lg },
  input: {
    backgroundColor: colors.bgInput,
    borderRadius: 10,
    padding: spacing.md,
    color: colors.text,
    fontSize: 15,
    borderWidth: 1,
    borderColor: colors.border,
  },
  error: { color: colors.danger, fontSize: 13, textAlign: "center" },
});
