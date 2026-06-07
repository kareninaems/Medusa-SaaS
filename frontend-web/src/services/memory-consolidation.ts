import type { Message, MemoryRow } from "../types/medusa";

interface ConsolidationResult {
  patterns: string[];
  triggers: string[];
  worked: string[];
  didnt_work: string[];
  context: string[];
}

// Keywords indicativas de padrões comportamentais
const PATTERN_SIGNALS: Record<string, string[]> = {
  "procrastinação": ["procrastin", "deixei para depois", "nao comecei", "nao consegui comecar", "emperrei"],
  "hiperfoco": ["hiperfoco", "fiquei horas", "perdi a nocao do tempo", "so conseguia pensar nisso"],
  "paralisia por análise": ["paralisi", "travei", "nao conseguia decidir", "muitas opcoes", "ficou grande demais"],
  "sobrecarga sensorial": ["barulho", "luz", "estimulo", "fone de ouvido", "nao conseguia focar com"],
  "esquecimento": ["esqueci", "nao lembrei", "nao anotei", "sumiu da cabeca"],
  "impulsividade": ["sem pensar", "ja fiz antes de", "reagir antes", "mandei sem revisar"],
  "perfeccionismo": ["nao estava bom o suficiente", "precisava estar perfeito", "refiz varias vezes", "nao publiquei porque"],
};

const TRIGGER_SIGNALS = [
  "quando eu", "isso me trava", "me estresso com", "me paralisa", "me desregula",
  "nao suporto", "me irrita", "fico ansioso quando", "me sobrecarrega", "nao consigo quando",
  "tenho dificuldade com", "o que me atrapalha", "me bloqueia",
];

const WORKED_SIGNALS = [
  "funcionou", "ajudou", "consegui quando", "o que funcionou", "deu certo",
  "me ajudou a", "resolveu", "fez diferenca", "me desbloqueou", "voltei a conseguir",
  "o que deu certo", "estrategia que funcionou",
];

const DIDNT_WORK_SIGNALS = [
  "nao funcionou", "nao adiantou", "tentei e nao", "de nada adiantou",
  "pior ainda", "fez piorar", "nao resolveu", "continuei travada", "nao me ajudou",
];

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

function extractSentencesContaining(messages: Message[], signals: string[]): string[] {
  const found: string[] = [];
  for (const msg of messages) {
    if (msg.role !== "user") continue;
    const norm = normalize(msg.content);
    const sentences = msg.content.split(/[.!?\n]+/);
    for (const sentence of sentences) {
      const normSentence = normalize(sentence);
      if (signals.some((s) => normSentence.includes(s))) {
        const trimmed = sentence.trim();
        if (trimmed.length > 10 && trimmed.length < 120) {
          found.push(trimmed);
        }
      }
    }
    void norm;
  }
  return [...new Set(found)].slice(0, 5);
}

function detectPatterns(messages: Message[]): string[] {
  const found: string[] = [];
  for (const msg of messages) {
    if (msg.role !== "user") continue;
    const norm = normalize(msg.content);
    for (const [pattern, signals] of Object.entries(PATTERN_SIGNALS)) {
      if (signals.some((s) => norm.includes(s))) {
        found.push(pattern);
      }
    }
  }
  return [...new Set(found)].slice(0, 5);
}

export function consolidateMemoryFromMessages(messages: Message[]): ConsolidationResult {
  if (!messages.length) {
    return { patterns: [], triggers: [], worked: [], didnt_work: [], context: [] };
  }

  return {
    patterns: detectPatterns(messages),
    triggers: extractSentencesContaining(messages, TRIGGER_SIGNALS),
    worked: extractSentencesContaining(messages, WORKED_SIGNALS),
    didnt_work: extractSentencesContaining(messages, DIDNT_WORK_SIGNALS),
    context: [],
  };
}

// Mescla resultado da consolidação com memória existente, sem duplicar
export function mergeMemory(
  existing: MemoryRow | null,
  consolidated: ConsolidationResult,
): Partial<MemoryRow> {
  const merge = (existing: string[], fresh: string[]) =>
    [...new Set([...existing, ...fresh])].slice(0, 15);

  return {
    patterns: merge(existing?.patterns ?? [], consolidated.patterns),
    triggers: merge(existing?.triggers ?? [], consolidated.triggers),
    worked: merge(existing?.worked ?? [], consolidated.worked),
    didnt_work: merge(existing?.didnt_work ?? [], consolidated.didnt_work),
    context: Array.isArray(existing?.context)
      ? merge(existing.context as string[], consolidated.context)
      : consolidated.context,
  };
}
