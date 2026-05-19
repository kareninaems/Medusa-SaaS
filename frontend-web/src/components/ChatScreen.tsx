import { useMemo, useState } from "react";
import type { FormEvent } from "react";

import type { EnergyLevel, MedusaMode, Message } from "../types/medusa";

interface ChatScreenProps {
  messages: Message[];
  sending?: boolean;
  energy: EnergyLevel;
  onSend: (message: string, mode: MedusaMode) => Promise<void>;
}

const MODES: MedusaMode[] = ["ACAO", "FOCO", "PROCESSO", "TRAVA"];

export function ChatScreen({ messages, sending = false, energy, onSend }: ChatScreenProps) {
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<MedusaMode>("ACAO");

  const canSend = useMemo(() => !!input.trim() && !sending, [input, sending]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!canSend) return;
    const message = input.trim();
    setInput("");
    await onSend(message, mode);
  };

  return (
    <section className="panel chat-panel">
      <header className="panel-head">
        <div>
          <h3>Chat Medusa</h3>
          <p className="muted">Energia atual: {energy} • resposta objetiva em até 3 passos.</p>
        </div>
      </header>

      <div className="mode-row">
        {MODES.map((item) => (
          <button
            key={item}
            className={`chip ${mode === item ? "chip-active" : ""}`}
            onClick={() => setMode(item)}
          >
            {item}
          </button>
        ))}
      </div>

      <div className="messages-scroll">
        {messages.length === 0 ? (
          <p className="muted">Sem histórico ainda. Faça uma pergunta objetiva.</p>
        ) : null}

        {messages.map((message) => (
          <article
            key={message.id}
            className={`msg ${message.role === "user" ? "msg-user" : "msg-assistant"}`}
          >
            <p className="msg-role">{message.role === "user" ? "Você" : "Medusa"}</p>
            <p className="msg-content">{message.content}</p>
          </article>
        ))}
      </div>

      <form className="composer" onSubmit={handleSubmit}>
        <textarea
          className="input textarea composer-input"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Descreva o que está pegando agora."
        />
        <div className="composer-actions">
          <button type="button" className="ghost-btn" title="Voz em breve" disabled>
            Voz (em breve)
          </button>
          <button type="submit" className="primary-btn" disabled={!canSend}>
            {sending ? "Processando..." : "Enviar"}
          </button>
        </div>
      </form>
    </section>
  );
}
