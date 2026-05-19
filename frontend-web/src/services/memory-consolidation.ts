import type { Message } from "../types/medusa";

interface ConsolidationResult {
  patterns: string[];
  triggers: string[];
  worked: string[];
  didnt_work: string[];
  context: string[];
}

// Preparação para fase seguinte:
// consolidar memória automaticamente a partir do histórico de mensagens.
export function consolidateMemoryFromMessages(_messages: Message[]): ConsolidationResult {
  return {
    patterns: [],
    triggers: [],
    worked: [],
    didnt_work: [],
    context: [],
  };
}
