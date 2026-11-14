import { useEffect, useState } from "react";
import medusaMark from "../assets/medusa.png";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";

import { isDisposableEmail } from "../constants/disposableDomains";
import { PENDING_CONSENT_KEY } from "../constants/legal";
import { supabase } from "../lib/supabase";
import { AGE_CONFIRM_VERSION } from "../services/medusa";

const RESEND_COOLDOWN = 60;

interface AuthScreenProps {
  onAuthDone: () => Promise<void>;
}

export function AuthScreen({ onAuthDone }: AuthScreenProps) {
  // "/login" abre em Login; "/login?modo=cadastro" abre em Cadastro.
  const [mode, setMode] = useState<"login" | "register">(() =>
    new URLSearchParams(window.location.search).get("modo") === "cadastro" ? "register" : "login",
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [acceptedLegal, setAcceptedLegal] = useState(false);
  const [acceptedAge, setAcceptedAge] = useState(false);

  // Pending email verification state
  const [pendingEmail, setPendingEmail] = useState("");
  const [lastResentAt, setLastResentAt] = useState<number | null>(null);
  const [secondsUntilResend, setSecondsUntilResend] = useState(0);

  // Countdown ticker
  useEffect(() => {
    if (!lastResentAt) return;
    const tick = () => {
      const elapsed = Math.floor((Date.now() - lastResentAt) / 1000);
      const remaining = Math.max(0, RESEND_COOLDOWN - elapsed);
      setSecondsUntilResend(remaining);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [lastResentAt]);

  const emailRedirectTo = `${window.location.origin}/onboarding`;

  const handleResend = async () => {
    setError("");
    try {
      const { error: resendError } = await supabase.auth.resend({
        type: "signup",
        email: pendingEmail,
        options: { emailRedirectTo },
      });
      if (resendError) throw resendError;
      setLastResentAt(Date.now());
      setInfo("Email reenviado. Verifique sua caixa de entrada.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao reenviar email.");
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    setInfo("");

    try {
      const trimmedEmail = email.trim();

      if (mode === "register") {
        if (!acceptedLegal) {
          setError("Você precisa aceitar os Termos de Uso e a Política de Privacidade.");
          return;
        }
        if (!acceptedAge) {
          setError("Você precisa declarar que tem 18 anos ou mais.");
          return;
        }
        if (isDisposableEmail(trimmedEmail)) {
          setError("Emails temporários não são aceitos. Use um email permanente.");
          return;
        }

        const ageConfirmedAt = new Date().toISOString();
        const { data, error: registerError } = await supabase.auth.signUp({
          email: trimmedEmail,
          password,
          options: {
            emailRedirectTo,
            data: {
              age_confirmed: true,
              age_confirmed_at: ageConfirmedAt,
              age_confirmed_version: AGE_CONFIRM_VERSION,
            },
          },
        });
        if (registerError) throw registerError;
        localStorage.setItem(PENDING_CONSENT_KEY, "true");
        if (!data.session) {
          setPendingEmail(trimmedEmail);
          setLastResentAt(Date.now());
        } else {
          await onAuthDone();
        }
      } else {
        const { data, error: loginError } = await supabase.auth.signInWithPassword({
          email: trimmedEmail,
          password,
        });
        if (loginError) throw loginError;
        // Guard: email not confirmed yet
        if (data.user && !data.user.email_confirmed_at) {
          await supabase.auth.signOut();
          setPendingEmail(trimmedEmail);
          setLastResentAt(Date.now());
          return;
        }
        await onAuthDone();
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Falha de autenticação");
    } finally {
      setLoading(false);
    }
  };

  // ── Pending verification screen ──────────────────────────────────────────
  if (pendingEmail) {
    return (
      <div className="auth-shell" data-testid="auth-screen">
        <div className="auth-card" data-testid="auth-pending-card">
          <p className="eyebrow">Medusa</p>
          <h1 style={{ fontSize: "2rem" }}>✉️</h1>
          <h2>Confirme seu email</h2>
          <p className="auth-sub">
            Enviamos um link de confirmação para <strong>{pendingEmail}</strong>.
            Clique no link para ativar sua conta.
          </p>
          <p className="muted" style={{ fontSize: "0.85rem", marginTop: "0.5rem" }}>
            Dica: verifique a pasta de spam se não encontrar.
          </p>

          {info ? <p className="status-ok" data-testid="auth-resend-info">{info}</p> : null}
          {error ? <p className="status-error" data-testid="auth-resend-error">{error}</p> : null}

          <button
            data-testid="auth-resend-button"
            className="primary-btn"
            onClick={handleResend}
            disabled={secondsUntilResend > 0}
            style={{ marginTop: "1rem" }}
          >
            {secondsUntilResend > 0
              ? `Reenviar em ${secondsUntilResend}s`
              : "Reenviar email"}
          </button>

          <button
            data-testid="auth-back-to-login-button"
            className="ghost-btn"
            onClick={() => {
              setPendingEmail("");
              setLastResentAt(null);
              setSecondsUntilResend(0);
              setError("");
              setInfo("");
            }}
            style={{ marginTop: "0.5rem" }}
          >
            ← Voltar ao login
          </button>
        </div>
      </div>
    );
  }

  // ── Main auth form ───────────────────────────────────────────────────────
  return (
    <div className="auth-shell" data-testid="auth-screen">
      <div className="auth-card" data-testid="auth-card">
        <Link to="/?inicio=1" className="back-link" data-testid="auth-home-link">
          ← Menu principal
        </Link>
        <div className="brand-row">
          <img src={medusaMark} alt="" width={44} height={44} className="brand-mark" style={{ borderRadius: "11px" }} />
          <p className="brand-name">Medusa</p>
        </div>
        <h1>{mode === "login" ? "Entrar" : "Criar conta"}</h1>
        <p className="auth-sub">Ferramenta de uso diário. Sem distrações.</p>

        <form className="stack" onSubmit={handleSubmit} data-testid="auth-form">
          <div className="toggle-row">
            <button
              data-testid="auth-mode-login-button"
              type="button"
              className={`toggle-btn ${mode === "login" ? "active" : ""}`}
              onClick={() => setMode("login")}
            >
              Login
            </button>
            <button
              data-testid="auth-mode-register-button"
              type="button"
              className={`toggle-btn ${mode === "register" ? "active" : ""}`}
              onClick={() => setMode("register")}
            >
              Cadastro
            </button>
          </div>

          <input
            data-testid="auth-email-input"
            className="input"
            type="email"
            placeholder="seu@email.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
          <input
            data-testid="auth-password-input"
            className="input"
            type="password"
            placeholder="Senha"
            minLength={6}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />

          {mode === "register" ? (
            <>
              <label className="check-row">
                <input
                  data-testid="auth-age-confirm-checkbox"
                  type="checkbox"
                  checked={acceptedAge}
                  onChange={(event) => setAcceptedAge(event.target.checked)}
                  required
                />
                <span>Declaro que tenho 18 anos ou mais.</span>
              </label>
              <label className="check-row">
                <input
                  data-testid="auth-legal-checkbox"
                  type="checkbox"
                  checked={acceptedLegal}
                  onChange={(event) => setAcceptedLegal(event.target.checked)}
                  required
                />
                <span>
                  Li e aceito os <a href="/terms">Termos de Uso</a> e a{" "}
                  <a href="/privacy">Política de Privacidade</a>.
                </span>
              </label>
            </>
          ) : null}

          <button data-testid="auth-submit-button" className="primary-btn" type="submit" disabled={loading}>
            {loading ? "Aguarde..." : mode === "login" ? "Entrar na Medusa" : "Criar conta"}
          </button>

          {info ? <p className="status-ok" data-testid="auth-info-message">{info}</p> : null}
          {error ? <p className="status-error" data-testid="auth-error-message">{error}</p> : null}
        </form>

        <footer className="auth-footer" data-testid="auth-footer-links">
          <a href="/terms" data-testid="auth-terms-link">Termos</a>
          <a href="/privacy" data-testid="auth-privacy-link">Privacidade</a>
          <a href="/crisis" data-testid="auth-crisis-link">Crise</a>
        </footer>
      </div>
    </div>
  );
}
