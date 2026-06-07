import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import type { ReactNode } from "react";

import type { EnergyLevel, Message } from "../types/medusa";

interface ChatScreenProps {
  messages: Message[];
  sending?: boolean;
  energy: EnergyLevel;
  onSend: (message: string) => Promise<void>;
  onBack: () => void | Promise<void>;
}

export function ChatScreen({ messages, sending = false, energy, onSend, onBack }: ChatScreenProps) {
  const [input, setInput] = useState("");

  const canSend = useMemo(() => !!input.trim() && !sending, [input, sending]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!canSend) return;
    const message = input.trim();
    setInput("");
    await onSend(message);
  };

  const renderBoldLine = (line: string) => {
    const nodes: ReactNode[] = [];
    const regex = /\*\*(.*?)\*\*/g;
    let cursor = 0;
    let match = regex.exec(line);

    while (match) {
      if (match.index > cursor) {
        nodes.push(line.slice(cursor, match.index).replace(/\*\*/g, ""));
      }
      nodes.push(
        <strong key={`bold-${match.index}-${cursor}`}>
          {match[1]}
        </strong>,
      );
      cursor = match.index + match[0].length;
      match = regex.exec(line);
    }

    if (cursor < line.length) {
      nodes.push(line.slice(cursor).replace(/\*\*/g, ""));
    }

    return nodes.length > 0 ? nodes : [line.replace(/\*\*/g, "")];
  };

  const renderContent = (content: string) => {
    const lines = content.split("\n");

    return lines.map((line, index) => {
      const isList = /^\d+[\).]\s+/.test(line.trim());
      return (
        <p key={`line-${index}`} className={isList ? "msg-line msg-line-list" : "msg-line"}>
          {renderBoldLine(line)}
        </p>
      );
    });
  };

  return (
    <section className="chat-layout" aria-live="polite">
      <header className="chat-header">
        <button
          type="button"
          className="ghost-btn chat-back-btn"
          onClick={onBack}
          aria-label="Voltar ao menu"
        >
          ← Voltar
        </button>
        <h2>Medusa</h2>
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
            <div className="msg-content">{renderContent(message.content)}</div>
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
          <button type="submit" className="primary-btn" disabled={!canSend}>
            {sending ? "Enviando..." : "Enviar"}
          </button>
        </div>
      </form>
    </section>
  );
}
