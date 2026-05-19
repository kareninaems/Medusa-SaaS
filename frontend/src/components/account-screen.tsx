import * as WebBrowser from "expo-web-browser";
import { useMemo, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";

import { theme } from "@/src/constants/theme";
import { api } from "@/src/services/api";
import { User } from "@/src/types/app";
import { Card } from "@/src/components/ui/card";
import { PrimaryButton } from "@/src/components/ui/primary-button";

interface AccountScreenProps {
  token: string;
  user: User;
  onRequirePaywall: () => void;
  onRefreshUser: () => Promise<void>;
  onSignOut: () => Promise<void>;
}

export function AccountScreen({
  token,
  user,
  onRequirePaywall,
  onRefreshUser,
  onSignOut,
}: AccountScreenProps) {
  const [loadingAction, setLoadingAction] = useState("");

  const isPaid = useMemo(
    () => user.plan === "paid" && ["active", "trialing"].includes(user.subscription_status),
    [user.plan, user.subscription_status],
  );

  const runAction = async (name: string, action: () => Promise<void>) => {
    setLoadingAction(name);
    try {
      await action();
    } catch (requestError) {
      Alert.alert(
        "Erro",
        requestError instanceof Error ? requestError.message : "Ação indisponível",
      );
    } finally {
      setLoadingAction("");
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Card style={styles.profileCard}>
        <Text style={styles.title}>Conta</Text>
        <Text style={styles.info}>Nome: {user.name}</Text>
        <Text style={styles.info}>E-mail: {user.email}</Text>
        <Text style={styles.info}>Plano atual: {user.plan.toUpperCase()}</Text>
        <Text style={styles.info}>Status assinatura: {user.subscription_status}</Text>
      </Card>

      <Card style={styles.actionsCard}>
        {!isPaid ? (
          <PrimaryButton
            label="Upgrade para Premium"
            loading={loadingAction === "upgrade"}
            onPress={() =>
              runAction("upgrade", async () => {
                const checkout = await api.checkout(token);
                onRequirePaywall();
                await WebBrowser.openBrowserAsync(checkout.checkout_url);
                await onRefreshUser();
              })
            }
            testID="account-upgrade-button"
          />
        ) : (
          <PrimaryButton
            label="Gerenciar cobrança"
            loading={loadingAction === "portal"}
            onPress={() =>
              runAction("portal", async () => {
                const portal = await api.billingPortal(token);
                await WebBrowser.openBrowserAsync(portal.portal_url);
              })
            }
            testID="account-portal-button"
          />
        )}

        <PrimaryButton
          label="Atualizar status"
          variant="secondary"
          loading={loadingAction === "refresh"}
          onPress={() => runAction("refresh", onRefreshUser)}
          testID="account-refresh-button"
        />

        <PrimaryButton
          label="Exportar meus dados"
          variant="ghost"
          loading={loadingAction === "export"}
          onPress={() =>
            runAction("export", async () => {
              const payload = await api.exportAccount(token);
              Alert.alert("Exportação", `Dados exportados com ${Object.keys(payload).length} blocos.`);
            })
          }
          testID="account-export-button"
        />

        <PrimaryButton
          label="Excluir conta"
          variant="ghost"
          loading={loadingAction === "delete"}
          onPress={() =>
            Alert.alert("Excluir conta", "Confirma remover todos os seus dados?", [
              { text: "Cancelar", style: "cancel" },
              {
                text: "Excluir",
                style: "destructive",
                onPress: () =>
                  runAction("delete", async () => {
                    await api.deleteAccount(token);
                    await onSignOut();
                  }),
              },
            ])
          }
          testID="account-delete-button"
        />

        <PrimaryButton
          label="Sair"
          variant="secondary"
          onPress={onSignOut}
          testID="account-logout-button"
        />
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: theme.spacing.xl,
    gap: theme.spacing.md,
  },
  profileCard: {
    gap: 8,
  },
  actionsCard: {
    gap: 10,
  },
  title: {
    fontSize: 24,
    color: theme.colors.text,
    fontWeight: "700",
    marginBottom: 4,
  },
  info: {
    fontSize: 15,
    color: theme.colors.textSecondary,
    lineHeight: 22,
  },
});
