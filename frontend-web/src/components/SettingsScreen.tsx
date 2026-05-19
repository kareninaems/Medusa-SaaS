import type { Session } from "@supabase/supabase-js";
import { Link } from "react-router-dom";

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
  const confirmReset = async () => {
    const confirmed = window.confirm(
      "Tem certeza que deseja resetar seus dados? Essa ação remove histórico, memória e onboarding.",
    );
    if (!confirmed) return;
    await onReset();
  };

  return (
    <section className="panel">
      <h2>Setup</h2>
      <p className="muted">Conta: {session.user.email}</p>
      <p className="muted">Próximo passo: escolha uma ação abaixo.</p>

      <div className="setup-list">
        <div className="setup-item">
          <strong>Ver conta</strong>
          <span>{session.user.email}</span>
        </div>

        <div className="setup-item">
          <strong>Resetar dados</strong>
          <span>Apaga histórico, memória e onboarding.</span>
          <button className="ghost-btn" onClick={confirmReset} disabled={resetting}>
            {resetting ? "Resetando" : "Resetar dados"}
          </button>
        </div>

        <div className="setup-item">
          <strong>Sair</strong>
          <span>Encerra a sessão atual.</span>
          <button className="primary-btn" onClick={onSignOut}>
            Sair da conta
          </button>
        </div>

        <div className="legal-links-row">
          <Link to="/terms">Termos</Link>
          <Link to="/privacy">Privacidade</Link>
          <Link to="/crisis">Crise</Link>
        </div>
      </div>
    </section>
  );
}
