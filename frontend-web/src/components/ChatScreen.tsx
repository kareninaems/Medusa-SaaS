import { useMemo, useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import type { ReactNode } from "react";

import {
  ATTACHMENT_ACCEPT,
  composeMessageWithAttachment,
  conversationToText,
  copyText,
  isAcceptedAttachment,
} from "../services/attachments";
import type { EnergyLevel, Message } from "../types/medusa";
import { FeelingsDictionary } from "./FeelingsDictionary";

interface ChatScreenProps {
  messages: Message[];
  sending?: boolean;
  disabled?: boolean;
  interacoesRestantes?: number | null;
  energy: EnergyLevel;
  onSend: (message: string) => Promise<void>;
  onBack: () => void | Promise<void>;
  onReadAttachment?: (file: File) => Promise<string>;
}

export function ChatScreen({
  messages,
  sending = false,
  disabled = false,
  interacoesRestantes,
  energy,
  onSend,
  onBack,
  onReadAttachment,
}: ChatScreenProps) {
  const [input, setInput] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [readingAttachment, setReadingAttachment] = useState(false);
  const [attachmentError, setAttachmentError] = useState("");
  const [copyStatus, setCopyStatus] = useState("");
  const [showFeelings, setShowFeelings] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);

  const handleUseFeeling = (feelingName: string) => {
    const sentence = `Estou sentindo ${feelingName.toLowerCase()}.`;
    setInput((current) => (current.trim() ? `${current.trim()} ${sentence}` : sentence));
    setShowFeelings(false);
    composerRef.current?.focus();
  };

  const busy = sending || readingAttachment;
  const canSend = useMemo(
    () => (!!input.trim() || !!attachment) && !busy && !disabled,
    [input, attachment, busy, disabled],
  );

  const handlePickFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    event.target.value = "";
    if (!file) return;
    if (!isAcceptedAttachment(file)) {
      setAttachmentError("Formato não aceito. Envie foto (JPG, PNG) ou PDF.");
      return;
    }
    setAttachmentError("");
    setAttachment(file);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!canSend) return;
    let message = input.trim();

    if (attachment && onReadAttachment) {
      setReadingAttachment(true);
      setAttachmentError("");
      try {
        const description = await onReadAttachment(attachment);
        message = composeMessageWithAttachment(message, attachment.name, description);
      } catch (readError) {
        setAttachmentError(readError instanceof Error ? readError.message : "Não foi possível ler o anexo.");
        setReadingAttachment(false);
        return;
      }
      setReadingAttachment(false);
    }

    setInput("");
    setAttachment(null);
    await onSend(message);
  };

  const handleCopyConversation = async () => {
    try {
      await copyText(conversationToText(messages));
      setCopyStatus("Conversa copiada.");
    } catch {
      setCopyStatus("Não foi possível copiar.");
    }
    window.setTimeout(() => setCopyStatus(""), 2500);
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
    <section className={`chat-layout ${showFeelings ? "feelings-active" : ""}`}>
      <div className="chat-main" aria-live="polite">
      <header className="chat-header">
        <button
          type="button"
          className="ghost-btn chat-back-btn"
          onClick={onBack}
          aria-label="Voltar ao menu principal"
        >
          ← Menu principal
        </button>
        <h2>Medusa</h2>
        <p className="muted">Energia {energy}. Resposta objetiva em até 3 passos.</p>
      </header>

      <div className="chat-tools">
        <button
          type="button"
          className="ghost-btn chat-tool-btn"
          data-testid="chat-copy-button"
          onClick={handleCopyConversation}
          disabled={messages.length === 0}
        >
          Copiar conversa
        </button>
        <button
          type="button"
          className="ghost-btn chat-tool-btn feelings-toggle"
          data-testid="feelings-toggle"
          aria-expanded={showFeelings}
          onClick={() => setShowFeelings((value) => !value)}
        >
          {showFeelings ? "Fechar dicionário" : "Dicionário de sentimentos"}
        </button>
        <span className="muted chat-tool-status" role="status">{copyStatus}</span>
      </div>

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

      {interacoesRestantes !== null && interacoesRestantes !== undefined && interacoesRestantes <= 10 && !disabled ? (
        <div className="interactions-banner" data-testid="chat-interactions-banner">
          Você tem {interacoesRestantes} interaç{interacoesRestantes === 1 ? "ão" : "ões"} restante{interacoesRestantes === 1 ? "" : "s"} hoje.
        </div>
      ) : null}

      <form className="composer" onSubmit={handleSubmit} aria-label="Enviar mensagem">
        <textarea
          ref={composerRef}
          className="input textarea composer-input"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder={disabled ? "Limite diário atingido. Até amanhã!" : "Descreva o que está pegando agora."}
          disabled={disabled}
        />
        {attachment ? (
          <div className="attachment-chip" data-testid="chat-attachment-chip">
            <span className="attachment-name">Anexo: {attachment.name}</span>
            <button
              type="button"
              className="link-btn"
              onClick={() => setAttachment(null)}
              disabled={busy}
              aria-label={`Remover anexo ${attachment.name}`}
            >
              Remover
            </button>
          </div>
        ) : null}
        {attachmentError ? <p className="status-error" data-testid="chat-attachment-error">{attachmentError}</p> : null}
        {onReadAttachment ? (
          <p className="muted attachment-note">
            Foto ou PDF: a Medusa lê o conteúdo uma vez e o arquivo não fica guardado.
          </p>
        ) : null}
        <div className="composer-actions">
          {onReadAttachment ? (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept={ATTACHMENT_ACCEPT}
                onChange={handlePickFile}
                hidden
                data-testid="chat-attachment-input"
              />
              <button
                type="button"
                className="ghost-btn"
                data-testid="chat-attachment-button"
                onClick={() => fileInputRef.current?.click()}
                disabled={busy || disabled}
              >
                Anexar foto ou arquivo
              </button>
            </>
          ) : null}
          <button type="submit" className="primary-btn" disabled={!canSend}>
            {readingAttachment ? "Lendo anexo..." : sending ? "Enviando..." : "Enviar"}
          </button>
        </div>
      </form>
      </div>
      <FeelingsDictionary open={showFeelings} onUse={handleUseFeeling} onClose={() => setShowFeelings(false)} />
    </section>
  );
}
