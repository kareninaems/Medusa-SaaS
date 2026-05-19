import { Modal, StyleSheet, Text, View } from "react-native";

import { theme } from "@/src/constants/theme";
import { PrimaryButton } from "@/src/components/ui/primary-button";
import { Card } from "@/src/components/ui/card";

interface PaywallModalProps {
  visible: boolean;
  reason?: string;
  loading?: boolean;
  onClose: () => void;
  onUpgrade: () => void;
}

function getReasonText(reason?: string) {
  if (reason === "voice_premium") return "Voz premium desbloqueia respostas profundas em áudio.";
  if (reason === "free_limit_reached") return "Você atingiu o limite diário do plano gratuito.";
  return "Libere o modo premium para acelerar seu apoio cognitivo.";
}

export function PaywallModal({
  visible,
  reason,
  loading,
  onClose,
  onUpgrade,
}: PaywallModalProps) {
  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <Card style={styles.content}>
          <Text style={styles.badge}>PREMIUM</Text>
          <Text style={styles.title}>Suba para o plano pago</Text>
          <Text style={styles.description}>{getReasonText(reason)}</Text>
          <View style={styles.bullets}>
            <Text style={styles.bullet}>• Voz como gatilho principal de valor</Text>
            <Text style={styles.bullet}>• Mais mensagens sem bloqueio diário</Text>
            <Text style={styles.bullet}>• Memória expandida e contexto profundo</Text>
          </View>
          <PrimaryButton
            label="Fazer upgrade"
            onPress={onUpgrade}
            loading={loading}
            testID="paywall-upgrade-button"
          />
          <PrimaryButton
            label="Agora não"
            onPress={onClose}
            variant="ghost"
            style={styles.dismissButton}
            testID="paywall-dismiss-button"
          />
        </Card>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.3)",
    padding: theme.spacing.md,
  },
  content: {
    minHeight: "52%",
    justifyContent: "space-between",
    gap: theme.spacing.md,
  },
  badge: {
    alignSelf: "flex-start",
    backgroundColor: "#F5E5DE",
    color: theme.colors.accent,
    fontWeight: "800",
    fontSize: 12,
    borderRadius: theme.radius.pill,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 6,
  },
  title: {
    fontSize: 28,
    lineHeight: 34,
    color: theme.colors.text,
    fontWeight: "700",
  },
  description: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    lineHeight: 24,
  },
  bullets: {
    gap: 8,
  },
  bullet: {
    fontSize: 15,
    color: theme.colors.text,
  },
  dismissButton: {
    marginTop: 4,
  },
});
