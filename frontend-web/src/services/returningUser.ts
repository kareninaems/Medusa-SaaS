// Lembra, neste navegador, que a pessoa ja entrou com uma conta.
// Serve apenas para levar quem ja tem conta direto ao login em vez da pagina inicial.

const HAS_ACCOUNT_KEY = "medusa_has_account_v1";

export function markHasAccount(): void {
  try {
    window.localStorage.setItem(HAS_ACCOUNT_KEY, "1");
  } catch {
    // armazenamento indisponivel: segue sem o atalho
  }
}

export function hasAccountFlag(): boolean {
  try {
    return window.localStorage.getItem(HAS_ACCOUNT_KEY) === "1";
  } catch {
    return false;
  }
}
