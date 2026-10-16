import { describe, expect, it } from 'vitest';
import { availableCredit, creditUsagePercent } from './credit';

describe('availableCredit', () => {
  it('limite menos saldo devedor', () => {
    expect(availableCredit(20000, 7550)).toBe(12450);
    expect(availableCredit(20000, 0)).toBe(20000);
  });

  it('nunca fica negativo quando o limite foi reduzido abaixo do saldo', () => {
    expect(availableCredit(5000, 8000)).toBe(0);
  });
});

describe('creditUsagePercent', () => {
  it('calcula e limita entre 0 e 100', () => {
    expect(creditUsagePercent(20000, 5000)).toBe(25);
    expect(creditUsagePercent(20000, 40000)).toBe(100);
    expect(creditUsagePercent(0, 0)).toBe(0);
    expect(creditUsagePercent(0, 100)).toBe(100);
  });
});
