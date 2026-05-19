import { useMemo, useState } from "react";
import type { FormEvent } from "react";

import type { EnergyLevel, Message } from "../types/medusa";

interface ChatScreenProps {
  messages: Message[];
  sending?: boolean;
  energy: EnergyLevel;
  onSend: (message: string) => Promise<void>;
}

export function ChatScreen({ messages, sending = false, energy, onSend }: ChatScreenProps) {
  const [input, setInput] = useState("");

  const canSend = useMemo(() => !!input.trim() && !sending, [input, sending]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!canSend) return;
    const message = input.trim();
    setInput("");
    await onSend(message);
  };

  return (
    <section className="chat-layout" aria-live="polite">
      <header className="chat-header">
        <h2>Chat da Medusa</h2>
        <p className="muted">Energia {energy}. Resposta objetiva em até 3 passos.</p>
      </header>

      <div className="messages-scroll" role="log" aria-label="Histórico do chat">
        {messages.length === 0 ? (
          <p className="muted">Sem histórico ainda. Próximo passo: escreva uma pergunta objetiva.</p>
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

      <form className="composer" onSubmit={handleSubmit} aria-label="Enviar mensagem">
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
            {sending ? "Enviando..." : "Enviar"}
          </button>
        </div>
      </form>
    </section>
  );
}
