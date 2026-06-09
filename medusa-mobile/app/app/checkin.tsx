import React, { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useAuth } from "@/hooks/useAuth";
import { EnergyPicker } from "@/components/ui/EnergyPicker";
import { Button } from "@/components/ui/Button";
import { colors, spacing, typography } from "@/components/ui/Theme";
import { getPendingFollowUp, resolveFollowUp, updateEnergy } from "@/services/medusa";
import type { EnergyLevel, FollowUp } from "@/types/medusa";

export default function CheckInScreen() {
  const { session, profile } = useAuth();
  const [energy, setEnergy] = useState<EnergyLevel | null>(null);
  const [followUp, setFollowUp] = useState<FollowUp | null>(null);
  const [loading, setLoading] = useState(false);

  const name = profile?.onboarding?.display_name ?? profile?.display_name ?? "você";

  useEffect(() => {
    if (session?.user.id) {
      getPendingFollowUp(session.user.id).then(setFollowUp).catch(() => {});
    }
  }, [session?.user.id]);

  async function handleStart() {
    if (!energy || !session) return;
    setLoading(true);
    try {
      await updateEnergy(session.user.id, energy);
      router.replace({ pathname: "/app/chat", params: { energy: String(energy) } });
    } finally {
      setLoading(false);
    }
  }

  async function handleFollowUp(status: "done" | "not_done") {
    if (!followUp) return;
    await resolveFollowUp(followUp.id, status).catch(() => {});
    setFollowUp(null);
  }

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.greeting}>{greeting}, {name}.</Text>
      <Text style={styles.question}>Como está sua energia agora?</Text>

      <EnergyPicker value={energy} onChange={setEnergy} />

      {followUp && (
        <View style={styles.followUpCard}>
          <Text style={styles.followUpTitle}>Continuando de onde paramos</Text>
          <Text style={styles.followUpTask}>Você combinou: {followUp.task_summary}</Text>
          <View style={styles.followUpActions}>
            <Button label="Sim" variant="primary" onPress={() => handleFollowUp("done")} style={styles.followUpBtn} />
            <Button label="Parcial" variant="secondary" onPress={() => handleFollowUp("not_done")} style={styles.followUpBtn} />
            <Button label="Não" variant="ghost" onPress={() => handleFollowUp("not_done")} style={styles.followUpBtn} />
          </View>
        </View>
      )}

      <Button
        label="Começar"
        onPress={handleStart}
        loading={loading}
        disabled={!energy}
        style={{ marginTop: spacing.lg }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.xl, gap: spacing.md },
  greeting: { ...typography.title, marginBottom: spacing.xs },
  question: { ...typography.subtitle, color: colors.textMuted, marginBottom: spacing.sm },
  followUpCard: {
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.accent + "44",
    gap: spacing.sm,
  },
  followUpTitle: { ...typography.caption, color: colors.accent, fontWeight: "600" },
  followUpTask: { ...typography.body },
  followUpActions: { flexDirection: "row", gap: spacing.sm },
  followUpBtn: { flex: 1 },
});
