import { INVITE_ALPHABET, INVITE_LENGTH } from '@cadernin/shared';
import type { Transaction } from 'firebase/firestore';
import { inviteRef } from './refs';

/** Código aleatório com crypto (sem viés: descarta bytes fora do múltiplo do alfabeto). */
function randomCode(): string {
  const n = INVITE_ALPHABET.length;
  const max = Math.floor(256 / n) * n;
  let code = '';
  while (code.length < INVITE_LENGTH) {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    for (const b of bytes) {
      if (b < max && code.length < INVITE_LENGTH) code += INVITE_ALPHABET[b % n];
    }
  }
  return code;
}

/**
 * Reserva um código livre dentro da transação (31^6 ≈ 887 milhões de combinações; colisão é rara,
 * mas tratada). Leituras precisam vir antes das escritas na transação.
 */
export async function reserveInviteCode(tx: Transaction): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomCode();
    const snap = await tx.get(inviteRef(code));
    if (!snap.exists()) return code;
  }
  throw new Error('Não foi possível gerar um código de convite único.');
}
