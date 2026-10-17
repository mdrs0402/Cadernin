/** Erros do login Google que o usuário mesmo causou (fechou a janela etc.): não mostram nada. */
const SILENT = new Set(['auth/popup-closed-by-user', 'auth/cancelled-popup-request', 'auth/user-cancelled']);

/**
 * Traduz o erro do Firebase Auth numa mensagem clara. Sempre leva o código junto,
 * para dar para saber exatamente o que aconteceu (antes tudo virava "verifique sua conexão").
 */
export function loginErrorMessage(err: unknown): string | null {
  const code = (err as { code?: string } | null)?.code ?? 'desconhecido';
  if (SILENT.has(code)) return null;

  const host = typeof window !== 'undefined' ? window.location.hostname : 'este site';
  const messages: Record<string, string> = {
    'auth/popup-blocked': 'O navegador bloqueou a janela do Google. Permita pop-ups para este site e tente de novo.',
    'auth/unauthorized-domain': `O endereço "${host}" não está autorizado no Firebase. No Console do Firebase: Authentication → Configurações → Domínios autorizados → adicione "${host}".`,
    'auth/operation-not-allowed': 'O login com Google não está ativado no Firebase (Authentication → Método de login → Google).',
    'auth/invalid-api-key': 'A configuração do Firebase está errada (VITE_FIREBASE_API_KEY). Confira as variáveis e faça um novo deploy.',
    'auth/api-key-not-valid.-please-pass-a-valid-api-key.': 'A configuração do Firebase está errada (VITE_FIREBASE_API_KEY). Confira as variáveis e faça um novo deploy.',
    'auth/configuration-not-found': 'O Firebase Authentication não está configurado neste projeto. Ative-o no Console do Firebase.',
    'auth/network-request-failed': 'Sem conexão com o Google. Verifique sua internet e tente de novo.',
    'auth/too-many-requests': 'Muitas tentativas seguidas. Espere um pouco e tente de novo.',
    'auth/user-disabled': 'Esta conta foi desativada.',
    'auth/web-storage-unsupported': 'Este navegador está bloqueando o armazenamento local (modo anônimo ou cookies bloqueados). Libere e tente de novo.',
    'auth/internal-error': 'O Google recusou o login. Confira se o domínio está autorizado e se as variáveis do Firebase estão certas.',
  };
  const text = messages[code] ?? 'Não foi possível entrar com o Google.';
  return `${text} (código: ${code})`;
}
