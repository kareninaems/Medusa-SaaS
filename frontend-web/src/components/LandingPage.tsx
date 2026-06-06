import { Link } from "react-router-dom";

export function LandingPage() {
  return (
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column" }}>
      <header style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid var(--border)", background: "var(--surface)" }}>
        <div style={{ maxWidth: "860px", margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <p style={{ fontWeight: 700, fontSize: "1.1rem", margin: 0 }}>Medusa</p>
          <Link to="/login" style={{ textDecoration: "none" }}>
            <button className="primary-btn" style={{ minHeight: "38px", padding: "0 16px", fontSize: "0.95rem" }}>
              Entrar
            </button>
          </Link>
        </div>
      </header>

      <main style={{ flex: 1, maxWidth: "860px", margin: "0 auto", padding: "3rem 1.5rem", display: "flex", flexDirection: "column", gap: "3.5rem" }}>

        <section style={{ display: "flex", flexDirection: "column", gap: "1rem", maxWidth: "620px" }}>
          <p className="eyebrow">Para mentes que funcionam diferente</p>
          <h1 style={{ fontSize: "2.2rem", lineHeight: 1.25 }}>
            Seu assistente de produtividade neurodivergente
          </h1>
          <p className="muted" style={{ fontSize: "1.1rem", lineHeight: 1.65 }}>
            TDAH, Autismo, Dislexia, Altas Habilidades — ou qualquer cérebro que funcione fora do padrão.
            A Medusa não mede produtividade por tarefas concluídas.
          </p>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "0.5rem" }}>
            <Link to="/login" style={{ textDecoration: "none" }}>
              <button className="primary-btn" style={{ padding: "0 24px" }}>
                Começar agora
              </button>
            </Link>
          </div>
        </section>

        <section style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <h2>Por que é diferente?</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "12px" }}>
            {[
              { title: "Check-in de energia", body: "Antes de qualquer sugestão, a Medusa pergunta como você está. Não te cobra quando não tem como." },
              { title: "Linguagem dos loops", body: "Detecta padrões que você reconhece — procrastinação, paralisia, excesso de compromissos." },
              { title: "Memória do que funciona", body: "Lembra o que te destrava: música, corpo duplo, recompensas, movimento." },
              { title: "Análise de laudos", body: "Envie seu laudo com consentimento explícito. A Medusa adapta as respostas ao seu perfil clínico." },
            ].map((item) => (
              <div key={item.title} className="setup-item" style={{ gap: "6px" }}>
                <strong>{item.title}</strong>
                <p className="muted" style={{ fontSize: "0.95rem", margin: 0 }}>{item.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section style={{ display: "flex", flexDirection: "column", gap: "0.75rem", maxWidth: "560px" }}>
          <h2>Manifesto</h2>
          <p style={{ color: "var(--text-secondary)", lineHeight: 1.7 }}>
            Funcionar bem é também saber quando parar. Não estamos aqui para te transformar numa
            máquina de produtividade — estamos aqui para te ajudar a trabalhar com o seu cérebro,
            não contra ele.
          </p>
        </section>

        <section style={{ display: "flex", flexDirection: "column", gap: "0.75rem", maxWidth: "420px" }}>
          <h2>Plano único</h2>
          <p style={{ fontSize: "2rem", fontWeight: 700, margin: 0 }}>
            {import.meta.env.VITE_SUBSCRIPTION_PRICE ?? "R$ 29,90"}
            <span style={{ fontSize: "1rem", fontWeight: 400, color: "var(--text-muted)" }}> / mês</span>
          </p>
          <p className="muted">Acesso completo. Cancele quando quiser.</p>
          <Link to="/login" style={{ textDecoration: "none" }}>
            <button className="primary-btn" style={{ padding: "0 24px", width: "100%" }}>
              Começar com 7 dias grátis
            </button>
          </Link>
        </section>

      </main>

      <footer style={{ padding: "1.25rem 1.5rem", borderTop: "1px solid var(--border)", background: "var(--surface)" }}>
        <div style={{ maxWidth: "860px", margin: "0 auto", display: "flex", gap: "16px", flexWrap: "wrap" }}>
          <Link to="/terms" className="muted" style={{ fontSize: "0.9rem" }}>Termos</Link>
          <Link to="/privacy" className="muted" style={{ fontSize: "0.9rem" }}>Privacidade</Link>
          <Link to="/crisis" className="muted" style={{ fontSize: "0.9rem" }}>Preciso de ajuda</Link>
        </div>
      </footer>
    </div>
  );
}
