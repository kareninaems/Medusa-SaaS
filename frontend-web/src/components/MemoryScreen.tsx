import { useEffect, useState } from "react";
import type { FormEvent } from "react";

import type { MemoryRow } from "../types/medusa";

interface MemoryScreenProps {
  memory: MemoryRow | null;
  saving?: boolean;
  onSave: (payload: {
    patterns: string[];
    triggers: string[];
    worked: string[];
    didnt_work: string[];
    context: string[];
  }) => Promise<void>;
}

const PATTERNS_OPTIONS = [
  "Adio tarefa grande",
  "Travo para começar",
  "Perco foco com interrupção",
  "Funciona melhor em bloco curto",
  "Rendo melhor de manhã",
  "Rendo melhor à noite",
  "Outro",
];
const TRIGGERS_OPTIONS = [
  "Notificações",
  "Barulho",
  "Muitas tarefas abertas",
  "Cobrança urgente",
  "Reuniões longas",
  "Mudança de plano",
  "Outro",
];
const WORKED_OPTIONS = [
  "Microtarefas",
  "Timer 10 minutos",
  "Pausa curta",
  "Lista curta",
  "Silenciar notificações",
  "Trocar ambiente",
  "Outro",
];
const DIDNT_WORK_OPTIONS = [
  "Lista longa",
  "Multitarefa",
  "Pressão com culpa",
  "Sem pausa",
  "Começar pela tarefa maior",
  "Tela social aberta",
  "Outro",
];
const CONTEXT_OPTIONS = ["Trabalho", "Estudos", "Casa", "Saúde", "Relacionamentos", "Finanças", "Outro"];

function toggleOption(current: string[], value: string) {
  return current.includes(value) ? current.filter((item) => item !== value) : [...current, value];
}

function fromSaved(saved: string[] | undefined, options: string[]) {
  const safe = saved ?? [];
  const known = safe.filter((item) => options.includes(item) && item !== "Outro");
  const custom = safe.filter((item) => !options.includes(item));
  if (custom.length > 0) {
    return { selected: [...known, "Outro"], other: custom.join("; ") };
  }
  return { selected: known, other: "" };
}

function toSaved(selected: string[], other: string) {
  const base = selected.filter((item) => item !== "Outro");
  const custom = other
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean);
  return [...base, ...custom];
}

export function MemoryScreen({ memory, saving = false, onSave }: MemoryScreenProps) {
  const [patterns, setPatterns] = useState<string[]>([]);
  const [patternsOther, setPatternsOther] = useState("");
  const [triggers, setTriggers] = useState<string[]>([]);
  const [triggersOther, setTriggersOther] = useState("");
  const [worked, setWorked] = useState<string[]>([]);
  const [workedOther, setWorkedOther] = useState("");
  const [didntWork, setDidntWork] = useState<string[]>([]);
  const [didntWorkOther, setDidntWorkOther] = useState("");
  const [context, setContext] = useState<string[]>([]);
  const [contextOther, setContextOther] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    const p = fromSaved(memory?.patterns, PATTERNS_OPTIONS);
    const t = fromSaved(memory?.triggers, TRIGGERS_OPTIONS);
    const w = fromSaved(memory?.worked, WORKED_OPTIONS);
    const d = fromSaved(memory?.didnt_work, DIDNT_WORK_OPTIONS);
    const c = fromSaved(Array.isArray(memory?.context) ? memory?.context : [], CONTEXT_OPTIONS);

    setPatterns(p.selected);
    setPatternsOther(p.other);
    setTriggers(t.selected);
    setTriggersOther(t.other);
    setWorked(w.selected);
    setWorkedOther(w.other);
    setDidntWork(d.selected);
    setDidntWorkOther(d.other);
    setContext(c.selected);
    setContextOther(c.other);
  }, [memory]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setStatus("");
    await onSave({
      patterns: toSaved(patterns, patternsOther),
      triggers: toSaved(triggers, triggersOther),
      worked: toSaved(worked, workedOther),
      didnt_work: toSaved(didntWork, didntWorkOther),
      context: toSaved(context, contextOther),
    });
    setStatus("Memória salva.");
  };

  return (
    <section className="panel" data-testid="memory-screen">
      <h2>Memória</h2>
      <p className="muted" data-testid="memory-screen-description">Selecione opções rápidas. Use “Outro” só quando precisar.</p>

      <form className="stack" onSubmit={handleSubmit} data-testid="memory-form">
        <label className="field">
          <span>Padrões</span>
          <div className="chips-wrap" data-testid="memory-patterns-options">
            {PATTERNS_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                className={`chip ${patterns.includes(option) ? "chip-active" : ""}`}
                data-testid={`memory-patterns-option-${option.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
                onClick={() => setPatterns((current) => toggleOption(current, option))}
              >
                {option}
              </button>
            ))}
          </div>
          {patterns.includes("Outro") ? (
            <input
              className="input"
              data-testid="memory-patterns-other-input"
              value={patternsOther}
              onChange={(event) => setPatternsOther(event.target.value)}
              placeholder="Outro (separe por ; )"
            />
          ) : null}
        </label>

        <label className="field">
          <span>Gatilhos</span>
          <div className="chips-wrap" data-testid="memory-triggers-options">
            {TRIGGERS_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                className={`chip ${triggers.includes(option) ? "chip-active" : ""}`}
                data-testid={`memory-triggers-option-${option.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
                onClick={() => setTriggers((current) => toggleOption(current, option))}
              >
                {option}
              </button>
            ))}
          </div>
          {triggers.includes("Outro") ? (
            <input
              className="input"
              data-testid="memory-triggers-other-input"
              value={triggersOther}
              onChange={(event) => setTriggersOther(event.target.value)}
              placeholder="Outro (separe por ; )"
            />
          ) : null}
        </label>

        <label className="field">
          <span>O que ajudou</span>
          <div className="chips-wrap" data-testid="memory-worked-options">
            {WORKED_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                className={`chip ${worked.includes(option) ? "chip-active" : ""}`}
                data-testid={`memory-worked-option-${option.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
                onClick={() => setWorked((current) => toggleOption(current, option))}
              >
                {option}
              </button>
            ))}
          </div>
          {worked.includes("Outro") ? (
            <input
              className="input"
              data-testid="memory-worked-other-input"
              value={workedOther}
              onChange={(event) => setWorkedOther(event.target.value)}
              placeholder="Outro (separe por ; )"
            />
          ) : null}
        </label>

        <label className="field">
          <span>O que não ajudou</span>
          <div className="chips-wrap" data-testid="memory-didnt-work-options">
            {DIDNT_WORK_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                className={`chip ${didntWork.includes(option) ? "chip-active" : ""}`}
                data-testid={`memory-didnt-work-option-${option.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
                onClick={() => setDidntWork((current) => toggleOption(current, option))}
              >
                {option}
              </button>
            ))}
          </div>
          {didntWork.includes("Outro") ? (
            <input
              className="input"
              data-testid="memory-didnt-work-other-input"
              value={didntWorkOther}
              onChange={(event) => setDidntWorkOther(event.target.value)}
              placeholder="Outro (separe por ; )"
            />
          ) : null}
        </label>

        <label className="field">
          <span>Contexto</span>
          <div className="chips-wrap" data-testid="memory-context-options">
            {CONTEXT_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                className={`chip ${context.includes(option) ? "chip-active" : ""}`}
                data-testid={`memory-context-option-${option.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
                onClick={() => setContext((current) => toggleOption(current, option))}
              >
                {option}
              </button>
            ))}
          </div>
          {context.includes("Outro") ? (
            <input
              className="input"
              data-testid="memory-context-other-input"
              value={contextOther}
              onChange={(event) => setContextOther(event.target.value)}
              placeholder="Outro (separe por ; )"
            />
          ) : null}
        </label>

        <button className="primary-btn" type="submit" disabled={saving} data-testid="memory-save-button">
          {saving ? "Salvando" : "Salvar memória"}
        </button>
        {status ? <p className="status-ok" data-testid="memory-save-success">{status}</p> : null}
      </form>
    </section>
  );
}
