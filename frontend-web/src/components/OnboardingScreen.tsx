import { useMemo, useState } from "react";
import type { FormEvent } from "react";

import type { ProfileOnboarding } from "../types/medusa";

interface OnboardingScreenProps {
  loading?: boolean;
  defaultName: string;
  onSave: (payload: { displayName: string; onboarding: ProfileOnboarding }) => Promise<void>;
}

const DAYS = ["segunda", "terça", "quarta", "quinta", "sexta", "sábado", "domingo"];

export function OnboardingScreen({ loading = false, defaultName, onSave }: OnboardingScreenProps) {
  const [displayName, setDisplayName] = useState(defaultName);
  const [educationLevel, setEducationLevel] = useState("graduação");
  const [profession, setProfession] = useState("");
  const [constraints, setConstraints] = useState("");
  const [days, setDays] = useState<string[]>(["segunda", "terça", "quarta", "quinta", "sexta"]);
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("18:00");
  const [variableSchedule, setVariableSchedule] = useState(false);
  const [routineNotes, setRoutineNotes] = useState("");
  const [error, setError] = useState("");

  const progressText = useMemo(() => {
    if (!profession.trim()) return "Etapa 1/3";
    if (!constraints.trim()) return "Etapa 2/3";
    return "Etapa 3/3";
  }, [profession, constraints]);

  const toggleDay = (day: string) => {
    setDays((current) =>
      current.includes(day) ? current.filter((item) => item !== day) : [...current, day],
    );
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");

    if (!profession.trim()) {
      setError("Profissão/ocupação é obrigatória.");
      return;
    }
    if (days.length === 0) {
      setError("Selecione ao menos um dia da rotina principal.");
      return;
    }

    await onSave({
      displayName: displayName.trim() || defaultName,
      onboarding: {
        education_level: educationLevel,
        profession: profession.trim(),
        constraints: constraints.trim(),
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

  return (
    <div className="screen">
      <div className="screen-header">
        <p className="eyebrow">ONBOARDING COGNITIVO</p>
        <h2>Configurar base pessoal da Medusa</h2>
        <p className="muted">{progressText}</p>
      </div>

      <form className="stack onboarding" onSubmit={handleSubmit}>
        <label className="field">
          <span>Nome de exibição</span>
          <input
            className="input"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder="Como você quer ser chamada(o)?"
          />
        </label>

        <label className="field">
          <span>Escolaridade</span>
          <select
            className="input"
            value={educationLevel}
            onChange={(event) => setEducationLevel(event.target.value)}
          >
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
            placeholder="Ex: médica, estudante, professora, dev..."
            required
          />
        </label>

        <fieldset className="field-set">
          <legend>Rotina principal</legend>
          <p className="muted">Você trabalha/estuda em quais dias?</p>
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
              <input
                className="input"
                type="time"
                value={startTime}
                onChange={(event) => setStartTime(event.target.value)}
              />
            </label>
            <label className="field">
              <span>Fim típico</span>
              <input
                className="input"
                type="time"
                value={endTime}
                onChange={(event) => setEndTime(event.target.value)}
              />
            </label>
          </div>

          <label className="check-row">
            <input
              type="checkbox"
              checked={variableSchedule}
              onChange={(event) => setVariableSchedule(event.target.checked)}
            />
            <span>Tenho plantões/turnos/horários variáveis.</span>
          </label>

          <label className="field">
            <span>Blocos mais difíceis do dia</span>
            <textarea
              className="input textarea"
              value={routineNotes}
              onChange={(event) => setRoutineNotes(event.target.value)}
              placeholder="Ex: começo da manhã, pós-almoço, noite com cansaço."
            />
          </label>
        </fieldset>

        <label className="field">
          <span>Restrições de rotina</span>
          <textarea
            className="input textarea"
            value={constraints}
            onChange={(event) => setConstraints(event.target.value)}
            placeholder="Ex: filhos, plantões, sono irregular, deslocamento, estudo, saúde..."
          />
        </label>

        {error ? <p className="status-error">{error}</p> : null}
        <button className="primary-btn" type="submit" disabled={loading}>
          {loading ? "Salvando..." : "Entrar no produto"}
        </button>
      </form>
    </div>
  );
}
