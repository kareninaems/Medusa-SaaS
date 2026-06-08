interface PricingScreenProps {
  trialDaysRemaining: number;
  onStartCheckout: () => Promise<void>;
  billingLoading?: boolean;
}

export function PricingScreen({
  trialDaysRemaining,
  onStartCheckout,
  billingLoading = false,
}: PricingScreenProps) {
  const trialExpired = trialDaysRemaining <= 0;

  return (
    <section className="screen" data-testid="pricing-screen">
      <p className="eyebrow">Planos</p>
      <h2>{trialExpired ? "Seu período gratuito acabou" : "Plano MedusaET"}</h2>
      <p className="muted" data-testid="pricing-description">
        {trialExpired
          ? "Para continuar no chat da Medusa, ative sua assinatura mensal."
          : `Você ainda tem ${trialDaysRemaining} dia(s) de teste gratuito.`}
      </p>

      <div className="pricing-card" data-testid="pricing-plan-card">
        <strong>MedusaET Pro</strong>
        <p>R$ 49,00 / mês</p>
        <p className="muted">Acesso completo ao fluxo cognitivo, memória e suporte contínuo.</p>
      </div>

      <button
        data-testid="pricing-checkout-button"
        className="primary-btn"
        onClick={onStartCheckout}
        disabled={billingLoading}
      >
        {billingLoading ? "Abrindo checkout..." : "Assinar agora"}
      </button>
    </section>
  );
}
