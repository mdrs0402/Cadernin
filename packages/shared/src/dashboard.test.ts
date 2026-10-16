import { describe, expect, it } from 'vitest';
import { accountSummary, addDays, dayKeyInZone, daysBetween, dueItems, dueStatus, monthStart, openPurchases } from './dashboard';
import type { Transaction } from './schemas';

describe('datas no fuso da loja', () => {
  it('usa o dia de São Paulo, não o de UTC', () => {
    // 02:30 UTC do dia 16 ainda é 23:30 do dia 15 em São Paulo
    expect(dayKeyInZone(new Date('2026-10-16T02:30:00Z'))).toBe('2026-10-15');
    expect(dayKeyInZone(new Date('2026-10-16T03:30:00Z'))).toBe('2026-10-16');
  });

  it('soma dias atravessando mês e ano', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
  });

  it('início do mês e diferença em dias', () => {
    expect(monthStart('2026-10-16')).toBe('2026-10-01');
    expect(daysBetween('2026-10-16', '2026-10-23')).toBe(7);
    expect(daysBetween('2026-10-16', '2026-10-10')).toBe(-6);
  });
});

describe('dueStatus', () => {
  const today = '2026-10-16';
  it('classifica vencimentos', () => {
    expect(dueStatus('2026-10-15', today)).toBe('overdue');
    expect(dueStatus('2026-10-16', today)).toBe('today');
    expect(dueStatus('2026-10-23', today)).toBe('soon');
    expect(dueStatus('2026-10-24', today)).toBe('later');
  });
});

describe('openPurchases', () => {
  const p = (id: string, amountCents: number, reversed = false) => ({ id, amountCents, reversed });

  it('sem dívida, nada em aberto', () => {
    expect(openPurchases(0, [p('a', 1000)])).toEqual([]);
  });

  it('o saldo fica nas compras mais recentes (pagamentos quitam as antigas)', () => {
    // compras: c (mais nova) 30, b 50, a 100; pagou 120 -> deve 60
    const open = openPurchases(6000, [p('c', 3000), p('b', 5000), p('a', 10000)]);
    expect(open.map((o) => [o.id, o.openCents])).toEqual([
      ['c', 3000],
      ['b', 3000],
    ]);
  });

  it('ignora compras estornadas', () => {
    const open = openPurchases(4000, [p('x', 9000, true), p('b', 2500), p('a', 2500)]);
    expect(open.map((o) => [o.id, o.openCents])).toEqual([
      ['b', 2500],
      ['a', 1500],
    ]);
  });

  it('nunca distribui mais que o valor de cada compra', () => {
    const open = openPurchases(99999, [p('a', 1000)]);
    expect(open).toEqual([{ id: 'a', amountCents: 1000, reversed: false, openCents: 1000 }]);
  });
});

describe('dueItems e accountSummary', () => {
  // "agora" = 16/10/2026 12:00 em São Paulo
  const now = new Date('2026-10-16T15:00:00Z');
  let n = 0;
  const tx = (type: Transaction['type'], amountCents: number, createdAt: string, extra: Partial<Transaction> = {}): Transaction => ({
    id: `t${++n}`,
    customerId: 'c1',
    type,
    amountCents,
    description: type,
    dueDate: null,
    createdAt,
    reversesId: null,
    reversedById: null,
    reversesType: null,
    ...extra,
  });

  // mais recente primeiro (como vem da API)
  const history: Transaction[] = [
    tx('payment', 8000, '2026-10-16T14:00:00Z'),
    tx('purchase', 2000, '2026-10-16T13:00:00Z'), // hoje, sem vencimento
    tx('purchase', 5000, '2026-10-14T15:00:00Z', { dueDate: '2026-10-19' }), // vence em 3 dias
    tx('purchase', 3000, '2026-10-12T15:00:00Z', { dueDate: '2026-10-13', reversedById: 'x' }), // estornada
    tx('purchase', 10000, '2026-09-28T15:00:00Z', { dueDate: '2026-10-11' }), // venceu há 5 dias (mês passado)
  ];
  // compras válidas 170 - pago 80 = deve 90 -> 20 (hoje) + 50 (bolo) + 20 da antiga

  it('o saldo cai nas compras mais recentes; só entram as que têm vencimento', () => {
    const due = dueItems({ id: 'c1', name: 'Ana', balanceDue: 9000 }, history, '2026-10-16');
    expect(due.map((d) => [d.dueDate, d.openCents, d.status])).toEqual([
      ['2026-10-19', 5000, 'soon'],
      ['2026-10-11', 2000, 'overdue'],
    ]);
  });

  it('resumo do cliente: vencido, próximo vencimento e compras do mês (sem estornadas)', () => {
    expect(accountSummary({ customerId: 'c1', name: 'Ana', balanceDue: 9000 }, history, now)).toEqual({
      overdueCents: 2000,
      nextDue: { dueDate: '2026-10-19', openCents: 5000 },
      monthPurchasesCents: 7000,
    });
  });

  it('quitado: nada vencido nem a vencer', () => {
    expect(accountSummary({ customerId: 'c1', name: 'Ana', balanceDue: 0 }, history, now)).toMatchObject({
      overdueCents: 0,
      nextDue: null,
    });
  });
});
