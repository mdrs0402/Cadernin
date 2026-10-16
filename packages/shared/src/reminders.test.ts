import { describe, expect, it } from 'vitest';
import { buildReminderMessage, dueWhen, firstName, reminderFacts, remindedOn, shortDate } from './reminders';
import type { DueItem } from './schemas';

const today = '2026-10-16'; // sexta-feira
const item = (dueDate: string, openCents: number, status: DueItem['status']): DueItem => ({
  purchaseId: `${dueDate}-${openCents}`,
  customerId: 'c1',
  customerName: 'Ana',
  description: 'Compra',
  dueDate,
  openCents,
  status,
});

describe('reminderFacts', () => {
  it('sem saldo, nada a lembrar', () => {
    expect(reminderFacts(0, [item('2026-10-10', 1000, 'overdue')])).toBeNull();
  });

  it('vencido tem prioridade: soma tudo que venceu e destaca o mais antigo', () => {
    const due = [item('2026-10-12', 2000, 'overdue'), item('2026-10-05', 1500, 'overdue'), item('2026-10-18', 999, 'soon')];
    expect(reminderFacts(9000, due)).toEqual({ kind: 'overdue', amountCents: 3500, dueDate: '2026-10-05' });
  });

  it('vence em breve: destaca o primeiro vencimento e soma o que vence no mesmo dia', () => {
    const due = [item('2026-10-20', 500, 'soon'), item('2026-10-17', 1000, 'soon'), item('2026-10-17', 300, 'soon')];
    expect(reminderFacts(5000, due)).toEqual({ kind: 'due_soon', amountCents: 1300, dueDate: '2026-10-17' });
  });

  it('vence hoje conta como "em breve"', () => {
    expect(reminderFacts(1000, [item(today, 1000, 'today')])?.kind).toBe('due_soon');
  });

  it('só saldo, sem vencimento próximo', () => {
    expect(reminderFacts(4200, [item('2026-12-01', 4200, 'later')])).toEqual({ kind: 'balance', amountCents: 4200, dueDate: null });
    expect(reminderFacts(4200, [])).toEqual({ kind: 'balance', amountCents: 4200, dueDate: null });
  });
});

describe('textos de data', () => {
  it('formata vencimento relativo', () => {
    expect(dueWhen(today, today)).toBe('hoje');
    expect(dueWhen('2026-10-17', today)).toBe('amanhã');
    expect(dueWhen('2026-10-23', today)).toBe('sexta, 23/10');
    expect(dueWhen('2026-10-19', today)).toBe('segunda, 19/10');
  });

  it('dd/mm e primeiro nome', () => {
    expect(shortDate('2026-01-05')).toBe('05/01');
    expect(firstName('  Ana Maria Souza ')).toBe('Ana');
  });

  it('1 lembrete por dia', () => {
    expect(remindedOn(today, today)).toBe(true);
    expect(remindedOn('2026-10-15', today)).toBe(false);
    expect(remindedOn(null, today)).toBe(false);
  });
});

describe('buildReminderMessage', () => {
  const base = { storeName: 'Padaria Pão Quente', customerName: 'Ana Maria', today };

  it('vencido, com o total quando há mais saldo', () => {
    const text = buildReminderMessage({ ...base, kind: 'overdue', amountCents: 2000, dueDate: '2026-10-11', balanceDue: 9000 });
    expect(text).toBe(
      'Olá, Ana! Aqui é da Padaria Pão Quente. Passando para lembrar que R$ 20,00 da sua conta venceu em 11/10. ' +
        'Seu saldo total no caderno é R$ 90,00. Quando puder, passe aqui para acertar. Qualquer dúvida, é só chamar. Obrigado!',
    );
  });

  it('vencido sem repetir o total quando é tudo', () => {
    const text = buildReminderMessage({ ...base, kind: 'overdue', amountCents: 2000, dueDate: '2026-10-11', balanceDue: 2000 });
    expect(text).not.toContain('saldo total');
  });

  it('vence em breve', () => {
    const text = buildReminderMessage({ ...base, kind: 'due_soon', amountCents: 5000, dueDate: '2026-10-17', balanceDue: 5000 });
    expect(text).toBe(
      'Olá, Ana! Aqui é da Padaria Pão Quente. Lembrete: R$ 50,00 da sua conta vence amanhã. Qualquer dúvida, é só chamar. Obrigado!',
    );
  });

  it('só saldo', () => {
    const text = buildReminderMessage({ ...base, kind: 'balance', amountCents: 1234, dueDate: null, balanceDue: 1234 });
    expect(text).toContain('sua conta no caderno está em R$ 12,34');
  });

  it('cabe numa mensagem curta', () => {
    const text = buildReminderMessage({
      ...base,
      storeName: 'Mercadinho do Bairro Jardim das Flores',
      kind: 'overdue',
      amountCents: 123456,
      dueDate: '2026-10-01',
      balanceDue: 999999,
    });
    expect(text.length).toBeLessThan(320);
  });
});
