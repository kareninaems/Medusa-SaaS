import { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { useAuth } from "@/hooks/useAuth";
import { router } from "expo-router";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const { session, profile, loading } = useAuth();

  useEffect(() => {
    if (!loading) SplashScreen.hideAsync();
  }, [loading]);

  useEffect(() => {
    if (loading) return;
    if (!session) {
      router.replace("/auth/login");
    } else if (!profile?.onboarding || !profile.onboarding.display_name) {
      router.replace("/onboarding/welcome");
    } else {
      router.replace("/app/checkin");
    }
  }, [loading, session, profile]);

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: "#0a0a0a" },
          headerTintColor: "#f0f0f0",
          contentStyle: { backgroundColor: "#0a0a0a" },
          headerShown: false,
        }}
      />
    </>
  );
}
