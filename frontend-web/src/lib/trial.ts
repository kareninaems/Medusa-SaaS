export function isTrialAtivo(createdAt: string): boolean {
  const agora = new Date();
  const criacao = new Date(createdAt);
  const diferencaEmMs = agora.getTime() - criacao.getTime();
  const dias = diferencaEmMs / (1000 * 60 * 60 * 24);
  return dias <= 7;
}

export function diasRestantes(createdAt: string): number {
  const agora = new Date();
  const criacao = new Date(createdAt);
  const diferencaEmMs = agora.getTime() - criacao.getTime();
  const diasPassados = diferencaEmMs / (1000 * 60 * 60 * 24);
  return Math.ceil(7 - diasPassados);
}
