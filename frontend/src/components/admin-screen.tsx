import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { theme } from "@/src/constants/theme";
import { api } from "@/src/services/api";
import { AdminOverview, User } from "@/src/types/app";
import { Card } from "@/src/components/ui/card";
import { PrimaryButton } from "@/src/components/ui/primary-button";

interface AdminScreenProps {
  token: string;
}

export function AdminScreen({ token }: AdminScreenProps) {
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const [summary, allUsers] = await Promise.all([api.adminOverview(token), api.adminUsers(token)]);
      setOverview(summary);
      setUsers(allUsers);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Erro no painel admin");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const toggleUserPlan = async (target: User) => {
    const nextPlan = target.plan === "paid" ? "free" : "paid";
    const nextStatus = nextPlan === "paid" ? "active" : "inactive";
    await api.adminUpdatePlan(token, target.id, nextPlan, nextStatus);
    await loadData();
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Card style={styles.summaryCard}>
        <Text style={styles.title}>Painel Admin</Text>
        {overview ? (
          <View style={styles.metricsWrap}>
            <Text style={styles.metric}>Usuários: {overview.users_total}</Text>
            <Text style={styles.metric}>Pagos: {overview.users_paid}</Text>
            <Text style={styles.metric}>Free: {overview.users_free}</Text>
            <Text style={styles.metric}>Onboarding concluído: {overview.onboarding_completed}</Text>
            <Text style={styles.metric}>Mensagens hoje: {overview.chat_messages_today}</Text>
            <Text style={styles.metric}>Conversão: {overview.conversion_rate}%</Text>
          </View>
        ) : null}
        <PrimaryButton
          label={loading ? "Atualizando..." : "Atualizar métricas"}
          onPress={loadData}
          disabled={loading}
          testID="admin-refresh-button"
        />
      </Card>

      {users.map((user) => (
        <Card key={user.id} style={styles.userCard}>
          <Text style={styles.userName}>{user.name}</Text>
          <Text style={styles.userMeta}>{user.email}</Text>
          <Text style={styles.userMeta}>
            Plano {user.plan} • assinatura {user.subscription_status}
          </Text>
          <PrimaryButton
            label={user.plan === "paid" ? "Rebaixar para Free" : "Ativar Paid"}
            onPress={() => toggleUserPlan(user)}
            variant="ghost"
            testID={`admin-toggle-plan-${user.id}`}
          />
        </Card>
      ))}

      {!loading && users.length === 0 ? <Text style={styles.empty}>Sem usuários para exibir.</Text> : null}
      {!!error && <Text style={styles.error}>{error}</Text>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: theme.spacing.xl,
    gap: theme.spacing.md,
  },
  summaryCard: {
    gap: theme.spacing.sm,
  },
  title: {
    fontSize: 22,
    color: theme.colors.text,
    fontWeight: "700",
  },
  metricsWrap: {
    gap: 4,
  },
  metric: {
    color: theme.colors.textSecondary,
    fontSize: 14,
  },
  userCard: {
    gap: 8,
  },
  userName: {
    color: theme.colors.text,
    fontWeight: "700",
    fontSize: 16,
  },
  userMeta: {
    color: theme.colors.textSecondary,
    fontSize: 13,
  },
  empty: {
    textAlign: "center",
    color: theme.colors.textSecondary,
  },
  error: {
    color: theme.colors.danger,
    fontSize: 14,
  },
});
