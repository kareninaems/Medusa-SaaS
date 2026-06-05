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

function scoreLoop(loop: LoopType, text: string, energyLog: number[]): number {
  if (loop === "BURNOUT") {
    return energyLog.slice(-3).length === 3 && energyLog.slice(-3).every((e) => e <= 1) ? 1.0 : 0.0;
  }

  const triggers = TRIGGERS[loop];
  let matches = 0;
  for (const regex of triggers) {
    matches += (text.match(regex) || []).length;
  }

  let textScore = Math.min(matches / 3, 1.0);

  const energyRule = ENERGY_RULES[loop];
  if (energyRule && energyLog.length > 0) {
    const lastEnergy = energyLog[energyLog.length - 1];
    if (energyRule.min !== undefined && lastEnergy < energyRule.min) textScore *= 0.2;
    if (energyRule.max !== undefined && lastEnergy > energyRule.max) textScore *= 0.2;
  }

  return textScore;
}

export function detectLoop(messages: string[], energyLog: number[]): DetectionResult {
  const recentText = messages.slice(-10).join(" ");

  const burnoutScore = scoreLoop("BURNOUT", recentText, energyLog);
  if (burnoutScore === 1.0) {
    return { loop: "BURNOUT", confidence: 1.0, allScores: [{ loop: "BURNOUT", score: 1.0 }] };
  }

  const scores: LoopScore[] = LOOP_PRIORITY.map((loop) => ({
    loop,
    score: scoreLoop(loop, recentText, energyLog),
  }));

  scores.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return LOOP_PRIORITY.indexOf(a.loop) - LOOP_PRIORITY.indexOf(b.loop);
  });

  const top = scores[0];
  if (top.score >= 0.6) {
    return { loop: top.loop, confidence: top.score, allScores: scores };
  }

  return { loop: null, confidence: 0, allScores: scores };
}
