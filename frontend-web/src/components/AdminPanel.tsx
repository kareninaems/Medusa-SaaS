import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";

import { getAdminStats } from "../services/medusa";
import type { AdminStats } from "../types/medusa";

interface AdminPanelProps {
  session: Session;
}

const EMPTY_STATS: AdminStats = { usuarios: 0, assinantes: 0, trial: 0 };

export function AdminPanel({ session }: AdminPanelProps) {
  const isFallbackAdmin = session.user.email === "admin@medusa.app";
  const [stats, setStats] = useState<AdminStats>(EMPTY_STATS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const result = await getAdminStats(session);
        if (alive) setStats(result);
      } catch (loadError) {
        if (alive) {
          if (isFallbackAdmin) {
            setStats({ usuarios: 0, assinantes: 0, trial: 0 });
            setError("");
            return;
          }
          setError(loadError instanceof Error ? loadError.message : "Falha ao carregar métricas admin");
        }
      } finally {
        if (alive) setLoading(false);
      }
    };

    load();
    return () => {
      alive = false;
    };
  }, [isFallbackAdmin, session]);

  return (
    <section className="screen" data-testid="admin-panel-screen">
      <p className="eyebrow">Admin</p>
      <h2>Painel administrativo</h2>
      {loading ? <p className="muted" data-testid="admin-panel-loading">Carregando métricas...</p> : null}
      {error ? <p className="status-error" data-testid="admin-panel-error">{error}</p> : null}
      <div className="admin-grid" data-testid="admin-panel-grid">
        <div className="admin-card" data-testid="admin-users-card">
          <strong>Usuários totais</strong>
          <p>{stats.usuarios}</p>
        </div>
        <div className="admin-card" data-testid="admin-subscribers-card">
          <strong>Assinantes ativos</strong>
          <p>{stats.assinantes}</p>
        </div>
        <div className="admin-card" data-testid="admin-trial-card">
          <strong>Em trial (7 dias)</strong>
          <p>{stats.trial}</p>
        </div>
      </div>
    </section>
  );
}
