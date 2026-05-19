import { useState } from "react";

import type { EnergyLevel } from "../types/medusa";

interface CheckInScreenProps {
  loading?: boolean;
  defaultEnergy: EnergyLevel | null;
  onConfirm: (energy: EnergyLevel) => Promise<void>;
}

export function CheckInScreen({ loading = false, defaultEnergy, onConfirm }: CheckInScreenProps) {
  const [energy, setEnergy] = useState<EnergyLevel>(defaultEnergy ?? 2);

  return (
    <div className="screen compact checkin-screen">
      <p className="eyebrow">Check-in</p>
      <h2>Energia agora?</h2>
      <p className="muted">Escolha um nível para iniciar o chat.</p>

      <div className="energy-grid">
        {[1, 2, 3].map((option) => (
          <button
            key={option}
            className={`energy-btn ${energy === option ? "energy-active" : ""}`}
            onClick={() => setEnergy(option as EnergyLevel)}
          >
            <span className="energy-number">{option}</span>
            <span className="energy-label">{option === 1 ? "Baixa" : option === 2 ? "Média" : "Alta"}</span>
          </button>
        ))}
      </div>

      <button className="primary-btn" onClick={() => onConfirm(energy)} disabled={loading}>
        {loading ? "Aguarde..." : "Entrar no chat"}
      </button>
    </div>
  );
}
