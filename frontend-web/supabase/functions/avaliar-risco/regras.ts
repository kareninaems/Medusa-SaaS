// Regras do modo crise. Arquivo puro (sem rede, sem banco) para poder ser testado.
//
// Niveis de risco:
//   0 = sem sinal
//   1 = atencao (sofrimento intenso, sem falar em se machucar)
//   2 = risco (pensamento ou vontade de se machucar ou morrer)
//   3 = risco imediato (intencao agora, plano, meio a mao, ato em andamento)
//
// Nos niveis 2 e 3 o app fica travado em modo crise: nenhuma tarefa e iniciada.
// A saida e por evidencia acumulada, um degrau por vez. Uma frase so nunca destrava.

export type RiskLevel = 0 | 1 | 2 | 3;
export type SafetyEvidence = 0 | 1 | 2;

export interface CrisisState {
  level: RiskLevel;
  /** Mensagens seguidas sem sinal de risco desde o ultimo sinal ou degrau. */
  calm_count: number;
  /** Maior evidencia de seguranca vista desde o ultimo sinal ou degrau. */
  safety_seen: SafetyEvidence;
  /** Ultima mensagem com risco 2 ou 3. */
  last_risk_at: string | null;
  /** Ultima mensagem com risco 1 ou maior. */
  last_signal_at: string | null;
  /** Quando entrou no nivel atual. */
  level_since: string | null;
}

export interface Assessment {
  risco: RiskLevel;
  seguranca: SafetyEvidence;
}

export type Transition = "nenhuma" | "escalou" | "manteve" | "desceu";

export const RULES = {
  /** Minutos minimos sem sinal de risco antes de descer um degrau. */
  minMinutes: { 3: 20, 2: 20 } as Record<number, number>,
  /** Mensagens calmas seguidas exigidas antes de descer um degrau. */
  calmMessages: 2,
  /** Evidencia de seguranca exigida: 2 = detalhe concreto, 1 = afirmacao simples. */
  safetyNeeded: { 3: 2, 2: 1 } as Record<number, number>,
  /** Horas em atencao (nivel 1) sem novo sinal antes de voltar a 0. */
  attentionHours: 24,
};

export const EMPTY_STATE: CrisisState = {
  level: 0,
  calm_count: 0,
  safety_seen: 0,
  last_risk_at: null,
  last_signal_at: null,
  level_since: null,
};

export function isLocked(level: number): boolean {
  return level >= 2;
}

function minutesBetween(fromIso: string | null, now: Date): number {
  if (!fromIso) return Number.POSITIVE_INFINITY;
  const from = new Date(fromIso).getTime();
  if (Number.isNaN(from)) return Number.POSITIVE_INFINITY;
  return (now.getTime() - from) / 60000;
}

/** Inicio da contagem de tempo do degrau atual: o mais recente entre o ultimo sinal e a entrada no nivel. */
function calmClockStart(state: CrisisState): string | null {
  const candidates = [state.last_risk_at, state.level_since].filter((value): value is string => !!value);
  if (candidates.length === 0) return null;
  return candidates.reduce((latest, value) => (new Date(value) > new Date(latest) ? value : latest));
}

/** O que ainda falta para descer um degrau. Usado para orientar a resposta, nunca mostrado como regra a burlar. */
export function pendingForRelease(state: CrisisState, now: Date) {
  if (!isLocked(state.level)) return { minutesLeft: 0, calmLeft: 0, needsSafety: false };
  const elapsed = minutesBetween(calmClockStart(state), now);
  return {
    minutesLeft: Math.max(0, Math.ceil(RULES.minMinutes[state.level] - elapsed)),
    calmLeft: Math.max(0, RULES.calmMessages - state.calm_count),
    needsSafety: state.safety_seen < RULES.safetyNeeded[state.level],
  };
}

/** Nivel 1 volta a 0 sozinho depois de 24 h sem sinal. Niveis 2 e 3 nunca descem so com o tempo. */
export function applyTimeDecay(state: CrisisState, now: Date): CrisisState {
  if (state.level !== 1) return state;
  if (minutesBetween(state.last_signal_at ?? state.level_since, now) < RULES.attentionHours * 60) return state;
  return { ...EMPTY_STATE };
}

/**
 * Aplica a avaliacao de uma mensagem ao estado.
 * `assessment` nulo = avaliador indisponivel e sem palavra de risco: o estado nao muda
 * (nao sobe, e tambem nao ganha credito para descer).
 */
export function applyAssessment(
  current: CrisisState,
  assessment: Assessment | null,
  now: Date,
): { state: CrisisState; transition: Transition } {
  const state = applyTimeDecay(current, now);
  if (!assessment) return { state, transition: isLocked(state.level) ? "manteve" : "nenhuma" };

  const nowIso = now.toISOString();
  const { risco, seguranca } = assessment;

  // Sinal de risco (2 ou 3): sobe na hora ou renova a trava. Zera todo o credito acumulado.
  if (risco >= 2) {
    const level = Math.max(state.level, risco) as RiskLevel;
    return {
      state: {
        level,
        calm_count: 0,
        safety_seen: 0,
        last_risk_at: nowIso,
        last_signal_at: nowIso,
        level_since: level > state.level ? nowIso : state.level_since ?? nowIso,
      },
      transition: level > state.level ? "escalou" : "manteve",
    };
  }

  // Fora da trava: so registra atencao.
  if (!isLocked(state.level)) {
    if (risco === 1) {
      return {
        state: {
          ...state,
          level: 1,
          last_signal_at: nowIso,
          level_since: state.level === 1 ? state.level_since ?? nowIso : nowIso,
        },
        transition: state.level === 1 ? "nenhuma" : "escalou",
      };
    }
    return { state, transition: "nenhuma" };
  }

  // Dentro da trava, mensagem sem risco 2/3.
  // "Nao estou bem" (risco 1) nao conta como calma: zera a sequencia.
  const calm_count = risco === 0 ? state.calm_count + 1 : 0;
  const safety_seen = Math.max(state.safety_seen, seguranca) as SafetyEvidence;
  const next: CrisisState = {
    ...state,
    calm_count,
    safety_seen,
    last_signal_at: risco === 1 ? nowIso : state.last_signal_at,
  };

  const pending = pendingForRelease(next, now);
  const canStepDown = pending.minutesLeft === 0 && pending.calmLeft === 0 && !pending.needsSafety;
  if (!canStepDown) return { state: next, transition: "manteve" };

  // Desce um degrau so. O credito zera: o proximo degrau exige nova evidencia.
  return {
    state: {
      level: (state.level - 1) as RiskLevel,
      calm_count: 0,
      safety_seen: 0,
      last_risk_at: state.last_risk_at,
      last_signal_at: nowIso,
      level_since: nowIso,
    },
    transition: "desceu",
  };
}

const RISK_TERMS = [
  "suicid",
  "me matar",
  "quero morrer",
  "queria morrer",
  "vou morrer hoje",
  "tirar minha vida",
  "tirar a minha vida",
  "tirar a propria vida",
  "acabar com a minha vida",
  "acabar com minha vida",
  "nao quero mais viver",
  "nao aguento mais viver",
  "autoextermin",
  "auto exterminio",
  "autolesao",
  "auto lesao",
  "autoagress",
  "automutil",
  "me mutilar",
  "mutilacao",
  "me cortar",
  "me machucar",
  "overdose",
  "plano para morrer",
  "remedio para morrer",
];

/** Intencao declarada, em primeira pessoa: piso de risco imediato. */
const IMMEDIATE_PATTERN =
  /\b(vou|irei|quero|preciso|tentei|tentando|ja tomei|tomei)\s+(me\s+)?(matar|machucar|cortar|mutilar|enforcar|suicidar)/;

/**
 * Rede de seguranca: palavra de risco = nivel 2; intencao declarada ("vou me machucar") = nivel 3.
 * Sem palavra = indeterminado. Vale como piso sobre o classificador.
 */
export function keywordAssessment(text: string): Assessment | null {
  const normalized = text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
  if (IMMEDIATE_PATTERN.test(normalized)) return { risco: 3, seguranca: 0 };
  return RISK_TERMS.some((term) => normalized.includes(term)) ? { risco: 2, seguranca: 0 } : null;
}

/**
 * Junta classificador e lista de palavras. A palavra de risco e piso: o resultado nunca fica abaixo de 2.
 * Classificador indisponivel: vale so a lista (sem palavra = indeterminado).
 */
export function combineAssessments(model: Assessment | null, keyword: Assessment | null): Assessment | null {
  if (!model) return keyword;
  if (!keyword) return model;
  return { risco: Math.max(model.risco, keyword.risco) as RiskLevel, seguranca: model.seguranca };
}

/** Le o JSON devolvido pelo avaliador. Qualquer formato inesperado = nulo. */
export function parseAssessment(raw: string): Assessment | null {
  const match = raw.match(/\{[^{}]*\}/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]) as Record<string, unknown>;
    const risco = Number(parsed.risco);
    const seguranca = Number(parsed.seguranca);
    if (![0, 1, 2, 3].includes(risco) || ![0, 1, 2].includes(seguranca)) return null;
    return { risco: risco as RiskLevel, seguranca: seguranca as SafetyEvidence };
  } catch {
    return null;
  }
}
