import { useMemo, useState } from "react";

import { FEELING_GROUPS } from "../constants/feelings";
import type { Feeling } from "../constants/feelings";

interface FeelingsDictionaryProps {
  open: boolean;
  onUse: (feelingName: string) => void;
  onClose: () => void;
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

export function FeelingsDictionary({ open, onUse, onClose }: FeelingsDictionaryProps) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  const term = normalize(query.trim());
  const matches = useMemo(() => {
    if (!term) return null;
    const found: Feeling[] = [];
    for (const group of FEELING_GROUPS) {
      for (const feeling of group.feelings) {
        const haystack = normalize(`${feeling.name} ${feeling.meaning} ${feeling.body}`);
        if (haystack.includes(term)) found.push(feeling);
      }
    }
    return found;
  }, [term]);

  const renderFeeling = (feeling: Feeling) => {
    const isSelected = selected === feeling.name;
    return (
      <li key={feeling.name} className="feeling-item">
        <button
          type="button"
          className={`feeling-name ${isSelected ? "feeling-name-active" : ""}`}
          aria-expanded={isSelected}
          onClick={() => setSelected(isSelected ? null : feeling.name)}
        >
          {feeling.name}
        </button>
        {isSelected ? (
          <div className="feeling-detail">
            <p>{feeling.meaning}</p>
            <p className="muted">No corpo: {feeling.body}</p>
            <button type="button" className="ghost-btn feeling-use-btn" onClick={() => onUse(feeling.name)}>
              Usar no chat
            </button>
          </div>
        ) : null}
      </li>
    );
  };

  return (
    <aside
      className={`feelings-panel ${open ? "feelings-open" : ""}`}
      aria-label="Dicionário de sentimentos"
      data-testid="feelings-dictionary"
    >
      <div className="feelings-head">
        <h3 className="feelings-title">Dicionário de sentimentos</h3>
        <button type="button" className="link-btn feelings-close" onClick={onClose}>
          Fechar
        </button>
      </div>
      <p className="muted feelings-intro">
        Não sabe o nome do que sente? Procure pelo que acontece no corpo.
      </p>
      <label className="field">
        <span className="muted feelings-intro">Buscar</span>
        <input
          className="input"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="ex.: aperto, cansaço, calor"
          data-testid="feelings-search"
        />
      </label>

      {matches ? (
        matches.length > 0 ? (
          <ul className="feeling-list">{matches.map(renderFeeling)}</ul>
        ) : (
          <p className="muted">Nada encontrado. Tente outra palavra.</p>
        )
      ) : (
        FEELING_GROUPS.map((group) => (
          <details key={group.id} className="feeling-group">
            <summary>{group.title}</summary>
            <ul className="feeling-list">{group.feelings.map(renderFeeling)}</ul>
          </details>
        ))
      )}

      <p className="muted feelings-intro">Apoio para dar nome ao que se sente. Não é diagnóstico.</p>
    </aside>
  );
}
