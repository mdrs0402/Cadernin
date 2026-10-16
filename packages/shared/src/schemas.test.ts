import { describe, expect, it } from 'vitest';
import { customerInputSchema, newTransactionSchema, reversalInputSchema, sendRemindersSchema } from './schemas';

describe('newTransactionSchema', () => {
  it('compra exige descrição e aceita vencimento opcional', () => {
    expect(newTransactionSchema.parse({ type: 'purchase', amountCents: 1500, description: '  Pão e leite ' })).toEqual({
      type: 'purchase',
      amountCents: 1500,
      description: 'Pão e leite',
      dueDate: null,
    });
    expect(newTransactionSchema.parse({ type: 'purchase', amountCents: 1, description: 'Bala', dueDate: '2026-10-30' })).toMatchObject({
      dueDate: '2026-10-30',
    });

    const noDesc = newTransactionSchema.safeParse({ type: 'purchase', amountCents: 1500, description: ' ' });
    expect(noDesc.success).toBe(false);
    expect(noDesc.error?.issues[0]?.message).toBe('Diga o que foi comprado.');
  });

  it('pagamento sem observação vira "Pagamento"', () => {
    expect(newTransactionSchema.parse({ type: 'payment', amountCents: 800 })).toEqual({
      type: 'payment',
      amountCents: 800,
      description: 'Pagamento',
    });
  });

  it.each([
    ['zero', { type: 'purchase', amountCents: 0, description: 'Pão' }],
    ['negativo', { type: 'payment', amountCents: -100 }],
    ['centavo quebrado', { type: 'payment', amountCents: 10.5 }],
    ['texto no valor', { type: 'payment', amountCents: '10' }],
    ['data inválida', { type: 'purchase', amountCents: 100, description: 'Pão', dueDate: '30/10/2026' }],
    ['tipo desconhecido', { type: 'gift', amountCents: 100 }],
    ['estorno por aqui', { type: 'reversal', amountCents: 100 }],
  ])('recusa %s', (_label, input) => {
    expect(newTransactionSchema.safeParse(input).success).toBe(false);
  });
});

describe('outros schemas', () => {
  it('estorno: motivo opcional e limitado', () => {
    expect(reversalInputSchema.parse({})).toEqual({});
    expect(reversalInputSchema.safeParse({ reason: 'x'.repeat(201) }).success).toBe(false);
  });

  it('lembretes: lista opcional, mas nunca vazia', () => {
    expect(sendRemindersSchema.parse({})).toEqual({});
    expect(sendRemindersSchema.parse({ customerIds: ['a', 'b'] }).customerIds).toEqual(['a', 'b']);
    expect(sendRemindersSchema.safeParse({ customerIds: [] }).success).toBe(false);
    expect(sendRemindersSchema.safeParse({ customerIds: [''] }).success).toBe(false);
  });

  it('cliente: normaliza telefone e valida limite', () => {
    expect(customerInputSchema.parse({ name: 'Ana', phone: '(11) 98765-4321', creditLimit: 20000 }).phone).toBe('11987654321');
    expect(customerInputSchema.safeParse({ name: 'Ana', phone: '123', creditLimit: 20000 }).success).toBe(false);
    expect(customerInputSchema.safeParse({ name: 'Ana', phone: '11987654321', creditLimit: -1 }).success).toBe(false);
  });
});
