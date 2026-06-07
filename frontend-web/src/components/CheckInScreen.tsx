import { useState } from "react";

import type { EnergyLevel } from "../types/medusa";

interface CheckInScreenProps {
  loading?: boolean;
  defaultEnergy: EnergyLevel | null;
  showWelcome?: boolean;
  displayName?: string | null;
  onConfirm: (energy: EnergyLevel) => Promise<void>;
}

export function CheckInScreen({
  loading = false,
  defaultEnergy,
  showWelcome = false,
  displayName,
  onConfirm,
}: CheckInScreenProps) {
  const [energy, setEnergy] = useState<EnergyLevel>(defaultEnergy ?? 2);

  return (
    <div className="screen compact checkin-screen" data-testid="checkin-screen">
      {showWelcome ? (
        <div className="signal-card signal-followup" data-testid="post-onboarding-welcome">
          <p className="signal-title">Boas-vindas, {displayName || "voce"}</p>
          <p className="signal-copy">
            Sua base inicial esta pronta. Agora a Medusa usa seu check-in de energia para ajustar o tamanho do proximo passo.
          </p>
        </div>
      ) : null}

      <p className="eyebrow">Check-in</p>
      <h2>Energia agora?</h2>
      <p className="muted">Escolha um nível para iniciar o chat.</p>

      <div className="energy-grid">
        {[1, 2, 3].map((option) => (
          <button
            data-testid={`checkin-energy-option-${option}`}
            key={option}
            className={`energy-btn ${energy === option ? "energy-active" : ""}`}
            onClick={() => setEnergy(option as EnergyLevel)}
          >
            <span className="energy-number">{option}</span>
            <span className="energy-label">{option === 1 ? "Baixa" : option === 2 ? "Média" : "Alta"}</span>
          </button>
        ))}
      </div>

      <button data-testid="checkin-confirm-button" className="primary-btn" onClick={() => onConfirm(energy)} disabled={loading}>
        {loading ? "Aguarde..." : "Entrar no chat"}
      </button>
    </div>
  );
}
