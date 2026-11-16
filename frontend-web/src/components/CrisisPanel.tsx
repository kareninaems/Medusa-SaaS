import type { CrisisLevel } from "../services/crisis";

interface CrisisPanelProps {
  level: CrisisLevel;
}

/**
 * Contatos de ajuda fixos na tela.
 * Niveis 2 e 3: modo crise (tarefas pausadas). Nivel 1: lembrete discreto.
 */
export function CrisisPanel({ level }: CrisisPanelProps) {
  if (level < 1) return null;

  if (level === 1) {
    return (
      <aside className="crisis-panel crisis-panel-attention" data-testid="crisis-attention-panel" aria-label="Contatos de ajuda">
        <p className="crisis-copy">
          Se ficar pesado demais: <a href="tel:188">ligar 188 (CVV, 24 h, gratuito)</a>.
        </p>
      </aside>
    );
  }

  return (
    <aside className="crisis-panel" data-testid="crisis-panel" role="region" aria-label="Modo crise">
      <p className="crisis-title">Modo crise</p>
      <p className="crisis-copy">
        As tarefas estão pausadas. A Medusa continua aqui com você.
        {level === 3 ? " Em risco imediato, ligue 192 agora." : ""}
      </p>
      <div className="crisis-actions">
        {level === 3 ? (
          <>
            <a className="crisis-btn crisis-btn-main" href="tel:192" data-testid="crisis-call-192">Ligar 192 (SAMU)</a>
            <a className="crisis-btn" href="tel:188" data-testid="crisis-call-188">Ligar 188 (CVV)</a>
          </>
        ) : (
          <>
            <a className="crisis-btn crisis-btn-main" href="tel:188" data-testid="crisis-call-188">Ligar 188 (CVV)</a>
            <a className="crisis-btn" href="tel:192" data-testid="crisis-call-192">Ligar 192 (SAMU)</a>
          </>
        )}
        <a
          className="crisis-btn"
          href="https://cvv.org.br/chat/"
          target="_blank"
          rel="noopener noreferrer"
          data-testid="crisis-cvv-chat"
        >
          Chat do CVV
        </a>
      </div>
      <p className="crisis-note">188 atende 24 horas, de graça. O chat do CVV tem horário limitado.</p>
    </aside>
  );
}
