import type { Session } from "@supabase/supabase-js";

import { supabase } from "../lib/supabase";

// Modo crise. O nivel de risco e decidido no servidor (edge function "avaliar-risco")
// e fica salvo la: fechar o app nao apaga a trava.
//   0 = sem sinal   1 = atencao   2 = risco   3 = risco imediato
// Nos niveis 2 e 3 o chat fica travado em modo crise e nenhuma tarefa e iniciada.

export type CrisisLevel = 0 | 1 | 2 | 3;

export interface CrisisResult {
  level: CrisisLevel;
  locked: boolean;
  reply: string | null;
}

const TIMEOUT_MS = 20000;

export const CRISIS_LOCAL_FALLBACK =
  "Estou aqui e continuo aqui.\n" +
  "As tarefas ficam pausadas. Agora o foco é você estar em segurança.\n" +
  "O 188 (CVV) atende 24 horas, de graça. Em risco imediato, ligue 192. Os botões estão na tela.\n" +
  "Tem alguém perto de você agora?";

function withTimeout<T>(promise: Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error("Avaliação de risco demorou demais.")), TIMEOUT_MS);
    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(timer);
        reject(error);
      },
    );
  });
}

async function invoke(session: Session, body: Record<string, unknown>): Promise<CrisisResult> {
  const { data, error } = await withTimeout(
    supabase.functions.invoke("avaliar-risco", {
      body,
      headers: { Authorization: `Bearer ${session.access_token}` },
    }),
  );
  if (error) throw error;
  const level = Number(data?.level);
  if (![0, 1, 2, 3].includes(level)) throw new Error("Avaliação de risco sem resposta válida.");
  return {
    level: level as CrisisLevel,
    locked: level >= 2,
    reply: typeof data?.reply === "string" && data.reply.trim() ? data.reply : null,
  };
}

/** Avalia a mensagem que a pessoa acabou de enviar. Chamado antes do claude-proxy. */
export function assessRisk(session: Session, text: string): Promise<CrisisResult> {
  return invoke(session, { action: "avaliar", text });
}

/** Nivel salvo no servidor. Chamado ao abrir o app. */
export function getCrisisState(session: Session): Promise<CrisisResult> {
  return invoke(session, { action: "estado" });
}
