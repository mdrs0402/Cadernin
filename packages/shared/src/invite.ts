/** Sem 0/O, 1/I/L para evitar confusão ao ditar ou digitar. */
export const INVITE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const INVITE_LENGTH = 6;

export function normalizeInviteCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function isValidInviteCode(code: string): boolean {
  return code.length === INVITE_LENGTH && [...code].every((c) => INVITE_ALPHABET.includes(c));
}

/** "K7MQ2P" -> "K7M-Q2P" para exibição. */
export function formatInviteCode(code: string): string {
  return code.length === INVITE_LENGTH ? `${code.slice(0, 3)}-${code.slice(3)}` : code;
}
