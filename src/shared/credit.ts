import type { Cents } from './money';

/** Limite disponível. Nunca negativo (o lojista pode baixar o limite abaixo do saldo devedor). */
export function availableCredit(creditLimit: Cents, balanceDue: Cents): Cents {
  return Math.max(0, creditLimit - balanceDue);
}

/** Percentual do limite já usado, de 0 a 100 (para barras de progresso). */
export function creditUsagePercent(creditLimit: Cents, balanceDue: Cents): number {
  if (creditLimit <= 0) return balanceDue > 0 ? 100 : 0;
  return Math.min(100, Math.round((balanceDue / creditLimit) * 100));
}
