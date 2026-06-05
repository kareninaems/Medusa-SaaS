import { supabase } from "../lib/supabase";

export type LoopType =
  | "MINIONS"
  | "MERIDA_RILEY"
  | "COIOTE"
  | "SISIFO"
  | "MICHAEL_SCOTT"
  | "DON_QUIXOTE"
  | "BURNOUT"
  | "ALTA_DEMANDA";

interface LoopScore {
  loop: LoopType;
  score: number;
}

export interface DetectionResult {
  loop: LoopType | null;
  confidence: number;
  allScores: LoopScore[];
  triggeredIndices: number[]; // indices of TRIGGERS[loop] that matched
}

export interface LoopProfile {
  weights: Record<string, number[]>;
  custom_triggers: Record<string, string[]>;
}

const TRIGGERS: Record<LoopType, RegExp[]> = {
  MINIONS: [
    /estou fazendo mil coisas/i,
    /n[aã]o terminei nada/i,
    /me perdi no meio do dia/i,
    /n[aã]o sei por onde come[cç]o/i,
    /comecei (v[aá]rias|muitas) (tarefas|coisas)/i,
    /nada avan[cç]a/i,
    /totalmente disperso/i,
  ],
  MERIDA_RILEY: [
    /tenho que fazer tanta coisa ao mesmo tempo/i,
    /n[aã]o consigo priorizar/i,
    /tudo [eé] urgente/i,
    /minha cabe[cç]a est[aá] uma bagun[cç]a/i,
    /estou paralisad[oa]/i,
    /muitas demandas/i,
  ],
  COIOTE: [
    /[eé] assim que sempre fiz/i,
    /n[aã]o posso parar agora/i,
    /preciso continuar/i,
    /j[aá] investi muito tempo nisso/i,
    /n[aã]o adianta mudar/i,
    /tenho que terminar de qualquer jeito/i,
  ],
  SISIFO: [
    /ningu[eé]m mais vai fazer/i,
    /se eu n[aã]o fizer, n[aã]o sai/i,
    /n[aã]o posso pedir ajuda/i,
    /estou com \d+ coisas s[oó] minhas/i,
    /s[oó] eu entendo isso/i,
    /n[aã]o confio que fa[cç]am certo/i,
  ],
  MICHAEL_SCOTT: [
    /tive uma ideia genial/i,
    /j[aá] fiz tudo sozinho/i,
    /est[aá] pronto, confia/i,
    /ningu[eé]m precisou revisar/i,
    /n[aã]o mostrei para ningu[eé]m ainda/i,
  ],
  DON_QUIXOTE: [
    /fa[cç]o em \d+ minutos/i,
    /d[aá] tempo de sobra/i,
    /at[eé] amanh[aã] eu entrego/i,
    /achei que era mais cedo/i,
    /perdi a no[cç][aã]o das horas/i,
    /isso [eé] super r[aá]pido/i,
  ],
  BURNOUT: [],
  ALTA_DEMANDA: [
    /muito barulho/i,
    /muita gente/i,
    /agenda cheia/i,
    /n[aã]o tive um minuto de sil[eê]ncio/i,
    /estou exausto de tanta intera[cç][aã]o/i,
    /sobrecarga sensorial/i,
    /luz muito forte/i,
    /n[aã]o aguento mais barulho/i,
  ],
};

const ENERGY_RULES: Partial<Record<LoopType, { min?: number; max?: number }>> = {
  MINIONS: { min: 2 },
  COIOTE: { min: 2 },
  MICHAEL_SCOTT: { min: 3 },
  DON_QUIXOTE: { min: 3 },
  MERIDA_RILEY: { max: 2 },
};

const LOOP_PRIORITY: LoopType[] = [
  "ALTA_DEMANDA",
  "SISIFO",
  "MERIDA_RILEY",
  "DON_QUIXOTE",
  "MINIONS",
  "COIOTE",
  "MICHAEL_SCOTT",
];

interface ScoreWithIndices {
  score: number;
  matchedIndices: number[];
}

function scoreLoop(loop: LoopType, text: string, energyLog: number[]): ScoreWithIndices {
  if (loop === "BURNOUT") {
    const isBurnout = energyLog.slice(-3).length === 3 && energyLog.slice(-3).every((e) => e <= 1);
    return { score: isBurnout ? 1.0 : 0.0, matchedIndices: [] };
  }

  const triggers = TRIGGERS[loop];
  let matches = 0;
  const matchedIndices: number[] = [];

  for (let i = 0; i < triggers.length; i++) {
    const count = (text.match(triggers[i]) || []).length;
    if (count > 0) {
      matches += count;
      matchedIndices.push(i);
    }
  }

  let textScore = Math.min(matches / 3, 1.0);

  const energyRule = ENERGY_RULES[loop];
  if (energyRule && energyLog.length > 0) {
    const lastEnergy = energyLog[energyLog.length - 1];
    if (energyRule.min !== undefined && lastEnergy < energyRule.min) textScore *= 0.2;
    if (energyRule.max !== undefined && lastEnergy > energyRule.max) textScore *= 0.2;
  }

  return { score: textScore, matchedIndices };
}

export function scoreLoopWithProfile(
  loop: LoopType,
  text: string,
  energyLog: number[],
  profile: LoopProfile,
): ScoreWithIndices {
  const base = scoreLoop(loop, text, energyLog);
  if (loop === "BURNOUT" || base.matchedIndices.length === 0) return base;

  const weights = profile.weights[loop];
  if (!weights) return base;

  // Re-score with per-trigger weight multipliers
  const triggers = TRIGGERS[loop];
  let weightedMatches = 0;
  for (const idx of base.matchedIndices) {
    const w = idx < weights.length ? weights[idx] : 1.0;
    const count = (text.match(triggers[idx]) || []).length;
    weightedMatches += count * w;
  }

  let textScore = Math.min(weightedMatches / 3, 1.0);

  const energyRule = ENERGY_RULES[loop];
  if (energyRule && energyLog.length > 0) {
    const lastEnergy = energyLog[energyLog.length - 1];
    if (energyRule.min !== undefined && lastEnergy < energyRule.min) textScore *= 0.2;
    if (energyRule.max !== undefined && lastEnergy > energyRule.max) textScore *= 0.2;
  }

  return { score: textScore, matchedIndices: base.matchedIndices };
}

export async function loadLoopProfile(userId: string): Promise<LoopProfile | null> {
  const { data, error } = await supabase
    .from("loop_profiles")
    .select("weights, custom_triggers")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) return null;
  return {
    weights: (data.weights as Record<string, number[]>) ?? {},
    custom_triggers: (data.custom_triggers as Record<string, string[]>) ?? {},
  };
}

export function detectLoop(messages: string[], energyLog: number[], profile?: LoopProfile): DetectionResult {
  const recentText = messages.slice(-10).join(" ");

  const burnoutResult = scoreLoop("BURNOUT", recentText, energyLog);
  if (burnoutResult.score === 1.0) {
    return { loop: "BURNOUT", confidence: 1.0, allScores: [{ loop: "BURNOUT", score: 1.0 }], triggeredIndices: [] };
  }

  const scores: (LoopScore & { matchedIndices: number[] })[] = LOOP_PRIORITY.map((loop) => {
    const result = profile
      ? scoreLoopWithProfile(loop, recentText, energyLog, profile)
      : scoreLoop(loop, recentText, energyLog);
    return { loop, score: result.score, matchedIndices: result.matchedIndices };
  });

  scores.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return LOOP_PRIORITY.indexOf(a.loop) - LOOP_PRIORITY.indexOf(b.loop);
  });

  const top = scores[0];
  if (top.score >= 0.6) {
    return {
      loop: top.loop,
      confidence: top.score,
      allScores: scores.map(({ loop, score }) => ({ loop, score })),
      triggeredIndices: top.matchedIndices,
    };
  }

  return {
    loop: null,
    confidence: 0,
    allScores: scores.map(({ loop, score }) => ({ loop, score })),
    triggeredIndices: [],
  };
}
