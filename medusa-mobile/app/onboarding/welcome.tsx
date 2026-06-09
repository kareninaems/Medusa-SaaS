import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Button } from "@/components/ui/Button";
import { colors, spacing, typography } from "@/components/ui/Theme";

export default function WelcomeScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.logo}>🐙</Text>
        <Text style={styles.title}>Medusa</Text>
        <Text style={styles.tagline}>
          Seu co-piloto de produtividade.{"\n"}Adaptado à sua energia real.
        </Text>
      </View>

      <View style={styles.features}>
        <FeatureItem icon="⚡" text="Check-in diário de energia em 10 segundos" />
        <FeatureItem icon="🧠" text="Conversa contextual que evolui com você" />
        <FeatureItem icon="🔁" text="Detecta loops e padrões ao longo do tempo" />
        <FeatureItem icon="📈" text="Alerta de burnout antes que aconteça" />
      </View>

      <Button
        label="Vamos começar"
        onPress={() => router.push("/onboarding/name")}
        style={styles.cta}
      />
    </View>
  );
}

function FeatureItem({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={styles.featureRow}>
      <Text style={styles.featureIcon}>{icon}</Text>
      <Text style={styles.featureText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    padding: spacing.xl,
    justifyContent: "space-between",
  },
  hero: { alignItems: "center", paddingTop: spacing.xl * 2 },
  logo: { fontSize: 64, marginBottom: spacing.sm },
  title: { ...typography.title, fontSize: 36, marginBottom: spacing.sm },
  tagline: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: "center",
    lineHeight: 24,
  },
  features: { gap: spacing.md },
  featureRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  featureIcon: { fontSize: 24, width: 36, textAlign: "center" },
  featureText: { ...typography.body, flex: 1 },
  cta: { marginBottom: spacing.xl },
});
