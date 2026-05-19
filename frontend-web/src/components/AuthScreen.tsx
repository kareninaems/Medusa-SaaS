import { useState } from "react";
import type { FormEvent } from "react";

import { PENDING_CONSENT_KEY } from "../constants/legal";
import { supabase } from "../lib/supabase";

interface AuthScreenProps {
  onAuthDone: () => Promise<void>;
}

export function AuthScreen({ onAuthDone }: AuthScreenProps) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [acceptedLegal, setAcceptedLegal] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    setInfo("");

    try {
      if (mode === "register") {
        if (!acceptedLegal) {
          setError("Você precisa aceitar os Termos de Uso e a Política de Privacidade.");
          return;
        }

        const { data, error: registerError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        });
        if (registerError) throw registerError;
        localStorage.setItem(PENDING_CONSENT_KEY, "true");
        if (!data.session) {
          setInfo("Conta criada. Verifique seu e-mail para confirmar.");
        } else {
          await onAuthDone();
        }
      } else {
        const { error: loginError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (loginError) throw loginError;
        await onAuthDone();
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Falha de autenticação");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <p className="eyebrow">MEDUSA</p>
        <h1>{mode === "login" ? "Entrar" : "Criar conta"}</h1>
        <p className="auth-sub">Sincronização cognitiva/emocional em uso diário.</p>

        <form className="stack" onSubmit={handleSubmit}>
          <div className="toggle-row">
            <button
              type="button"
              className={`toggle-btn ${mode === "login" ? "active" : ""}`}
              onClick={() => setMode("login")}
            >
              Login
            </button>
            <button
              type="button"
              className={`toggle-btn ${mode === "register" ? "active" : ""}`}
              onClick={() => setMode("register")}
            >
              Cadastro
            </button>
          </div>

          <input
            className="input"
            type="email"
            placeholder="seu@email.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
          <input
            className="input"
            type="password"
            placeholder="Senha"
            minLength={6}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />

          {mode === "register" ? (
            <label className="check-row">
              <input
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
          ) : null}

          <button className="primary-btn" type="submit" disabled={loading}>
            {loading ? "Aguarde..." : mode === "login" ? "Entrar na Medusa" : "Criar conta"}
          </button>

          {info ? <p className="status-ok">{info}</p> : null}
          {error ? <p className="status-error">{error}</p> : null}
        </form>
      </div>
    </div>
  );
}
