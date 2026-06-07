import { useState } from "react";

interface PaywallScreenProps {
  onCheckout: () => Promise<void>;
  onRestoreSubscription?: () => Promise<void>;
  loading?: boolean;
  error?: string;
}

export function PaywallScreen({
  onCheckout,
  onRestoreSubscription,
  loading = false,
  error = "",
}: PaywallScreenProps) {
  const [restoringSubscription, setRestoringSubscription] = useState(false);

  const handleRestore = async () => {
    if (!onRestoreSubscription) return;
    setRestoringSubscription(true);
    try {
      await onRestoreSubscription();
    } finally {
      setRestoringSubscription(false);
    }
  };

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

      {error ? (
        <div className="status-error" data-testid="paywall-checkout-error" style={{ marginBottom: "0.75rem" }}>
          <strong>Checkout indisponível.</strong>
          <br />
          {error}
          <br />
          Tente novamente em alguns instantes.
        </div>
      ) : null}

      <button
        data-testid="paywall-checkout-button"
        className="primary-btn"
        onClick={onCheckout}
        disabled={loading || restoringSubscription}
      >
        {loading ? "Abrindo checkout..." : "Assinar agora"}
      </button>

      {onRestoreSubscription ? (
        <button
          data-testid="paywall-restore-button"
          className="ghost-btn"
          onClick={handleRestore}
          disabled={loading || restoringSubscription}
          style={{ marginTop: "0.75rem" }}
        >
          {restoringSubscription ? "Verificando..." : "Já tenho assinatura"}
        </button>
      ) : null}
    </div>
  );
}
