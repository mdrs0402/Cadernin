import { describe, expect, it } from 'vitest';
import { dayLabel, formatDateOnly, localDayKey, relativeDue, weekdayOf } from './dates';

describe('datas na tela', () => {
  it('vencimento relativo', () => {
    const today = '2026-10-16';
    expect(relativeDue('2026-10-16', today)).toBe('vence hoje');
    expect(relativeDue('2026-10-17', today)).toBe('vence amanhã');
    expect(relativeDue('2026-10-15', today)).toBe('venceu ontem');
    expect(relativeDue('2026-10-11', today)).toBe('venceu há 5 dias');
    expect(relativeDue('2026-10-23', today)).toBe('vence em 7 dias');
    expect(relativeDue('2026-11-01', '2026-10-31')).toBe('vence amanhã');
  });

  it('data sem hora não desloca pelo fuso', () => {
    expect(formatDateOnly('2026-01-01')).toBe('01/01/2026');
    expect(weekdayOf('2026-10-16')).toBe('sex');
  });

  it('rótulo do dia', () => {
    const now = new Date(2026, 9, 16, 10, 0);
    expect(dayLabel(new Date(2026, 9, 16, 8, 0), now)).toBe('Hoje');
    expect(dayLabel(new Date(2026, 9, 15, 23, 59), now)).toBe('Ontem');
    expect(dayLabel(new Date(2026, 9, 14, 12, 0), now)).toBe('Quarta-feira, 14 de outubro');
    expect(dayLabel(new Date(2025, 11, 31, 12, 0), now)).toBe('31 de dezembro de 2025');
    expect(localDayKey(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});
