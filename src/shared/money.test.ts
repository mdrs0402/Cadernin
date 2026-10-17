import { describe, expect, it } from 'vitest';
import { formatCents, maskCentsInput, parseBRLToCents } from './money';

describe('parseBRLToCents', () => {
  it.each([
    ['12', 1200],
    ['12,5', 1250],
    ['12,50', 1250],
    ['0,99', 99],
    ['1.234,56', 123456],
    ['R$ 1.234,56', 123456],
    ['1234.56', 123456],
    ['1.234', 123400],
    ['  7,00 ', 700],
  ])('"%s" -> %i', (input, expected) => {
    expect(parseBRLToCents(input)).toBe(expected);
  });

  it('não sofre com imprecisão de float', () => {
    // 0.1 + 0.2 em float dá 0.30000000000000004
    expect(parseBRLToCents('0,1')! + parseBRLToCents('0,2')!).toBe(30);
    expect(parseBRLToCents('19,99')).toBe(1999);
  });

  it.each(['', 'abc', '-5', '1,234', '12,345', '1.23,45', '1e3'])('rejeita "%s"', (input) => {
    expect(parseBRLToCents(input)).toBeNull();
  });
});

describe('formatCents', () => {
  it('formata em reais', () => {
    expect(formatCents(123456)).toBe('R$ 1.234,56');
    expect(formatCents(5)).toBe('R$ 0,05');
    expect(formatCents(0)).toBe('R$ 0,00');
  });
});

describe('maskCentsInput', () => {
  it('empurra dígitos da direita, como maquininha', () => {
    expect(maskCentsInput('1')).toEqual({ cents: 1, text: '0,01' });
    expect(maskCentsInput('1234')).toEqual({ cents: 1234, text: '12,34' });
    expect(maskCentsInput('R$ 1.500,00')).toEqual({ cents: 150000, text: '1.500,00' });
    expect(maskCentsInput('')).toEqual({ cents: 0, text: '0,00' });
  });
});
