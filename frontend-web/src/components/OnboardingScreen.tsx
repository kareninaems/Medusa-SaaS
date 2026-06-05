import { useState } from "react";

import type { ProfileOnboarding } from "../types/medusa";

interface OnboardingScreenProps {
  loading?: boolean;
  uploadingDocument?: boolean;
  defaultName: string;
  onUploadDocument: (files: File[]) => Promise<void>;
  onAutoSave?: (partial: Partial<ProfileOnboarding>) => Promise<void>;
  onSave: (payload: { displayName: string; onboarding: ProfileOnboarding }) => Promise<void>;
}

const TOTAL_BLOCKS = 5;

const IDENTIFICATION_OPTIONS = [
  "TDAH",
  "Autismo (TEA)",
  "Dislexia",
  "Altas Habilidades/Superdotação",
  "Prefiro não dizer",
  "Ainda estou me descobrindo",
  "Outro",
];

const DIAGNOSIS_TIME_OPTIONS = [
  "Menos de 1 ano",
  "1 a 3 anos",
  "Mais de 3 anos",
  "Ainda não tenho certeza",
];

const IN_TREATMENT_OPTIONS: { label: string; value: "sim" | "nao" | "prefiro nao responder" }[] = [
  { label: "Sim", value: "sim" },
  { label: "Não", value: "nao" },
  { label: "Prefiro não responder", value: "prefiro nao responder" },
];

const DAILY_DIFFICULTIES_OPTIONS = [
  "Iniciar tarefas (procrastinação)",
  "Manter o foco em uma coisa só",
  "Gerenciar tempo e prazos",
  "Lidar com interrupções ou mudanças de plano",
  "Organizar espaços e objetos físicos",
  "Organizar pensamentos e ideias",
  "Cansaço mental excessivo",
  "Sobrecarga sensorial (barulho, luz, texturas)",
  "Esquecimentos frequentes",
  "Paralisia diante de muitas opções",
  "Comunicação social",
  "Outro",
];

const INSTRUCTION_PREFERENCE_OPTIONS = [
  "Um passo de cada vez, bem detalhado",
  "Visão geral primeiro, depois os detalhes",
  "Apenas o essencial, sem excesso",
  "Prefiro exemplos ou analogias",
];

const DEADLINE_REACTION_OPTIONS = [
  "Me motivo, mas deixo para a última hora",
  "Me paraliso, preciso de ajuda para dividir",
  "Ignoro se não forem rígidos",
  "Funciono bem com lembretes externos",
];

const REMINDER_STYLE_OPTIONS = [
  "Gentilmente, com opção de escolha",
  "Direto ao ponto, sem rodeios",
  "Com humor e leveza",
  "Prefiro não ser cobrado(a)",
];

const BLOCKERS_OPTIONS = [
  "Muitas tarefas ao mesmo tempo",
  "Falta de instruções claras",
  "Ambientes barulhentos ou caóticos",
  "Medo de errar ou perfeccionismo",
  "Críticas ou pressão externa",
  "Não saber por onde começar",
  "Cansaço acumulado",
];

const UNBLOCKERS_OPTIONS = [
  "Dividir a tarefa em micro passos",
  "Ter alguém por perto em silêncio (body double)",
  "Música ou fones de ouvido",
  "Recompensa imediata ao terminar",
  "Um empurrãozinho gentil",
  "Silêncio e ambiente escuro",
  "Mexer o corpo ou mudar de ambiente",
  "Outro",
];

const ENERGY_PERIOD_OPTIONS = ["Manhã", "Tarde", "Noite", "Varia muito"];

const MEDUSA_GOALS_OPTIONS = [
  "Ajuda para organizar o dia",
  "Suporte para momentos de travamento",
  "Estratégias para lidar com meu jeito de funcionar",
  "Um espaço seguro para desabafar",
  "Lembretes e acompanhamento gentil",
  "Apenas entender melhor como eu funciono",
];

function toggleValue(current: string[], value: string): string[] {
  return current.includes(value) ? current.filter((item) => item !== value) : [...current, value];
}

function Chip({
  label,
  active,
  onClick,
  testId,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  testId?: string;
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      className={`chip ${active ? "chip-active" : ""}`}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

export function OnboardingScreen({
  loading = false,
  uploadingDocument = false,
  defaultName,
  onUploadDocument,
  onAutoSave,
  onSave,
}: OnboardingScreenProps) {
  const [currentBlock, setCurrentBlock] = useState(0);
  const [error, setError] = useState("");

  // Block A
  const [name, setName] = useState(defaultName);
  const [identifications, setIdentifications] = useState<string[]>([]);
  const [identificationOther, setIdentificationOther] = useState("");
  const [diagnosisTime, setDiagnosisTime] = useState<string | null>(null);
  const [inTreatment, setInTreatment] = useState<"sim" | "nao" | "prefiro nao responder" | null>(null);

  // Block B
  const [dailyDifficulties, setDailyDifficulties] = useState<string[]>([]);

  // Block C
  const [instructionPreference, setInstructionPreference] = useState<string | null>(null);
  const [deadlineReaction, setDeadlineReaction] = useState<string | null>(null);
  const [reminderStyle, setReminderStyle] = useState<string | null>(null);

  // Block D
  const [blockers, setBlockers] = useState<string[]>([]);
  const [unblockers, setUnblockers] = useState<string[]>([]);
  const [unblockerOther, setUnblockerOther] = useState("");

  // Block E
  const [energyPeriod, setEnergyPeriod] = useState<string | null>(null);
  const [medusaGoals, setMedusaGoals] = useState<string[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadConsent, setUploadConsent] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");

  const progressPercent = (currentBlock / TOTAL_BLOCKS) * 100;

  const canGoNextBlockA = name.trim().length > 0;

  const buildOnboarding = (): ProfileOnboarding => ({
    name: name.trim() || defaultName,
    identifications,
    identification_other: identifications.includes("Outro") ? identificationOther.trim() || null : null,
    diagnosis_time: diagnosisTime,
    in_treatment: inTreatment,
    daily_difficulties: dailyDifficulties,
    instruction_preference: instructionPreference,
    deadline_reaction: deadlineReaction,
    reminder_style: reminderStyle,
    blockers,
    unblockers,
    unblocker_other: unblockers.includes("Outro") ? unblockerOther.trim() || null : null,
    energy_period: energyPeriod,
    medusa_goals: medusaGoals,
  });

  const autoSave = async (partial: Partial<ProfileOnboarding>) => {
    if (onAutoSave) {
      try {
        await onAutoSave(partial);
      } catch {
        // fire-and-forget, don't block UX
      }
    }
  };

  const handleNext = async () => {
    if (currentBlock === 0 && !canGoNextBlockA) {
      setError("Por favor, diga como quer ser chamado(a).");
      return;
    }
    setError("");

    if (currentBlock === 0) {
      await autoSave({ name: name.trim(), identifications, diagnosis_time: diagnosisTime, in_treatment: inTreatment });
    } else if (currentBlock === 1) {
      await autoSave({ daily_difficulties: dailyDifficulties });
    } else if (currentBlock === 2) {
      await autoSave({ instruction_preference: instructionPreference, deadline_reaction: deadlineReaction, reminder_style: reminderStyle });
    } else if (currentBlock === 3) {
      await autoSave({ blockers, unblockers, unblocker_other: unblockerOther.trim() || null });
    }

    setCurrentBlock((prev) => Math.min(prev + 1, TOTAL_BLOCKS - 1));
  };

  const handleBack = () => {
    setError("");
    setCurrentBlock((prev) => Math.max(prev - 1, 0));
  };

  const handleSkip = async () => {
    setError("");
    setCurrentBlock((prev) => Math.min(prev + 1, TOTAL_BLOCKS - 1));
  };

  const handleFinish = async () => {
    setError("");
    const onboarding = buildOnboarding();
    await onSave({ displayName: name.trim() || defaultName, onboarding });
  };

  const handleUploadFiles = async () => {
    if (selectedFiles.length === 0 || !uploadConsent) return;
    setUploadStatus("");
    try {
      await onUploadDocument(selectedFiles);
      setSelectedFiles([]);
      setUploadStatus("Documento(s) enviado(s) com sucesso!");
    } catch (uploadError) {
      const msg = uploadError instanceof Error ? uploadError.message : "Não foi possível enviar os arquivos agora.";
      setUploadStatus(msg);
    }
  };

  const renderBlock = () => {
    // Block A — Identidade
    if (currentBlock === 0) {
      return (
        <div data-testid="onboarding-block-a">
          <h2>Oi! Vamos começar do jeito certo pra você 💜</h2>
          <p className="muted">Algumas perguntas rápidas para a Medusa te conhecer melhor.</p>

          <label className="field">
            <span>Como quer ser chamado(a)?</span>
            <input
              data-testid="onboarding-name-input"
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Seu nome aqui"
            />
          </label>

          <fieldset className="field">
            <legend>Como você se identifica? (pode marcar mais de um)</legend>
            <div className="chips-wrap">
              {IDENTIFICATION_OPTIONS.map((option) => (
                <Chip
                  key={option}
                  label={option}
                  active={identifications.includes(option)}
                  onClick={() => setIdentifications((prev) => toggleValue(prev, option))}
                />
              ))}
            </div>
            {identifications.includes("Outro") && (
              <label className="field">
                <span>Qual identificação?</span>
                <input
                  className="input"
                  value={identificationOther}
                  onChange={(e) => setIdentificationOther(e.target.value)}
                  placeholder="Descreva brevemente"
                />
              </label>
            )}
          </fieldset>

          <fieldset className="field">
            <legend>Há quanto tempo você sabe ou suspeita?</legend>
            <div className="chips-wrap">
              {DIAGNOSIS_TIME_OPTIONS.map((option) => (
                <Chip
                  key={option}
                  label={option}
                  active={diagnosisTime === option}
                  onClick={() => setDiagnosisTime(option === diagnosisTime ? null : option)}
                />
              ))}
            </div>
          </fieldset>

          <fieldset className="field">
            <legend>Você está em acompanhamento profissional?</legend>
            <div className="chips-wrap">
              {IN_TREATMENT_OPTIONS.map((option) => (
                <Chip
                  key={option.value}
                  label={option.label}
                  active={inTreatment === option.value}
                  onClick={() => setInTreatment(inTreatment === option.value ? null : option.value)}
                />
              ))}
            </div>
          </fieldset>
        </div>
      );
    }

    // Block B — Funcionamento executivo
    if (currentBlock === 1) {
      return (
        <div data-testid="onboarding-block-b">
          <h2>Funcionamento executivo</h2>
          <p className="muted">Quais são suas maiores dificuldades no dia a dia? (pode marcar mais de um)</p>
          <div className="chips-wrap">
            {DAILY_DIFFICULTIES_OPTIONS.map((option) => (
              <Chip
                key={option}
                label={option}
                active={dailyDifficulties.includes(option)}
                onClick={() => setDailyDifficulties((prev) => toggleValue(prev, option))}
              />
            ))}
          </div>
        </div>
      );
    }

    // Block C — Estilo de processamento
    if (currentBlock === 2) {
      return (
        <div data-testid="onboarding-block-c">
          <h2>Estilo de processamento</h2>

          <fieldset className="field">
            <legend>Quando você recebe muitas instruções, prefere:</legend>
            <div className="chips-wrap">
              {INSTRUCTION_PREFERENCE_OPTIONS.map((option) => (
                <Chip
                  key={option}
                  label={option}
                  active={instructionPreference === option}
                  onClick={() => setInstructionPreference(instructionPreference === option ? null : option)}
                />
              ))}
            </div>
          </fieldset>

          <fieldset className="field">
            <legend>Como você reage a prazos?</legend>
            <div className="chips-wrap">
              {DEADLINE_REACTION_OPTIONS.map((option) => (
                <Chip
                  key={option}
                  label={option}
                  active={deadlineReaction === option}
                  onClick={() => setDeadlineReaction(deadlineReaction === option ? null : option)}
                />
              ))}
            </div>
          </fieldset>

          <fieldset className="field">
            <legend>Como prefere ser lembrado(a)?</legend>
            <div className="chips-wrap">
              {REMINDER_STYLE_OPTIONS.map((option) => (
                <Chip
                  key={option}
                  label={option}
                  active={reminderStyle === option}
                  onClick={() => setReminderStyle(reminderStyle === option ? null : option)}
                />
              ))}
            </div>
          </fieldset>
        </div>
      );
    }

    // Block D — Gatilhos e desbloqueadores
    if (currentBlock === 3) {
      return (
        <div data-testid="onboarding-block-d">
          <h2>Gatilhos e desbloqueadores</h2>

          <fieldset className="field">
            <legend>O que costuma te travar? (pode marcar mais de um)</legend>
            <div className="chips-wrap">
              {BLOCKERS_OPTIONS.map((option) => (
                <Chip
                  key={option}
                  label={option}
                  active={blockers.includes(option)}
                  onClick={() => setBlockers((prev) => toggleValue(prev, option))}
                />
              ))}
            </div>
          </fieldset>

          <fieldset className="field">
            <legend>O que costuma te ajudar a destravar? (pode marcar mais de um)</legend>
            <div className="chips-wrap">
              {UNBLOCKERS_OPTIONS.map((option) => (
                <Chip
                  key={option}
                  label={option}
                  active={unblockers.includes(option)}
                  onClick={() => setUnblockers((prev) => toggleValue(prev, option))}
                />
              ))}
            </div>
            {unblockers.includes("Outro") && (
              <label className="field">
                <span>O que mais te ajuda?</span>
                <input
                  className="input"
                  value={unblockerOther}
                  onChange={(e) => setUnblockerOther(e.target.value)}
                  placeholder="Descreva brevemente"
                />
              </label>
            )}
          </fieldset>
        </div>
      );
    }

    // Block E — Rotina, objetivos e documentos
    return (
      <div data-testid="onboarding-block-e">
        <h2>Rotina, objetivos e documentos</h2>

        <fieldset className="field">
          <legend>Em que período do dia você tem mais energia?</legend>
          <div className="chips-wrap">
            {ENERGY_PERIOD_OPTIONS.map((option) => (
              <Chip
                key={option}
                label={option}
                active={energyPeriod === option}
                onClick={() => setEnergyPeriod(energyPeriod === option ? null : option)}
              />
            ))}
          </div>
        </fieldset>

        <fieldset className="field">
          <legend>O que você espera da Medusa? (pode marcar mais de um)</legend>
          <div className="chips-wrap">
            {MEDUSA_GOALS_OPTIONS.map((option) => (
              <Chip
                key={option}
                label={option}
                active={medusaGoals.includes(option)}
                onClick={() => setMedusaGoals((prev) => toggleValue(prev, option))}
              />
            ))}
          </div>
        </fieldset>

        <div className="onboarding-upload-box">
          <p className="muted">
            Se quiser, envie um laudo ou documento clínico (PDF, JPG ou PNG). Isso é completamente opcional — serve
            apenas para a Medusa te conhecer melhor.
          </p>
          <input
            data-testid="onboarding-file-input"
            className="input"
            type="file"
            multiple
            accept=".pdf,.jpg,.jpeg,.png"
            onChange={(e) => setSelectedFiles(e.target.files ? Array.from(e.target.files) : [])}
          />
          {selectedFiles.length > 0 && (
            <ul className="file-list">
              {selectedFiles.map((file) => (
                <li key={file.name}>{file.name}</li>
              ))}
            </ul>
          )}
          <label className="check-row">
            <input
              type="checkbox"
              checked={uploadConsent}
              onChange={(e) => setUploadConsent(e.target.checked)}
              data-testid="onboarding-upload-consent-checkbox"
            />
            <span>Autorizo a Medusa a analisar este(s) documento(s) para personalizar minha experiência.</span>
          </label>
          <button
            data-testid="onboarding-upload-files-button"
            type="button"
            className="ghost-btn"
            onClick={handleUploadFiles}
            disabled={uploadingDocument || selectedFiles.length === 0 || !uploadConsent}
          >
            {uploadingDocument ? "Enviando..." : "Enviar documento(s)"}
          </button>
          {uploadStatus && (
            <p className="status-ok" data-testid="onboarding-upload-status">
              {uploadStatus}
            </p>
          )}
        </div>
      </div>
    );
  };

  const isLastBlock = currentBlock === TOTAL_BLOCKS - 1;
  const isFirstBlock = currentBlock === 0;
  const canSkip = currentBlock > 0;

  return (
    <div className="screen onboarding-screen" data-testid="onboarding-screen">
      <div className="screen-header">
        <p className="eyebrow">Onboarding</p>
        <p className="muted">
          {currentBlock + 1} de {TOTAL_BLOCKS}
        </p>
      </div>

      <div className="onboarding-progress-bar" data-testid="onboarding-progress-bar">
        <div
          className="onboarding-progress-fill"
          style={{ width: `${progressPercent}%` }}
          data-testid="onboarding-progress-fill"
        />
      </div>

      <div className="stack onboarding-wizard" data-testid="onboarding-wizard">
        {renderBlock()}

        {error && (
          <p className="status-error" data-testid="onboarding-error-message">
            {error}
          </p>
        )}

        <div className="wizard-actions">
          <button
            data-testid="onboarding-back-button"
            className="ghost-btn"
            onClick={handleBack}
            disabled={isFirstBlock || loading}
          >
            Voltar
          </button>

          {canSkip && !isLastBlock && (
            <button
              data-testid="onboarding-skip-button"
              className="ghost-btn"
              onClick={handleSkip}
              disabled={loading}
            >
              Pular
            </button>
          )}

          {isLastBlock ? (
            <button
              data-testid="onboarding-submit-button"
              className="primary-btn"
              onClick={handleFinish}
              disabled={loading}
            >
              {loading ? "Salvando..." : "Começar"}
            </button>
          ) : (
            <button
              data-testid="onboarding-next-button"
              className="primary-btn"
              onClick={handleNext}
              disabled={loading || (currentBlock === 0 && !canGoNextBlockA)}
            >
              Próximo
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
