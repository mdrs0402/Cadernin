import { randomInt } from 'node:crypto';
import { INVITE_ALPHABET, INVITE_LENGTH } from '@cadernin/shared';
import type { Transaction } from 'firebase-admin/firestore';
import { db } from '../config/firebase';

export const invitesCol = () => db.collection('invites');

function randomCode() {
  let code = '';
  for (let i = 0; i < INVITE_LENGTH; i++) code += INVITE_ALPHABET[randomInt(INVITE_ALPHABET.length)];
  return code;
}

/**
 * Reserva um código livre dentro da transação (31^6 ≈ 887 milhões de combinações,
 * colisão é rara, mas tratada). Leituras precisam vir antes das escritas na transação.
 */
export async function reserveInviteCode(tx: Transaction): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomCode();
    const snap = await tx.get(invitesCol().doc(code));
    if (!snap.exists) return code;
  }
  throw new Error('Não foi possível gerar um código de convite único.');
}
