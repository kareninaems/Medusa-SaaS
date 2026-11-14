import { useState } from "react";

import { MAX_OVERLOAD_SIGNALS, parseSignals } from "../services/overloadSignals";
import type { EnergyLevel } from "../types/medusa";

interface CheckInScreenProps {
  loading?: boolean;
  defaultEnergy: EnergyLevel | null;
  showWelcome?: boolean;
  displayName?: string | null;
  overloadSignals?: string[];
  onSaveSignals?: (signals: string[]) => Promise<void>;
  onConfirm: (energy: EnergyLevel, markedSignals: string[]) => Promise<void>;
}

const ENERGY_LEVELS: Array<{ level: EnergyLevel; label: string; description: string }> = [
  {
    level: 1,
    label: "Baixa",
    description: "Corpo pesado. Decidir ou falar custa. Barulho e luz incomodam.",
  },
  {
    level: 2,
    label: "Média",
    description: "Consigo fazer, com esforço. Uma coisa por vez. Canso rápido.",
  },
  {
    level: 3,
    label: "Alta",
    description: "Cabeça clara. Consigo começar e trocar de tarefa sem travar.",
  },
];

export function CheckInScreen({
  loading = false,
  defaultEnergy,
  showWelcome = false,
  displayName,
  overloadSignals = [],
  onSaveSignals,
  onConfirm,
}: CheckInScreenProps) {
  const [energy, setEnergy] = useState<EnergyLevel>(defaultEnergy ?? 2);
  const [marked, setMarked] = useState<string[]>([]);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(overloadSignals.join("\n"));
  const [savingSignals, setSavingSignals] = useState(false);
  const [signalsError, setSignalsError] = useState("");

  const toggleSignal = (signal: string) => {
    setMarked((current) =>
      current.includes(signal) ? current.filter((item) => item !== signal) : [...current, signal],
    );
  };

  const handleSaveSignals = async () => {
    if (!onSaveSignals) return;
    const parsed = parseSignals(draft);
    setSavingSignals(true);
    setSignalsError("");
    try {
      await onSaveSignals(parsed);
      setMarked((current) => current.filter((item) => parsed.includes(item)));
      setDraft(parsed.join("\n"));
      setEditing(false);
    } catch (saveError) {
      setSignalsError(saveError instanceof Error ? saveError.message : "Falha ao salvar os sinais");
    } finally {
      setSavingSignals(false);
    }
  };

  return (
    <div className="screen compact checkin-screen" data-testid="checkin-screen">
      {showWelcome ? (
        <div className="signal-card signal-followup" data-testid="post-onboarding-welcome">
          <p className="signal-title">Boas-vindas, {displayName || "você"}</p>
          <p className="signal-copy">
            Sua base inicial está pronta. Agora a Medusa usa seu check-in de energia para ajustar o tamanho do próximo passo.
          </p>
        </div>
      ) : null}

      <p className="eyebrow">Check-in</p>
      <h2>Energia agora?</h2>
      <p className="muted">Escolha o nível que mais se parece com agora. Em dúvida entre dois? Escolha o menor.</p>

      <div className="energy-grid">
        {ENERGY_LEVELS.map((option) => (
          <button
            type="button"
            data-testid={`checkin-energy-option-${option.level}`}
            key={option.level}
            aria-pressed={energy === option.level}
            className={`energy-btn ${energy === option.level ? "energy-active" : ""}`}
            onClick={() => setEnergy(option.level)}
          >
            <span className="energy-number">{option.level}</span>
            <span className="energy-label">{option.label}</span>
            <span className="energy-desc">{option.description}</span>
          </button>
        ))}
      </div>

      {onSaveSignals ? (
        <div className="signal-card" data-testid="overload-signals-card">
          <p className="signal-title">Sinais de sobrecarga hoje</p>
          {overloadSignals.length > 0 ? (
            <>
              <p className="signal-copy">Marque o que apareceu hoje. Pode deixar em branco.</p>
              <div className="chips-wrap">
                {overloadSignals.map((signal) => (
                  <button
                    type="button"
                    key={signal}
                    aria-pressed={marked.includes(signal)}
                    className={`chip ${marked.includes(signal) ? "chip-active" : ""}`}
                    onClick={() => toggleSignal(signal)}
                  >
                    {signal}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <p className="signal-copy">
              Cadastre o que costuma aparecer antes de uma crise sua. A Medusa passa a vigiar esses sinais e avisa quando eles se acumulam.
            </p>
          )}

          {editing ? (
            <div className="stack">
              <label className="field">
                <span className="signal-copy">Um sinal por linha, até {MAX_OVERLOAD_SIGNALS}.</span>
                <textarea
                  className="input textarea"
                  data-testid="overload-signals-input"
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder={"dormi mal\nbarulho me irritando\ncancelei compromisso"}
                />
              </label>
              {signalsError ? <p className="status-error">{signalsError}</p> : null}
              <div className="followup-actions">
                <button type="button" className="ghost-btn" onClick={handleSaveSignals} disabled={savingSignals}>
                  {savingSignals ? "Salvando..." : "Salvar sinais"}
                </button>
                <button type="button" className="ghost-btn" onClick={() => setEditing(false)} disabled={savingSignals}>
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="link-btn"
              style={{ alignSelf: "flex-start", minHeight: "44px" }}
              data-testid="overload-signals-edit-button"
              onClick={() => setEditing(true)}
            >
              {overloadSignals.length > 0 ? "Editar meus sinais" : "Cadastrar meus sinais"}
            </button>
          )}
        </div>
      ) : null}

      <button
        data-testid="checkin-confirm-button"
        className="primary-btn"
        onClick={() => onConfirm(energy, marked)}
        disabled={loading}
      >
        {loading ? "Aguarde..." : "Entrar no chat"}
      </button>
    </div>
  );
}
