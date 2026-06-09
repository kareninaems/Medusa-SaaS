export const TRIAL_DAYS = 7;

export function isTrialAtivo(createdAt: string): boolean {
  const accountCreatedAt = new Date(createdAt);
  const diasDesdeCreacao = (Date.now() - accountCreatedAt.getTime()) / (1000 * 60 * 60 * 24);
  return diasDesdeCreacao <= TRIAL_DAYS;
}

export function diasRestantesTrial(createdAt: string): number {
  const accountCreatedAt = new Date(createdAt);
  const diasDesdeCreacao = (Date.now() - accountCreatedAt.getTime()) / (1000 * 60 * 60 * 24);
  return Math.max(0, Math.ceil(TRIAL_DAYS - diasDesdeCreacao));
}
