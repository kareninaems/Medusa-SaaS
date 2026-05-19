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

export function MemoryScreen({ memory, saving = false, onSave }: MemoryScreenProps) {
  const [patterns, setPatterns] = useState("");
  const [triggers, setTriggers] = useState("");
  const [worked, setWorked] = useState("");
  const [didntWork, setDidntWork] = useState("");
  const [context, setContext] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    const contextLines = Array.isArray(memory?.context) ? memory?.context : [];
    setPatterns(memory?.patterns?.join("\n") ?? "");
    setTriggers(memory?.triggers?.join("\n") ?? "");
    setWorked(memory?.worked?.join("\n") ?? "");
    setDidntWork(memory?.didnt_work?.join("\n") ?? "");
    setContext(contextLines.join("\n"));
  }, [memory]);

  const toArray = (value: string) =>
    value
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setStatus("");
    await onSave({
      patterns: toArray(patterns),
      triggers: toArray(triggers),
      worked: toArray(worked),
      didnt_work: toArray(didntWork),
      context: toArray(context),
    });
    setStatus("Memória salva.");
  };

  return (
    <section className="panel">
      <h2>Memória</h2>
      <p className="muted">Preencha apenas o necessário. Uma linha por item.</p>

      <form className="stack" onSubmit={handleSubmit}>
        <label className="field">
          <span>patterns</span>
          <textarea className="input textarea" value={patterns} onChange={(e) => setPatterns(e.target.value)} />
        </label>
        <label className="field">
          <span>triggers</span>
          <textarea className="input textarea" value={triggers} onChange={(e) => setTriggers(e.target.value)} />
        </label>
        <label className="field">
          <span>worked</span>
          <textarea className="input textarea" value={worked} onChange={(e) => setWorked(e.target.value)} />
        </label>
        <label className="field">
          <span>didnt_work</span>
          <textarea className="input textarea" value={didntWork} onChange={(e) => setDidntWork(e.target.value)} />
        </label>
        <label className="field">
          <span>context</span>
          <textarea className="input textarea" value={context} onChange={(e) => setContext(e.target.value)} />
        </label>

        <button className="primary-btn" type="submit" disabled={saving}>
          {saving ? "Salvando" : "Salvar memória"}
        </button>
        {status ? <p className="status-ok">{status}</p> : null}
      </form>
    </section>
  );
}
