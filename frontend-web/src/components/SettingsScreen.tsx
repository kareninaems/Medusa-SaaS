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
    <section className="panel" data-testid="settings-screen">
      <h2>Setup</h2>
      <p className="muted" data-testid="settings-account-email">Conta: {session.user.email}</p>
      <p className="muted">Próximo passo: escolha uma ação abaixo.</p>

      <div className="setup-list">
        <div className="setup-item">
          <strong>Ver conta</strong>
          <span>{session.user.email}</span>
        </div>

        <div className="setup-item">
          <strong>Resetar dados</strong>
          <span>Apaga histórico, memória e onboarding.</span>
          <button data-testid="settings-reset-button" className="ghost-btn" onClick={confirmReset} disabled={resetting}>
            {resetting ? "Resetando" : "Resetar dados"}
          </button>
        </div>

        <div className="setup-item">
          <strong>Sair</strong>
          <span>Encerra a sessão atual.</span>
          <button data-testid="settings-signout-button" className="primary-btn" onClick={onSignOut}>
            Sair da conta
          </button>
        </div>

        <div className="setup-item">
          <strong>Voz</strong>
          <span>Recurso futuro. Ainda não disponível neste MVP.</span>
          <button data-testid="settings-voice-placeholder-button" className="ghost-btn" disabled>
            Voz em breve
          </button>
        </div>

        <div className="legal-links-row">
          <Link to="/terms" data-testid="settings-terms-link">Termos</Link>
          <Link to="/privacy" data-testid="settings-privacy-link">Privacidade</Link>
          <Link to="/crisis" data-testid="settings-crisis-link">Crise</Link>
        </div>
      </div>
    </section>
  );
}
