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

  useEffect(() => {
    setPatterns(memory?.patterns?.join("\n") ?? "");
    setTriggers(memory?.triggers?.join("\n") ?? "");
    setWorked(memory?.worked?.join("\n") ?? "");
    setDidntWork(memory?.didnt_work?.join("\n") ?? "");
    setContext(memory?.context?.join("\n") ?? "");
  }, [memory]);

  const toArray = (value: string) =>
    value
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    await onSave({
      patterns: toArray(patterns),
      triggers: toArray(triggers),
      worked: toArray(worked),
      didnt_work: toArray(didntWork),
      context: toArray(context),
    });
  };

  return (
    <section className="panel">
      <h3>Memória operacional</h3>
      <p className="muted">Estrutura inicial para padrões, gatilhos e evidência iterativa.</p>

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
          {saving ? "Salvando memória..." : "Salvar memória"}
        </button>
      </form>
    </section>
  );
}
