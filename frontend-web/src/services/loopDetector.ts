export type LoopType =
  | "ENXAME"
  | "CORO"
  | "PENDULO"
  | "SISIFO"
  | "ESPELHO"
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
  ENXAME: [
    /estou fazendo mil coisas/i,
    /não terminei nada/i,
    /me perdi no meio do dia/i,
    /não sei por onde come(ç|c)o/i,
    /comecei (várias|muitas) (tarefas|coisas)/i,
    /nada avança/i,
    /totalmente disperso/i
  ],
  CORO: [
    /tenho que fazer tanta coisa ao mesmo tempo/i,
    /não consigo priorizar/i,
    /tudo é urgente/i,
    /minha cabeça está uma bagunça/i,
    /estou paralisad[oa]/i,
    /muitas demandas/i
  ],
  PENDULO: [
    /é assim que sempre fiz/i,
    /não posso parar agora/i,
    /preciso continuar/i,
    /já investi muito tempo nisso/i,
    /não adianta mudar/i,
    /tenho que terminar de qualquer jeito/i
  ],
  SISIFO: [
    /ninguém mais vai fazer/i,
    /se eu não fizer, não sai/i,
    /não posso pedir ajuda/i,
    /estou com \d+ coisas só minhas/i,
    /só eu entendo isso/i,
    /não confio que façam certo/i
  ],
  ESPELHO: [
    /tive uma ideia genial/i,
    /já fiz tudo sozinho/i,
    /está pronto, confia/i,
    /ninguém precisou revisar/i,
    /não mostrei para ninguém ainda/i
  ],
  DON_QUIXOTE: [
    /faço em \d+ minutos/i,
    /dá tempo de sobra/i,
    /até amanhã eu entrego/i,
    /achei que era mais cedo/i,
    /perdi a noção das horas/i,
    /isso é super rápido/i
  ],
  BURNOUT: [],
  ALTA_DEMANDA: [
    /muito barulho/i,
    /muita gente/i,
    /agenda cheia/i,
    /não tive um minuto de silêncio/i,
    /estou exausto de tanta interação/i,
    /sobrecarga sensorial/i,
    /luz muito forte/i,
    /não aguento mais barulho/i
  ]
};

const ENERGY_RULES: Partial<Record<LoopType, { min?: number; max?: number }>> = {
  ENXAME: { min: 2 },
  PENDULO: { min: 2 },
  ESPELHO: { min: 3 },
  DON_QUIXOTE: { min: 3 },
  CORO: { max: 2 }
};

function scoreLoop(
  loop: LoopType,
  text: string,
  energyLog: number[]
): number {
  if (loop === "BURNOUT") {
    // Exige 3 registros reais: sem dados, nao ha como afirmar energia critica.
    const lastThree = energyLog.slice(-3);
    return lastThree.length >= 3 && lastThree.every(e => e <= 1) ? 1.0 : 0.0;
  }

  const triggers = TRIGGERS[loop];
  let matches = 0;
  for (const regex of triggers) {
    const count = (text.match(regex) || []).length;
    matches += count;
  }

  let textScore = Math.min(matches / 3, 1.0);

  const energyRule = ENERGY_RULES[loop];
  if (energyRule && energyLog.length > 0) {
    const lastEnergy = energyLog[energyLog.length - 1];
    if (energyRule.min !== undefined && lastEnergy < energyRule.min) {
      textScore *= 0.2;
    }
    if (energyRule.max !== undefined && lastEnergy > energyRule.max) {
      textScore *= 0.2;
    }
  }

  return textScore;
}

export function detectLoop(
  messages: string[],
  energyLog: number[]
): DetectionResult {
  const recentText = messages.slice(-10).join(" ");

  const burnoutScore = scoreLoop("BURNOUT", recentText, energyLog);
  if (burnoutScore === 1.0) {
    return {
      loop: "BURNOUT",
      confidence: 1.0,
      allScores: [{ loop: "BURNOUT", score: 1.0 }]
    };
  }

  const allLoops: LoopType[] = [
    "ENXAME",
    "CORO",
    "PENDULO",
    "SISIFO",
    "ESPELHO",
    "DON_QUIXOTE",
    "ALTA_DEMANDA"
  ];
  const scores: LoopScore[] = allLoops.map(loop => ({
    loop,
    score: scoreLoop(loop, recentText, energyLog)
  }));

  scores.sort((a, b) => b.score - a.score);

  const threshold = 0.6;
  const top = scores[0];
  if (top.score >= threshold) {
    return {
      loop: top.loop,
      confidence: top.score,
      allScores: scores
    };
  }

  return {
    loop: null,
    confidence: 0,
    allScores: scores
  };
}

