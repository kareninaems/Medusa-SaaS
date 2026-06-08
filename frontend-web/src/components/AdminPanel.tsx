import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

interface AdminStats {
  totalUsers: number;
  activeSubscribers: number;
  trialing: number;
  interacoesHoje: number;
}

interface AdminPanelProps {
  onBack: () => void;
}

export function AdminPanel({ onBack }: AdminPanelProps) {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadStats() {
      try {
        const [usersRes, activeRes, trialingRes, interacoesRes] = await Promise.all([
          supabase.from("profiles").select("id", { count: "exact", head: true }),
          supabase
            .from("profiles")
            .select("id", { count: "exact", head: true })
            .eq("subscription_status", "active"),
          supabase
            .from("profiles")
            .select("id", { count: "exact", head: true })
            .eq("subscription_status", "trialing"),
          supabase
            .from("profiles")
            .select("interacoes_hoje")
            .not("interacoes_hoje", "is", null),
        ]);

        const totalInteracoes =
          (interacoesRes.data ?? []).reduce(
            (sum: number, r: { interacoes_hoje: number | null }) => sum + (r.interacoes_hoje ?? 0),
            0,
          );

        setStats({
          totalUsers: usersRes.count ?? 0,
          activeSubscribers: activeRes.count ?? 0,
          trialing: trialingRes.count ?? 0,
          interacoesHoje: totalInteracoes,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao carregar dados.");
      } finally {
        setLoading(false);
      }
    }

    void loadStats();
  }, []);

  return (
    <section className="panel" data-testid="admin-panel">
      <button className="ghost-btn" onClick={onBack} style={{ marginBottom: "1rem" }}>
        ← Voltar
      </button>
      <h2>Painel Admin</h2>

      {loading ? (
        <p className="muted">Carregando métricas...</p>
      ) : error ? (
        <p className="status-error">{error}</p>
      ) : stats ? (
        <div className="setup-list">
          <div className="setup-item" data-testid="admin-stat-total-users">
            <strong>Total de usuários</strong>
            <span style={{ fontSize: "2rem", fontWeight: 700 }}>{stats.totalUsers}</span>
          </div>
          <div className="setup-item" data-testid="admin-stat-active">
            <strong>Assinaturas ativas</strong>
            <span style={{ fontSize: "2rem", fontWeight: 700 }}>{stats.activeSubscribers}</span>
          </div>
          <div className="setup-item" data-testid="admin-stat-trialing">
            <strong>Em período de trial</strong>
            <span style={{ fontSize: "2rem", fontWeight: 700 }}>{stats.trialing}</span>
          </div>
          <div className="setup-item" data-testid="admin-stat-interactions">
            <strong>Interações hoje (total)</strong>
            <span style={{ fontSize: "2rem", fontWeight: 700 }}>{stats.interacoesHoje}</span>
          </div>
        </div>
      ) : null}
    </section>
  );
}
