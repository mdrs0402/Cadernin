/** Mantém só dígitos e remove o +55 se vier junto. "(11) 98765-4321" -> "11987654321" */
export function normalizePhone(input: string): string {
  let d = input.replace(/\D/g, '');
  if (d.length > 11 && d.startsWith('55')) d = d.slice(2);
  return d;
}

/** Celular (11 dígitos) ou fixo (10 dígitos) com DDD válido. */
export function isValidBRPhone(digits: string): boolean {
  return /^[1-9][1-9]\d{8,9}$/.test(digits) && (digits.length === 10 || digits[2] === '9');
}

/** "11987654321" -> "(11) 98765-4321". Também serve de máscara enquanto digita. */
export function formatPhone(input: string): string {
  const d = normalizePhone(input).slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : '';
  const ddd = d.slice(0, 2);
  const rest = d.slice(2);
  if (rest.length <= 4) return `(${ddd}) ${rest}`;
  const split = rest.length === 9 ? 5 : 4;
  return `(${ddd}) ${rest.slice(0, split)}-${rest.slice(split)}`;
}
