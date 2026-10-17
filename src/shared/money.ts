/**
 * Dinheiro é SEMPRE inteiro em centavos. Nada de float para valores.
 */
export type Cents = number;

export const MAX_CENTS = 100_000_000_00; // R$ 100 milhões: teto de sanidade

export function isValidCents(value: unknown): value is Cents {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= MAX_CENTS;
}

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

/** 123456 -> "R$ 1.234,56" */
export function formatCents(cents: Cents): string {
  // Intl usa espaço não separável; normaliza para espaço comum (mais previsível em testes e textos).
  return brl.format(cents / 100).replace(/ /g, ' ');
}

/**
 * Converte texto digitado em reais para centavos, sem passar por float.
 * Aceita "12", "12,5", "12,50", "1.234,56", "R$ 1.234,56", "1234.56".
 * Retorna null se o texto não for um valor válido.
 */
export function parseBRLToCents(input: string): Cents | null {
  let s = input.trim().replace(/^R\$\s*/i, '').replace(/\s/g, '');
  if (!s) return null;

  if (s.includes(',')) {
    // formato brasileiro: ponto = milhar, vírgula = decimal
    if (!/^\d{1,3}(\.\d{3})*(,\d{0,2})?$|^\d+(,\d{0,2})?$/.test(s)) return null;
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
    // "1.234" sem vírgula: ponto como milhar
    s = s.replace(/\./g, '');
  } else if (!/^\d+(\.\d{0,2})?$/.test(s)) {
    return null;
  }

  const [intPart = '0', decPart = ''] = s.split('.');
  const cents = Number(intPart) * 100 + Number(decPart.padEnd(2, '0'));
  return isValidCents(cents) ? cents : null;
}

/** Máscara de digitação: cada dígito empurra da direita (como maquininha). "1234" -> "12,34" */
export function maskCentsInput(raw: string): { cents: Cents; text: string } {
  const digits = raw.replace(/\D/g, '').replace(/^0+/, '').slice(0, 12);
  const cents = Number(digits || '0');
  const text = (cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return { cents, text };
}
