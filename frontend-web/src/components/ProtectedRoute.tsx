import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";

import { supabase } from "../lib/supabase";
import { getSubscription } from "../services/medusa";
import { isTrialAtivo } from "../lib/trial";

interface ProfileRow {
  role?: string | null;
  onboarding?: Record<string, unknown> | null;
}

function onboardingCompleto(profile: ProfileRow | null): boolean {
  if (!profile) return false;
  const onboarding = profile.onboarding as Record<string, unknown> | null;
  return Boolean(onboarding?.completed_at || onboarding?.complete || onboarding?.setup_done);
}

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const [carregando, setCarregando] = useState(true);
  const [destino, setDestino] = useState<string | null>(null);
  const location = useLocation();

  useEffect(() => {
    let ativo = true;

    const verificarAcesso = async () => {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

      if (sessionError || !sessionData.session) {
        if (!ativo) return;
        setDestino("/");
        setCarregando(false);
        return;
      }

      const user = sessionData.session.user;

      if (!user.email_confirmed_at && location.pathname !== "/confirmar-email") {
        if (!ativo) return;
        setDestino("/confirmar-email");
        setCarregando(false);
        return;
      }

      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("role, onboarding")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError || !profileData) {
        if (!ativo) return;
        setDestino("/");
        setCarregando(false);
        return;
      }

      const profile = profileData as ProfileRow;
      const isAdmin = profile.role === "admin" || user.email === "admin@medusa.app";

      if (isAdmin) {
        if (!ativo) return;
        setDestino(null);
        setCarregando(false);
        return;
      }

      if (!onboardingCompleto(profile) && location.pathname !== "/") {
        if (!ativo) return;
        setDestino("/");
        setCarregando(false);
        return;
      }

      const trialAtivo = user.created_at ? isTrialAtivo(user.created_at) : false;
      let assinaturaAtiva = false;

      try {
        const subscription = await getSubscription(user.id);
        assinaturaAtiva = Boolean(subscription && ["active", "trialing"].includes(subscription.status));
      } catch {
        assinaturaAtiva = false;
      }

      if (!trialAtivo && !assinaturaAtiva) {
        const rotasLivres = ["/pricing", "/setup", "/crisis", "/terms", "/privacy"];
        if (!rotasLivres.includes(location.pathname)) {
          if (!ativo) return;
          setDestino("/pricing");
          setCarregando(false);
          return;
        }
      }

      if (!ativo) return;
      setDestino(null);
      setCarregando(false);
    };

    verificarAcesso();
    return () => {
      ativo = false;
    };
  }, [location.pathname]);

  if (carregando) {
    return <div className="app-shell"><p className="muted">Carregando...</p></div>;
  }

  if (destino) {
    return <Navigate to={destino} replace />;
  }

  return <>{children}</>;
}
