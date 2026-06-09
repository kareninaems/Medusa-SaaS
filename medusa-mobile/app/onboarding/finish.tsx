import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useAuth } from "@/hooks/useAuth";
import { updateOnboarding } from "@/services/medusa";
import { Button } from "@/components/ui/Button";
import { colors, spacing, typography } from "@/components/ui/Theme";

export default function FinishScreen() {
  const { name, context, challenges } = useLocalSearchParams<{
    name: string;
    context: string;
    challenges: string;
  }>();
  const { session } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFinish() {
    if (!session) return;
    setLoading(true);
    setError(null);
    try {
      await updateOnboarding(session.user.id, {
        display_name: name,
        contexto_trabalho: context || null,
        principais_desafios: challenges || null,
      });
      router.replace("/app/checkin");
    } catch {
      setError("Erro ao salvar. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>🎯</Text>
      <Text style={styles.title}>Pronto, {name}!</Text>
      <Text style={styles.sub}>
        A Medusa já tem o que precisa para começar. Você pode atualizar essas informações
        a qualquer momento no perfil.
      </Text>

      <View style={styles.summary}>
        {context ? (
          <SummaryItem label="Contexto" value={context} />
        ) : null}
        {challenges ? (
          <SummaryItem label="Desafios" value={challenges} />
        ) : null}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Button
        label="Começar agora"
        onPress={handleFinish}
        loading={loading}
        style={styles.btn}
      />
    </View>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryItem}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue} numberOfLines={3}>{value}</Text>
    </View>
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
  emoji: { fontSize: 56, textAlign: "center" },
  title: { ...typography.title, textAlign: "center" },
  sub: { ...typography.body, color: colors.textMuted, textAlign: "center", lineHeight: 22 },
  summary: { gap: spacing.sm },
  summaryItem: {
    backgroundColor: colors.bgCard,
    borderRadius: 10,
    padding: spacing.md,
    gap: spacing.xs,
  },
  summaryLabel: { ...typography.caption, color: colors.accent, fontWeight: "600" },
  summaryValue: { ...typography.body },
  error: { color: colors.danger, fontSize: 13, textAlign: "center" },
  btn: { marginTop: spacing.sm },
});
