import { useMemo, useState } from "react";

import type { ProfileOnboarding } from "../types/medusa";

interface OnboardingScreenProps {
  loading?: boolean;
  defaultName: string;
  onSave: (payload: { displayName: string; onboarding: ProfileOnboarding }) => Promise<void>;
}

const DAYS = ["segunda", "terça", "quarta", "quinta", "sexta", "sábado", "domingo"];
const TOTAL_STEPS = 6;

export function OnboardingScreen({ loading = false, defaultName, onSave }: OnboardingScreenProps) {
  const [step, setStep] = useState(0);
  const [displayName, setDisplayName] = useState(defaultName);
  const [educationLevel, setEducationLevel] = useState("graduação");
  const [profession, setProfession] = useState("");
  const [constraints, setConstraints] = useState("");
  const [blockers, setBlockers] = useState("");
  const [lowEnergyWorks, setLowEnergyWorks] = useState("");
  const [guidanceStyle, setGuidanceStyle] = useState("direta");
  const [knownPatterns, setKnownPatterns] = useState("");
  const [neverDo, setNeverDo] = useState("");
  const [days, setDays] = useState<string[]>(["segunda", "terça", "quarta", "quinta", "sexta"]);
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("18:00");
  const [variableSchedule, setVariableSchedule] = useState(false);
  const [routineNotes, setRoutineNotes] = useState("");
  const [error, setError] = useState("");

  const toggleDay = (day: string) => {
    setDays((current) =>
      current.includes(day) ? current.filter((item) => item !== day) : [...current, day],
    );
  };

  const canGoNext = useMemo(() => {
    if (step === 0) return !!displayName.trim();
    if (step === 1) return !!profession.trim();
    if (step === 2) return days.length > 0;
    if (step === 3) return !!constraints.trim();
    if (step === 4) return !!blockers.trim() && !!lowEnergyWorks.trim();
    if (step === 5) return !!knownPatterns.trim() && !!neverDo.trim();
    return false;
  }, [
    step,
    displayName,
    profession,
    days.length,
    constraints,
    blockers,
    lowEnergyWorks,
    knownPatterns,
    neverDo,
  ]);

  const saveOnboarding = async () => {
    setError("");

    if (!canGoNext) {
      setError("Preencha esta etapa para continuar.");
      return;
    }

    await onSave({
      displayName: displayName.trim() || defaultName,
      onboarding: {
        education_level: educationLevel,
        profession: profession.trim(),
        constraints: constraints.trim(),
        blockers: blockers.trim(),
        low_energy_works: lowEnergyWorks.trim(),
        guidance_style: guidanceStyle,
        known_patterns: knownPatterns.trim(),
        never_do: neverDo.trim(),
        routine: {
          days,
          start_time: startTime,
          end_time: endTime,
          variable_schedule: variableSchedule,
          notes: routineNotes.trim(),
        },
      },
    });
  };

  const nextStep = () => {
    if (!canGoNext) {
      setError("Preencha esta etapa para continuar.");
      return;
    }
    setError("");
    setStep((current) => Math.min(current + 1, TOTAL_STEPS - 1));
  };

  const prevStep = () => {
    setError("");
    setStep((current) => Math.max(current - 1, 0));
  };

  const renderStep = () => {
    if (step === 0) {
      return (
        <>
          <h2>Como você quer ser chamada(o)?</h2>
          <label className="field">
            <span>Nome de exibição</span>
            <input
              className="input"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="Seu nome no app"
            />
          </label>
        </>
      );
    }

    if (step === 1) {
      return (
        <>
          <h2>Qual é sua base hoje?</h2>
          <label className="field">
            <span>Escolaridade</span>
            <select className="input" value={educationLevel} onChange={(event) => setEducationLevel(event.target.value)}>
              <option>ensino médio</option>
              <option>graduação</option>
              <option>pós</option>
              <option>mestrado</option>
              <option>doutorado</option>
              <option>técnico</option>
              <option>outro</option>
            </select>
          </label>
          <label className="field">
            <span>Profissão / ocupação</span>
            <input
              className="input"
              value={profession}
              onChange={(event) => setProfession(event.target.value)}
              placeholder="Ex: analista, estudante, professora"
            />
          </label>
        </>
      );
    }

    if (step === 2) {
      return (
        <>
          <h2>Como é sua rotina principal?</h2>
          <p className="muted">Selecione os dias e horários típicos.</p>
          <div className="chips-wrap">
            {DAYS.map((day) => (
              <button
                type="button"
                key={day}
                className={`chip ${days.includes(day) ? "chip-active" : ""}`}
                onClick={() => toggleDay(day)}
              >
                {day}
              </button>
            ))}
          </div>
          <div className="time-row">
            <label className="field">
              <span>Início típico</span>
              <input className="input" type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} />
            </label>
            <label className="field">
              <span>Fim típico</span>
              <input className="input" type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} />
            </label>
          </div>
          <label className="check-row">
            <input
              type="checkbox"
              checked={variableSchedule}
              onChange={(event) => setVariableSchedule(event.target.checked)}
            />
            <span>Tenho horários variáveis.</span>
          </label>
          <label className="field">
            <span>Blocos mais difíceis</span>
            <textarea
              className="input textarea"
              value={routineNotes}
              onChange={(event) => setRoutineNotes(event.target.value)}
              placeholder="Ex: fim da tarde com cansaço"
            />
          </label>
        </>
      );
    }

    if (step === 3) {
      return (
        <>
          <h2>Quais restrições precisam ser respeitadas?</h2>
          <label className="field">
            <span>Restrições de rotina</span>
            <textarea
              className="input textarea"
              value={constraints}
              onChange={(event) => setConstraints(event.target.value)}
              placeholder="Ex: deslocamento, filhos, plantões, saúde"
            />
          </label>
        </>
      );
    }

    if (step === 4) {
      return (
        <>
          <h2>Quando trava, o que acontece?</h2>
          <label className="field">
            <span>O que costuma te travar?</span>
            <textarea
              className="input textarea"
              value={blockers}
              onChange={(event) => setBlockers(event.target.value)}
              placeholder="Ex: sobrecarga, medo de errar"
            />
          </label>
          <label className="field">
            <span>O que funciona em energia baixa?</span>
            <textarea
              className="input textarea"
              value={lowEnergyWorks}
              onChange={(event) => setLowEnergyWorks(event.target.value)}
              placeholder="Ex: uma tarefa curta e pausa"
            />
          </label>
        </>
      );
    }

    return (
      <>
        <h2>Como você quer receber orientação?</h2>
        <label className="field">
          <span>Estilo preferido</span>
          <select className="input" value={guidanceStyle} onChange={(event) => setGuidanceStyle(event.target.value)}>
            <option value="direta">direta</option>
            <option value="acolhedora">acolhedora</option>
            <option value="técnica">técnica</option>
            <option value="mínima">mínima</option>
          </select>
        </label>
        <label className="field">
          <span>Padrões que você já reconhece</span>
          <textarea
            className="input textarea"
            value={knownPatterns}
            onChange={(event) => setKnownPatterns(event.target.value)}
            placeholder="Ex: adiar tarefas complexas"
          />
        </label>
        <label className="field">
          <span>O que a Medusa nunca deve fazer</span>
          <textarea
            className="input textarea"
            value={neverDo}
            onChange={(event) => setNeverDo(event.target.value)}
            placeholder="Ex: usar culpa ou ordens agressivas"
          />
        </label>
      </>
    );
  };

  return (
    <div className="screen onboarding-screen">
      <div className="screen-header">
        <p className="eyebrow">Onboarding</p>
        <p className="muted">
          {step + 1} de {TOTAL_STEPS}
        </p>
      </div>

      <div className="stack onboarding-wizard">
        {renderStep()}
        {error ? <p className="status-error">{error}</p> : null}
        <div className="wizard-actions">
          <button className="ghost-btn" onClick={prevStep} disabled={step === 0 || loading}>
            Voltar
          </button>
          {step < TOTAL_STEPS - 1 ? (
            <button className="primary-btn" onClick={nextStep} disabled={loading}>
              Continuar
            </button>
          ) : (
            <button className="primary-btn" onClick={saveOnboarding} disabled={loading}>
              {loading ? "Salvando" : "Salvar"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
