import React, { useState } from "react";
import { Alert, Linking, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useAuth } from "@/hooks/useAuth";
import { createCheckoutSession, createPortalSession } from "@/services/medusa";
import { isTrialAtivo, diasRestantesTrial } from "@/lib/trial";
import { Button } from "@/components/ui/Button";
import { colors, spacing, typography } from "@/components/ui/Theme";

export default function ProfileScreen() {
  const { session, profile, signOut } = useAuth();
  const [loadingPortal, setLoadingPortal] = useState(false);
  const [loadingCheckout, setLoadingCheckout] = useState(false);

  const name = profile?.onboarding?.display_name ?? profile?.display_name ?? "você";
  const status = profile?.subscription_status ?? "inactive";
  const isAdmin = profile?.role === "admin";
  const trialAtivo = profile?.created_at ? isTrialAtivo(profile.created_at) : false;
  const diasTrial = profile?.created_at ? diasRestantesTrial(profile.created_at) : 0;
  const isActive = status === "active" || isAdmin || trialAtivo;

  async function handlePortal() {
    if (!session) return;
    setLoadingPortal(true);
    try {
      const url = await createPortalSession(session);
      await Linking.openURL(url);
    } catch {
      Alert.alert("Erro", "Não foi possível abrir o portal. Tente novamente.");
    } finally {
      setLoadingPortal(false);
    }
  }

  async function handleCheckout() {
    if (!session) return;
    setLoadingCheckout(true);
    try {
      const url = await createCheckoutSession(session);
      await Linking.openURL(url);
    } catch {
      Alert.alert("Erro", "Não foi possível iniciar o pagamento. Tente novamente.");
    } finally {
      setLoadingCheckout(false);
    }
  }

  async function handleSignOut() {
    await signOut();
    router.replace("/auth/login");
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Avatar / nome */}
      <View style={styles.avatarSection}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{name.charAt(0).toUpperCase()}</Text>
        </View>
        <Text style={styles.name}>{name}</Text>
        <Text style={styles.email}>{session?.user.email}</Text>
      </View>

      {/* Status */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Assinatura</Text>
        <View style={styles.statusRow}>
          <View style={[styles.statusDot, { backgroundColor: isActive ? colors.success : colors.danger }]} />
          <Text style={styles.statusText}>
            {isAdmin
              ? "Admin — acesso completo"
              : status === "active"
              ? "Ativa"
              : trialAtivo
              ? `Trial — ${diasTrial} dia${diasTrial !== 1 ? "s" : ""} restante${diasTrial !== 1 ? "s" : ""}`
              : "Inativa"}
          </Text>
        </View>

        {status === "active" ? (
          <Button
            label="Gerenciar assinatura"
            variant="secondary"
            onPress={handlePortal}
            loading={loadingPortal}
            style={styles.cardBtn}
          />
        ) : !isAdmin && !trialAtivo ? (
          <Button
            label="Assinar agora"
            onPress={handleCheckout}
            loading={loadingCheckout}
            style={styles.cardBtn}
          />
        ) : trialAtivo ? (
          <Button
            label="Ativar assinatura"
            variant="secondary"
            onPress={handleCheckout}
            loading={loadingCheckout}
            style={styles.cardBtn}
          />
        ) : null}
      </View>

      {/* Onboarding */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Perfil</Text>
        {profile?.onboarding?.contexto_trabalho ? (
          <View style={styles.profileItem}>
            <Text style={styles.profileLabel}>Contexto</Text>
            <Text style={styles.profileValue}>{profile.onboarding.contexto_trabalho}</Text>
          </View>
        ) : null}
        {profile?.onboarding?.principais_desafios ? (
          <View style={styles.profileItem}>
            <Text style={styles.profileLabel}>Desafios</Text>
            <Text style={styles.profileValue}>{profile.onboarding.principais_desafios}</Text>
          </View>
        ) : null}
        <Button
          label="Editar perfil"
          variant="ghost"
          onPress={() => router.push("/onboarding/name")}
          style={styles.cardBtn}
        />
      </View>

      {/* Sair */}
      <Button
        label="Sair da conta"
        variant="ghost"
        onPress={handleSignOut}
        style={styles.signOutBtn}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.xl, gap: spacing.md },
  avatarSection: { alignItems: "center", paddingVertical: spacing.lg, gap: spacing.sm },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#fff", fontSize: 28, fontWeight: "700" },
  name: { ...typography.subtitle },
  email: { ...typography.caption, color: colors.textMuted },
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: 12,
    padding: spacing.md,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTitle: { ...typography.caption, color: colors.textMuted, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 },
  statusRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { ...typography.body },
  cardBtn: { marginTop: spacing.xs },
  profileItem: { gap: 2 },
  profileLabel: { ...typography.caption, color: colors.accent },
  profileValue: { ...typography.body, color: colors.textMuted },
  signOutBtn: { marginTop: spacing.sm },
});
