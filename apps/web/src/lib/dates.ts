const dayFmt = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
const dayYearFmt = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
const timeFmt = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });
const shortFmt = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

/** Chave do dia no fuso local (AAAA-MM-DD). */
export function localDayKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** "Hoje", "Ontem", "quinta-feira, 9 de outubro" ou "9 de outubro de 2025". */
export function dayLabel(d: Date, now = new Date()) {
  const today = localDayKey(now);
  const y = new Date(now);
  y.setDate(now.getDate() - 1);
  const key = localDayKey(d);
  if (key === today) return 'Hoje';
  if (key === localDayKey(y)) return 'Ontem';
  const label = d.getFullYear() === now.getFullYear() ? dayFmt.format(d) : dayYearFmt.format(d);
  return label[0]!.toUpperCase() + label.slice(1);
}

export const formatTime = (d: Date) => timeFmt.format(d);

/** "AAAA-MM-DD" (data sem hora) -> "09/10/2025", sem deslocar pelo fuso. */
export function formatDateOnly(ymd: string) {
  const [y, m, d] = ymd.split('-').map(Number);
  return shortFmt.format(new Date(y!, m! - 1, d!));
}

export function isPastDateOnly(ymd: string, now = new Date()) {
  return ymd < localDayKey(now);
}

/** "venceu há 3 dias", "vence hoje", "vence amanhã", "vence em 5 dias". `today` e `due` em AAAA-MM-DD. */
export function relativeDue(due: string, today: string) {
  const diff = Math.round((Date.parse(`${due}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
  if (diff === 0) return 'vence hoje';
  if (diff === 1) return 'vence amanhã';
  if (diff === -1) return 'venceu ontem';
  return diff < 0 ? `venceu há ${-diff} dias` : `vence em ${diff} dias`;
}

const weekdayShort = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', timeZone: 'UTC' });
/** "seg", "ter"… de uma data AAAA-MM-DD. */
export const weekdayOf = (ymd: string) => weekdayShort.format(new Date(`${ymd}T12:00:00Z`)).replace('.', '');
