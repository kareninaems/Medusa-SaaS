import { useMemo, useState } from "react";

import type { ProfileOnboarding } from "../types/medusa";

interface OnboardingScreenProps {
  loading?: boolean;
  uploadingDocument?: boolean;
  defaultName: string;
  onUploadDocument: (file: File) => Promise<void>;
  onSave: (payload: { displayName: string; onboarding: ProfileOnboarding }) => Promise<void>;
}

const DAYS = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo", "Variável"];
const PERIODS = ["Manhã", "Tarde", "Noite", "Madrugada", "Comercial", "Plantões/turnos", "Variável"];
const EDUCATION_OPTIONS = [
  "Ensino médio",
  "Técnico",
  "Graduação",
  "Pós-graduação",
  "Mestrado/Doutorado",
  "Prefiro não informar",
  "Outro",
];
const PROFESSION_OPTIONS = [
  "Saúde",
  "Educação",
  "Tecnologia",
  "Gestão/empreendedorismo",
  "Estudante",
  "Cuidado/família",
  "Atendimento/serviços",
  "Prefiro não informar",
  "Outro",
];
const CONSTRAINT_OPTIONS = [
  "Sono irregular",
  "Plantões/turnos",
  "Deslocamento longo",
  "Filhos/cuidado de alguém",
  "Estudos",
  "Saúde",
  "Carga sensorial alta",
  "Carga emocional alta",
  "Pouco tempo livre",
  "Prefiro não informar",
  "Outro",
];
const BLOCKER_OPTIONS = [
  "Começar tarefas",
  "Priorizar",
  "Finalizar",
  "Responder mensagens",
  "Organizar casa",
  "Tomar decisões",
  "Medo de errar",
  "Sobrecarga",
  "Cansaço",
  "Disforia/desânimo",
  "Outro",
];
const LOW_ENERGY_OPTIONS = [
  "Uma tarefa pequena",
  "Pausa de 10 minutos",
  "Água/comida",
  "Sair do lugar",
  "Lista curta",
  "Silêncio",
  "Movimento",
  "Falar com alguém",
  "Dormir/descansar",
  "Outro",
];
const GUIDANCE_OPTIONS = ["Direta", "Acolhedora", "Técnica", "Mínima", "Passo a passo", "Sem rodeios"];
const LIMIT_OPTIONS = [
  "Não usar culpa",
  "Não dar muitas opções",
  "Não falar como terapeuta",
  "Não minimizar sentimento",
  "Não ser agressiva",
  "Não fazer texto longo",
  "Não insistir quando eu estiver sem energia",
  "Outro",
];
const TOTAL_STEPS = 7;

function toggleValue(current: string[], value: string) {
  return current.includes(value) ? current.filter((item) => item !== value) : [...current, value];
}

export function OnboardingScreen({
  loading = false,
  uploadingDocument = false,
  defaultName,
  onUploadDocument,
  onSave,
}: OnboardingScreenProps) {
  const [step, setStep] = useState(0);
  const [displayName, setDisplayName] = useState(defaultName);
  const [educationLevel, setEducationLevel] = useState("Graduação");
  const [educationOther, setEducationOther] = useState("");
  const [professionCategory, setProfessionCategory] = useState("Tecnologia");
  const [professionOther, setProfessionOther] = useState("");

  const [days, setDays] = useState<string[]>(["Segunda", "Terça", "Quarta", "Quinta", "Sexta"]);
  const [periods, setPeriods] = useState<string[]>(["Comercial"]);
  const [routineNotes, setRoutineNotes] = useState("");

  const [constraints, setConstraints] = useState<string[]>([]);
  const [constraintsOther, setConstraintsOther] = useState("");

  const [blockers, setBlockers] = useState<string[]>([]);
  const [blockersOther, setBlockersOther] = useState("");

  const [lowEnergyWorks, setLowEnergyWorks] = useState<string[]>([]);
  const [lowEnergyOther, setLowEnergyOther] = useState("");

  const [guidanceStyle, setGuidanceStyle] = useState("Direta");

  const [neverDo, setNeverDo] = useState<string[]>(["Não usar culpa"]);
  const [neverDoOther, setNeverDoOther] = useState("");

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState("");
  const [error, setError] = useState("");

  const canGoNext = useMemo(() => {
    if (step === 0) {
      if (!displayName.trim() || !educationLevel || !professionCategory) return false;
      if (educationLevel === "Outro" && !educationOther.trim()) return false;
      if (professionCategory === "Outro" && !professionOther.trim()) return false;
      return true;
    }
    if (step === 1) return days.length > 0 && periods.length > 0;
    if (step === 2) {
      if (constraints.length === 0) return false;
      if (constraints.includes("Outro") && !constraintsOther.trim()) return false;
      return true;
    }
    if (step === 3) {
      if (blockers.length === 0) return false;
      if (blockers.includes("Outro") && !blockersOther.trim()) return false;
      return true;
    }
    if (step === 4) {
      if (lowEnergyWorks.length === 0) return false;
      if (lowEnergyWorks.includes("Outro") && !lowEnergyOther.trim()) return false;
      return true;
    }
    if (step === 5) return !!guidanceStyle;
    if (step === 6) {
      if (neverDo.length === 0) return false;
      if (neverDo.includes("Outro") && !neverDoOther.trim()) return false;
      return true;
    }
    return false;
  }, [
    blockers,
    blockersOther,
    constraints,
    constraintsOther,
    days.length,
    displayName,
    educationLevel,
    educationOther,
    guidanceStyle,
    lowEnergyOther,
    lowEnergyWorks,
    neverDo,
    neverDoOther,
    periods.length,
    professionCategory,
    professionOther,
    step,
  ]);

  const uploadSelectedDocument = async () => {
    if (!selectedFile) {
      setUploadStatus("Selecione um PDF antes de enviar.");
      return;
    }

    setUploadStatus("");
    try {
      await onUploadDocument(selectedFile);
      setSelectedFile(null);
      setUploadStatus("PDF enviado com sucesso. Extração permanece pendente no MVP.");
    } catch {
      setUploadStatus("Não foi possível enviar o PDF agora.");
    }
  };

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
        education_level_other: educationLevel === "Outro" ? educationOther.trim() : null,
        profession_category: professionCategory,
        profession_other: professionCategory === "Outro" ? professionOther.trim() : null,
        constraints,
        constraints_other: constraints.includes("Outro") ? constraintsOther.trim() : null,
        blockers,
        blockers_other: blockers.includes("Outro") ? blockersOther.trim() : null,
        low_energy_works: lowEnergyWorks,
        low_energy_works_other: lowEnergyWorks.includes("Outro") ? lowEnergyOther.trim() : null,
        guidance_style: guidanceStyle,
        never_do: neverDo,
        never_do_other: neverDo.includes("Outro") ? neverDoOther.trim() : null,
        routine: {
          days,
          periods,
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
          <h2>Identidade e contexto</h2>
          <label className="field">
            <span>Nome de exibição</span>
            <input
              data-testid="onboarding-display-name-input"
              className="input"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="Seu nome no app"
            />
          </label>
          <label className="field">
            <span>Escolaridade</span>
            <select
              data-testid="onboarding-education-select"
              className="input"
              value={educationLevel}
              onChange={(event) => setEducationLevel(event.target.value)}
            >
              {EDUCATION_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          {educationLevel === "Outro" ? (
            <label className="field">
              <span>Outro (escolaridade)</span>
              <input
                data-testid="onboarding-education-other-input"
                className="input"
                value={educationOther}
                onChange={(event) => setEducationOther(event.target.value)}
                placeholder="Descreva em poucas palavras"
              />
            </label>
          ) : null}
          <label className="field">
            <span>Profissão/ocupação</span>
            <select
              data-testid="onboarding-profession-select"
              className="input"
              value={professionCategory}
              onChange={(event) => setProfessionCategory(event.target.value)}
            >
              {PROFESSION_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          {professionCategory === "Outro" ? (
            <label className="field">
              <span>Outro (profissão/ocupação)</span>
              <input
                data-testid="onboarding-profession-other-input"
                className="input"
                value={professionOther}
                onChange={(event) => setProfessionOther(event.target.value)}
                placeholder="Descreva em poucas palavras"
              />
            </label>
          ) : null}
        </>
      );
    }

    if (step === 1) {
      return (
        <>
          <h2>Rotina</h2>
          <p className="muted">Selecione dias e períodos mais comuns.</p>
          <div className="chips-wrap">
            {DAYS.map((day) => (
              <button
                type="button"
                key={day}
                data-testid={`onboarding-day-chip-${day.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
                className={`chip ${days.includes(day) ? "chip-active" : ""}`}
                onClick={() => setDays((current) => toggleValue(current, day))}
              >
                {day}
              </button>
            ))}
          </div>
          <div className="chips-wrap">
            {PERIODS.map((period) => (
              <button
                type="button"
                key={period}
                data-testid={`onboarding-period-chip-${period.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
                className={`chip ${periods.includes(period) ? "chip-active" : ""}`}
                onClick={() => setPeriods((current) => toggleValue(current, period))}
              >
                {period}
              </button>
            ))}
          </div>
          <label className="field">
            <span>Alguma observação da rotina? (opcional)</span>
            <input
              data-testid="onboarding-routine-notes-input"
              className="input"
              value={routineNotes}
              onChange={(event) => setRoutineNotes(event.target.value)}
              placeholder="Ex: tardes com mais reuniões"
            />
          </label>
        </>
      );
    }

    if (step === 2) {
      return (
        <>
          <h2>Restrições</h2>
          <div className="chips-wrap">
            {CONSTRAINT_OPTIONS.map((option) => (
              <button
                type="button"
                key={option}
                data-testid={`onboarding-constraint-chip-${option.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
                className={`chip ${constraints.includes(option) ? "chip-active" : ""}`}
                onClick={() => setConstraints((current) => toggleValue(current, option))}
              >
                {option}
              </button>
            ))}
          </div>
          {constraints.includes("Outro") ? (
            <label className="field">
              <span>Outro (restrições)</span>
              <input
                data-testid="onboarding-constraints-other-input"
                className="input"
                value={constraintsOther}
                onChange={(event) => setConstraintsOther(event.target.value)}
                placeholder="Descreva em poucas palavras"
              />
            </label>
          ) : null}
        </>
      );
    }

    if (step === 3) {
      return (
        <>
          <h2>Travas</h2>
          <div className="chips-wrap">
            {BLOCKER_OPTIONS.map((option) => (
              <button
                type="button"
                key={option}
                data-testid={`onboarding-blocker-chip-${option.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
                className={`chip ${blockers.includes(option) ? "chip-active" : ""}`}
                onClick={() => setBlockers((current) => toggleValue(current, option))}
              >
                {option}
              </button>
            ))}
          </div>
          {blockers.includes("Outro") ? (
            <label className="field">
              <span>Outro (travas)</span>
              <input
                data-testid="onboarding-blockers-other-input"
                className="input"
                value={blockersOther}
                onChange={(event) => setBlockersOther(event.target.value)}
                placeholder="Descreva em poucas palavras"
              />
            </label>
          ) : null}
        </>
      );
    }

    if (step === 4) {
      return (
        <>
          <h2>Energia baixa</h2>
          <div className="chips-wrap">
            {LOW_ENERGY_OPTIONS.map((option) => (
              <button
                type="button"
                key={option}
                data-testid={`onboarding-low-energy-chip-${option.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
                className={`chip ${lowEnergyWorks.includes(option) ? "chip-active" : ""}`}
                onClick={() => setLowEnergyWorks((current) => toggleValue(current, option))}
              >
                {option}
              </button>
            ))}
          </div>
          {lowEnergyWorks.includes("Outro") ? (
            <label className="field">
              <span>Outro (energia baixa)</span>
              <input
                data-testid="onboarding-low-energy-other-input"
                className="input"
                value={lowEnergyOther}
                onChange={(event) => setLowEnergyOther(event.target.value)}
                placeholder="Descreva em poucas palavras"
              />
            </label>
          ) : null}
        </>
      );
    }

    if (step === 5) {
      return (
        <>
          <h2>Estilo de orientação</h2>
          <div className="chips-wrap">
            {GUIDANCE_OPTIONS.map((option) => (
              <button
                type="button"
                key={option}
                data-testid={`onboarding-guidance-chip-${option.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
                className={`chip ${guidanceStyle === option ? "chip-active" : ""}`}
                onClick={() => setGuidanceStyle(option)}
              >
                {option}
              </button>
            ))}
          </div>
        </>
      );
    }

    return (
      <>
        <h2>Limites da Medusa + PDF opcional</h2>
        <div className="chips-wrap">
          {LIMIT_OPTIONS.map((option) => (
            <button
              type="button"
              key={option}
                data-testid={`onboarding-limit-chip-${option.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
              className={`chip ${neverDo.includes(option) ? "chip-active" : ""}`}
              onClick={() => setNeverDo((current) => toggleValue(current, option))}
            >
              {option}
            </button>
          ))}
        </div>
        {neverDo.includes("Outro") ? (
          <label className="field">
            <span>Outro (limites)</span>
            <input
              data-testid="onboarding-limits-other-input"
              className="input"
              value={neverDoOther}
              onChange={(event) => setNeverDoOther(event.target.value)}
              placeholder="Descreva em poucas palavras"
            />
          </label>
        ) : null}

        <div className="onboarding-upload-box">
          <p className="muted">
            Adicionar PDF ou laudo (opcional). Use apenas se quiser que a Medusa considere um documento seu. Evite enviar
            documentos de terceiros.
          </p>
          <input
            data-testid="onboarding-pdf-input"
            className="input"
            type="file"
            accept="application/pdf"
            onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
          />
          <button
            data-testid="onboarding-upload-pdf-button"
            type="button"
            className="ghost-btn"
            onClick={uploadSelectedDocument}
            disabled={uploadingDocument}
          >
            {uploadingDocument ? "Enviando PDF..." : "Enviar PDF"}
          </button>
          {uploadStatus ? <p className="status-ok" data-testid="onboarding-upload-status">{uploadStatus}</p> : null}
        </div>
      </>
    );
  };

  return (
    <div className="screen onboarding-screen" data-testid="onboarding-screen">
      <div className="screen-header">
        <p className="eyebrow">Onboarding</p>
        <p className="muted">
          {step + 1} de {TOTAL_STEPS}
        </p>
      </div>

      <div className="stack onboarding-wizard" data-testid="onboarding-wizard">
        {renderStep()}
        {error ? <p className="status-error" data-testid="onboarding-error-message">{error}</p> : null}
        <div className="wizard-actions">
          <button data-testid="onboarding-back-button" className="ghost-btn" onClick={prevStep} disabled={step === 0 || loading}>
            Voltar
          </button>
          {step < TOTAL_STEPS - 1 ? (
            <button data-testid="onboarding-continue-button" className="primary-btn" onClick={nextStep} disabled={loading}>
              Continuar
            </button>
          ) : (
            <button data-testid="onboarding-save-button" className="primary-btn" onClick={saveOnboarding} disabled={loading}>
              {loading ? "Salvando" : "Salvar onboarding"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
