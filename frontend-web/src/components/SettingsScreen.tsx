import type { Session } from "@supabase/supabase-js";

interface SettingsScreenProps {
  session: Session;
  resetting?: boolean;
  onReset: () => Promise<void>;
  onSignOut: () => Promise<void>;
}

export function SettingsScreen({
  session,
  resetting = false,
  onReset,
  onSignOut,
}: SettingsScreenProps) {
  return (
    <section className="panel">
      <h3>Setup / Configurações</h3>
      <p className="muted">Conta: {session.user.email}</p>
      <p className="muted">Status: autenticada</p>

      <div className="stack">
        <button className="ghost-btn" onClick={onReset} disabled={resetting}>
          {resetting ? "Resetando dados..." : "Resetar dados do produto"}
        </button>
        <button className="primary-btn" onClick={onSignOut}>
          Sair da conta
        </button>
      </div>
    </section>
  );
}
