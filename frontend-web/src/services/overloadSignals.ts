// Sinais pessoais de sobrecarga: o usuario cadastra o que costuma aparecer
// antes de uma crise e marca no check-in o que apareceu no dia.

export const MAX_OVERLOAD_SIGNALS = 8;
const LOG_DAYS_KEPT = 14;

export type OverloadSignalLog = Record<string, string[]>;

export interface OverloadAlert {
  active: boolean;
  todaySignals: string[];
  consecutiveDays: boolean;
}

function toKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function todayKey(now: Date = new Date()): string {
  return toKey(now);
}

function previousDayKey(dayKey: string): string {
  const [y, m, d] = dayKey.split("-").map(Number);
  return toKey(new Date(y, m - 1, d - 1));
}

export function parseSignals(text: string): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of text.split(/[\n;]+/)) {
    const item = raw.trim().replace(/\s+/g, " ").slice(0, 80);
    if (!item) continue;
    const key = item.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
    if (result.length >= MAX_OVERLOAD_SIGNALS) break;
  }
  return result;
}

export function appendSignalLog(
  log: OverloadSignalLog | null | undefined,
  dayKey: string,
  marked: string[],
): OverloadSignalLog {
  const next: OverloadSignalLog = { ...(log ?? {}), [dayKey]: marked };
  const keptKeys = Object.keys(next).sort().slice(-LOG_DAYS_KEPT);
  const trimmed: OverloadSignalLog = {};
  for (const key of keptKeys) trimmed[key] = next[key];
  return trimmed;
}

// Regra do alerta: 2 ou mais sinais no mesmo dia, ou sinal marcado hoje e ontem.
export function computeOverloadAlert(
  log: OverloadSignalLog | null | undefined,
  dayKey: string,
): OverloadAlert {
  const todaySignals = log?.[dayKey] ?? [];
  const yesterdaySignals = log?.[previousDayKey(dayKey)] ?? [];
  const consecutiveDays = todaySignals.length >= 1 && yesterdaySignals.length >= 1;
  return {
    active: todaySignals.length >= 2 || consecutiveDays,
    todaySignals,
    consecutiveDays,
  };
}

// Texto enviado ao modelo pelo campo "Gatilhos" do perfil.
export function signalsToPromptLines(signals: string[], alert: OverloadAlert): string[] {
  const lines: string[] = [];
  if (signals.length > 0) {
    lines.push(
      `SINAIS PESSOAIS DE SOBRECARGA cadastrados pelo usuario: ${signals.join("; ")}. ` +
        "Se a mensagem indicar algum deles, nomeie o sinal com cuidado e reduza a demanda. Nao diagnostique.",
    );
  }
  if (alert.todaySignals.length > 0) {
    lines.push(`Sinais marcados pelo usuario no check-in de hoje: ${alert.todaySignals.join("; ")}.`);
  }
  if (alert.active) {
    lines.push(
      "ALERTA DE SOBRECARGA ATIVO HOJE: acolha primeiro, proponha uma unica acao pequena, sem lista e sem tarefa nova.",
    );
  }
  return lines;
}
