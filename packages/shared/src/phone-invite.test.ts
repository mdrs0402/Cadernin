import { describe, expect, it } from 'vitest';
import { formatInviteCode, isValidInviteCode, normalizeInviteCode } from './invite';
import { formatPhone, isValidBRPhone, normalizePhone } from './phone';
import { customerInputSchema } from './schemas';

describe('telefone', () => {
  it('normaliza e valida celular e fixo', () => {
    expect(normalizePhone('+55 (11) 98765-4321')).toBe('11987654321');
    expect(isValidBRPhone('11987654321')).toBe(true);
    expect(isValidBRPhone('1133334444')).toBe(true);
    expect(isValidBRPhone('11887654321')).toBe(false); // celular sem o 9
    expect(isValidBRPhone('0187654321')).toBe(false); // DDD inválido
    expect(isValidBRPhone('987654321')).toBe(false);
  });

  it('formata enquanto digita', () => {
    expect(formatPhone('11')).toBe('(11');
    expect(formatPhone('119876')).toBe('(11) 9876');
    expect(formatPhone('11987654321')).toBe('(11) 98765-4321');
    expect(formatPhone('1133334444')).toBe('(11) 3333-4444');
  });
});

describe('código de convite', () => {
  it('normaliza e valida', () => {
    expect(normalizeInviteCode('k7m-q2p')).toBe('K7MQ2P');
    expect(isValidInviteCode('K7MQ2P')).toBe(true);
    expect(isValidInviteCode('K7MQ2O')).toBe(false); // O não faz parte do alfabeto
    expect(isValidInviteCode('K7MQ2')).toBe(false);
    expect(formatInviteCode('K7MQ2P')).toBe('K7M-Q2P');
  });
});

describe('customerInputSchema', () => {
  it('aceita e normaliza', () => {
    const r = customerInputSchema.parse({ name: '  Seu João ', phone: '(11) 98765-4321', creditLimit: 20000 });
    expect(r).toEqual({ name: 'Seu João', phone: '11987654321', creditLimit: 20000 });
  });

  it('recusa limite com centavos quebrados ou negativo', () => {
    expect(customerInputSchema.safeParse({ name: 'Ana', phone: '11987654321', creditLimit: 10.5 }).success).toBe(false);
    expect(customerInputSchema.safeParse({ name: 'Ana', phone: '11987654321', creditLimit: -1 }).success).toBe(false);
  });
});
