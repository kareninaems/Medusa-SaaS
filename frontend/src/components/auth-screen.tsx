import { useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { theme } from "@/src/constants/theme";
import { api } from "@/src/services/api";
import { User } from "@/src/types/app";
import { Card } from "@/src/components/ui/card";
import { PrimaryButton } from "@/src/components/ui/primary-button";

type AuthMode = "login" | "register" | "reset";

interface AuthScreenProps {
  onAuthenticated: (token: string, user: User) => Promise<void>;
}

export function AuthScreen({ onAuthenticated }: AuthScreenProps) {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [resetCodeInput, setResetCodeInput] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [generatedCode, setGeneratedCode] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const title = useMemo(() => {
    if (mode === "register") return "Crie sua conta Medusa";
    if (mode === "reset") return "Recuperar acesso";
    return "Entrar no Medusa";
  }, [mode]);

  const handleLoginOrRegister = async () => {
    setError("");
    setSuccess("");
    setLoading(true);
    try {
      if (mode === "register") {
        const data = await api.register(email.trim(), password.trim(), name.trim() || "Usuário");
        await onAuthenticated(data.token, data.user);
      } else {
        const data = await api.login(email.trim(), password.trim());
        await onAuthenticated(data.token, data.user);
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Falha de autenticação");
    } finally {
      setLoading(false);
    }
  };

  const requestResetCode = async () => {
    setError("");
    setSuccess("");
    setLoading(true);
    try {
      const result = await api.requestPasswordReset(email.trim());
      setGeneratedCode(result.reset_code);
      setSuccess("Código gerado. Use abaixo para definir nova senha.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Erro ao solicitar código");
    } finally {
      setLoading(false);
    }
  };

  const confirmReset = async () => {
    setError("");
    setSuccess("");
    setLoading(true);
    try {
      const result = await api.confirmPasswordReset(email.trim(), resetCodeInput.trim(), newPassword.trim());
      setSuccess(result.message + " Faça login com a nova senha.");
      setMode("login");
      setPassword("");
      setResetCodeInput("");
      setNewPassword("");
      setGeneratedCode(undefined);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Não foi possível redefinir");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.wrapper}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={styles.container}>
        <Text style={styles.kicker}>MEDUSA SAAS</Text>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>IA cognitiva pessoal, sessão segura e memória individual.</Text>

        <Card>
          <View style={styles.modeRow}>
            {(["login", "register", "reset"] as AuthMode[]).map((item) => (
              <PrimaryButton
                key={item}
                label={item === "login" ? "Login" : item === "register" ? "Cadastro" : "Recuperar"}
                variant={item === mode ? "primary" : "ghost"}
                onPress={() => {
                  setMode(item);
                  setError("");
                  setSuccess("");
                }}
                style={styles.modeButton}
                testID={`auth-mode-${item}`}
              />
            ))}
          </View>

          {mode === "register" && (
            <TextInput
              testID="auth-name-input"
              placeholder="Nome"
              placeholderTextColor={theme.colors.textSecondary}
              value={name}
              onChangeText={setName}
              style={styles.input}
            />
          )}

          <TextInput
            testID="auth-email-input"
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="E-mail"
            placeholderTextColor={theme.colors.textSecondary}
            value={email}
            onChangeText={setEmail}
            style={styles.input}
          />

          {mode !== "reset" && (
            <TextInput
              testID="auth-password-input"
              secureTextEntry
              placeholder="Senha"
              placeholderTextColor={theme.colors.textSecondary}
              value={password}
              onChangeText={setPassword}
              style={styles.input}
            />
          )}

          {mode === "reset" && (
            <>
              <PrimaryButton
                label="Gerar código"
                onPress={requestResetCode}
                loading={loading}
                testID="auth-generate-reset"
              />
              {generatedCode ? (
                <Text style={styles.inlineCode}>Código MVP: {generatedCode}</Text>
              ) : null}
              <TextInput
                testID="auth-reset-code-input"
                placeholder="Código recebido"
                placeholderTextColor={theme.colors.textSecondary}
                value={resetCodeInput}
                onChangeText={setResetCodeInput}
                style={styles.input}
              />
              <TextInput
                testID="auth-new-password-input"
                secureTextEntry
                placeholder="Nova senha"
                placeholderTextColor={theme.colors.textSecondary}
                value={newPassword}
                onChangeText={setNewPassword}
                style={styles.input}
              />
              <PrimaryButton
                label="Atualizar senha"
                onPress={confirmReset}
                loading={loading}
                testID="auth-confirm-reset"
              />
            </>
          )}

          {mode !== "reset" && (
            <PrimaryButton
              label={mode === "register" ? "Criar conta" : "Entrar"}
              onPress={handleLoginOrRegister}
              loading={loading}
              testID="auth-submit"
            />
          )}

          {!!error && <Text style={styles.error}>{error}</Text>}
          {!!success && <Text style={styles.success}>{success}</Text>}
        </Card>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  container: {
    flex: 1,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.xl,
    paddingBottom: theme.spacing.xl,
    gap: theme.spacing.md,
    justifyContent: "center",
  },
  kicker: {
    color: theme.colors.accent,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  title: {
    fontSize: 32,
    lineHeight: 38,
    fontWeight: "700",
    color: theme.colors.text,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
    color: theme.colors.textSecondary,
    marginBottom: 8,
  },
  modeRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  modeButton: {
    flex: 1,
  },
  input: {
    minHeight: 50,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    color: theme.colors.text,
    paddingHorizontal: theme.spacing.md,
    marginBottom: 10,
  },
  inlineCode: {
    color: theme.colors.accent,
    fontSize: 13,
    marginTop: 6,
    marginBottom: 6,
  },
  error: {
    marginTop: 8,
    color: theme.colors.danger,
    fontSize: 14,
    lineHeight: 20,
  },
  success: {
    marginTop: 8,
    color: theme.colors.brand,
    fontSize: 14,
    lineHeight: 20,
  },
});
