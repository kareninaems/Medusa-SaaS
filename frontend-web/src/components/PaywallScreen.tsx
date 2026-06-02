interface PaywallScreenProps {
  onCheckout: () => Promise<void>;
  loading?: boolean;
}

export function PaywallScreen({ onCheckout, loading = false }: PaywallScreenProps) {
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
        {loading ? "Aguarde..." : "Assinar agora"}
      </button>

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
