interface PaywallScreenProps {
  onCheckout: () => Promise<void>;
  loading?: boolean;
  error?: string;
}

export function PaywallScreen({ onCheckout, loading = false, error = "" }: PaywallScreenProps) {
  return (
    <div className="screen compact" data-testid="paywall-screen">
      <p className="eyebrow">Medusa Pro</p>
      <h2>Desbloqueie o acesso completo</h2>
      <p className="muted">
        Com o Medusa Pro você tem acesso ilimitado ao assistente adaptado ao seu perfil
        neurodivergente, histórico persistente, análise de documentos e memória inteligente.
        Uma assinatura mensal para transformar a forma como você trabalha.
      </p>

      <p data-testid="paywall-price" style={{ fontSize: "1.5rem", fontWeight: 700, margin: "1rem 0" }}>
        {import.meta.env.VITE_SUBSCRIPTION_PRICE ?? "R$ 29,90 / mês"}
      </p>

      <button
        data-testid="paywall-checkout-button"
        className="primary-btn"
        onClick={onCheckout}
        disabled={loading}
      >
        {loading ? "Abrindo checkout..." : "Assinar agora"}
      </button>

      {error ? (
        <div className="status-error" data-testid="paywall-checkout-error" style={{ marginTop: "0.75rem" }}>
          <strong>Checkout indisponivel.</strong>
          <br />
          {error}
          <br />
          Tente novamente em alguns instantes. Se persistir, verifique a configuracao da Edge Function Stripe.
        </div>
      ) : null}

      <button
        data-testid="paywall-restore-button"
        className="ghost-btn"
        onClick={onCheckout}
        disabled={loading}
        style={{ marginTop: "0.75rem" }}
      >
        Já tenho assinatura
      </button>
    </div>
  );
}
