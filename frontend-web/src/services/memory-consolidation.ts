import type { Message } from "../types/medusa";

export interface ConsolidationResult {
  patterns: string[];
  triggers: string[];
  worked: string[];
  didnt_work: string[];
  context: string[];
}

const DEFAULT_LIMIT = 80;
const MAX_ITEMS = 8;

const TRIGGER_KEYWORDS = [
  "barulho",
  "prazo",
  "urgente",
  "sobrecarga",
  "travada",
  "travado",
  "ansiedade",
  "muita gente",
  "sem energia",
  "cansada",
  "cansado",
  "dispersa",
  "disperso",
];

const WORKED_MARKERS = [
  "funcionou",
  "ajudou",
  "deu certo",
  "consegui",
  "foi bom",
  "melhorou",
  "me organizou",
  "foi util",
];

const DIDNT_WORK_MARKERS = [
  "nao funcionou",
  "não funcionou",
  "nao consegui",
  "não consegui",
  "falhou",
  "travei",
  "piorei",
  "nao ajudou",
  "não ajudou",
  "me perdi",
];

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function compactSnippet(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > 140 ? `${clean.slice(0, 137)}...` : clean;
}

function addUnique(target: string[], value: string) {
  const clean = compactSnippet(value);
  if (!clean) return;
  const alreadyExists = target.some((item) => normalize(item) === normalize(clean));
  if (!alreadyExists && target.length < MAX_ITEMS) target.push(clean);
}

function collectMarkedSnippets(messages: Message[], markers: string[]): string[] {
  const result: string[] = [];
  messages.forEach((message) => {
    if (message.role !== "user") return;
    const normalized = normalize(message.content);
    if (markers.some((marker) => normalized.includes(normalize(marker)))) {
      addUnique(result, message.content);
    }
  });
  return result;
}

function collectTriggers(messages: Message[]): string[] {
  const triggers: string[] = [];
  const combined = normalize(messages.filter((message) => message.role === "user").map((message) => message.content).join(" "));
  TRIGGER_KEYWORDS.forEach((keyword) => {
    if (combined.includes(normalize(keyword))) {
      addUnique(triggers, keyword);
    }
  });
  return triggers;
}

function collectPatterns(messages: Message[]): string[] {
  const patterns: string[] = [];
  const userMessages = messages.filter((message) => message.role === "user");
  const energyValues = userMessages
    .map((message) => message.energy)
    .filter((energy): energy is number => typeof energy === "number");

  if (energyValues.length >= 3) {
    const lowEnergyCount = energyValues.filter((energy) => energy <= 1).length;
    if (lowEnergyCount >= Math.ceil(energyValues.length * 0.5)) {
      addUnique(patterns, "Energia baixa aparece com frequencia nas conversas recentes.");
    }
  }

  const combined = normalize(userMessages.map((message) => message.content).join(" "));
  if (combined.includes("nao sei por onde comeco") || combined.includes("nao sei por onde começar")) {
    addUnique(patterns, "Costuma travar quando precisa escolher o primeiro passo.");
  }
  if (combined.includes("muitas tarefas") || combined.includes("mil coisas") || combined.includes("tudo urgente")) {
    addUnique(patterns, "Sobrecarga por muitas demandas ao mesmo tempo.");
  }
  if (combined.includes("prazo") || combined.includes("entrega") || combined.includes("deadline")) {
    addUnique(patterns, "Pressao de prazo aparece como fator recorrente.");
  }

  return patterns;
}

function collectContext(messages: Message[]): string[] {
  const context: string[] = [];
  const lastUserMessages = messages.filter((message) => message.role === "user").slice(-3);
  lastUserMessages.forEach((message) => addUnique(context, `Conversa recente: ${message.content}`));
  return context;
}

export function consolidateMemoryFromMessages(messages: Message[], limit = DEFAULT_LIMIT): ConsolidationResult {
  const recentMessages = messages
    .filter((message) => message.role === "user" || message.role === "assistant")
    .slice(-limit);

  return {
    patterns: collectPatterns(recentMessages),
    triggers: collectTriggers(recentMessages),
    worked: collectMarkedSnippets(recentMessages, WORKED_MARKERS),
    didnt_work: collectMarkedSnippets(recentMessages, DIDNT_WORK_MARKERS),
    context: collectContext(recentMessages),
  };
}
