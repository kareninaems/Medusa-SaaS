import React from "react";
import * as WebBrowser from "expo-web-browser";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AccountScreen } from "@/src/components/account-screen";
import { AdminScreen } from "@/src/components/admin-screen";
import { AuthScreen } from "@/src/components/auth-screen";
import { ChatScreen } from "@/src/components/chat-screen";
import { MemoryScreen } from "@/src/components/memory-screen";
import { OnboardingScreen } from "@/src/components/onboarding-screen";
import { PaywallModal } from "@/src/components/paywall-modal";
import { AppTab, TabBar } from "@/src/components/tab-bar";
import { theme } from "@/src/constants/theme";
import { useSession } from "@/src/hooks/use-session";
import { api } from "@/src/services/api";

export default function Index() {
  const { loading, token, user, applyAuth, signOut, refreshUser } = useSession();
  const [activeTab, setActiveTab] = React.useState<AppTab>("chat");
  const [paywallVisible, setPaywallVisible] = React.useState(false);
  const [paywallReason, setPaywallReason] = React.useState<string | undefined>(undefined);
  const [paywallLoading, setPaywallLoading] = React.useState(false);

  const tabs: AppTab[] = user?.is_admin
    ? ["chat", "memory", "account", "admin"]
    : ["chat", "memory", "account"];

  const openPaywall = (reason?: string) => {
    setPaywallReason(reason);
    setPaywallVisible(true);
  };

  const handleUpgrade = async () => {
    if (!token) return;
    setPaywallLoading(true);
    try {
      const checkout = await api.checkout(token);
      await WebBrowser.openBrowserAsync(checkout.checkout_url);
      await refreshUser();
      setPaywallVisible(false);
    } catch {
      setPaywallVisible(false);
    } finally {
      setPaywallLoading(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loaderWrap}>
        <ActivityIndicator color={theme.colors.brand} />
      </SafeAreaView>
    );
  }

  if (!token || !user) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <AuthScreen onAuthenticated={applyAuth} />
      </SafeAreaView>
    );
  }

  if (!user.onboarding_completed) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <OnboardingScreen
          token={token}
          onCompleted={async () => {
            await refreshUser();
            openPaywall("onboarding_soft_offer");
          }}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.kicker}>MEDUSA</Text>
          <Text style={styles.heading}>Seu copiloto cognitivo</Text>
        </View>

        <View style={styles.screenWrap}>
          {activeTab === "chat" ? (
            <ChatScreen token={token} user={user} onRequirePaywall={openPaywall} />
          ) : null}
          {activeTab === "memory" ? <MemoryScreen token={token} /> : null}
          {activeTab === "account" ? (
            <AccountScreen
              token={token}
              user={user}
              onRefreshUser={refreshUser}
              onRequirePaywall={() => openPaywall("account_upgrade")}
              onSignOut={signOut}
            />
          ) : null}
          {activeTab === "admin" && user.is_admin ? <AdminScreen token={token} /> : null}
        </View>

        <TabBar activeTab={activeTab} tabs={tabs} onChange={setActiveTab} />
      </View>

      <PaywallModal
        visible={paywallVisible}
        reason={paywallReason}
        loading={paywallLoading}
        onClose={() => setPaywallVisible(false)}
        onUpgrade={handleUpgrade}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  loaderWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.background,
  },
  page: {
    flex: 1,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  header: {
    gap: 4,
  },
  kicker: {
    color: theme.colors.accent,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 2,
  },
  heading: {
    fontSize: 30,
    lineHeight: 36,
    color: theme.colors.text,
    fontWeight: "700",
  },
  screenWrap: {
    flex: 1,
  },
});
