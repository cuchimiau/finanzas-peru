// Fechas reales (hora local del teléfono). Todo lo que depende del "hoy" pasa por aquí.

const MON = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const DOW = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const DOW_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
export const MONTH_LONG = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

export const daysInMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();

/** "2026-10" — clave del mes calendario en hora local. */
export const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
export const monthKeyOf = (iso: string) => monthKey(new Date(iso));
export const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

export interface MonthCtx {
  now: Date;
  key: string;
  /** Días que quedan contando hoy (nunca 0). */
  daysLeft: number;
  /** Fracción del mes recorrida (hoy incluido). */
  pct: number;
  pctL: string;
  name: string;
  todayL: string;
  longL: string;
}

export function monthCtx(now = new Date()): MonthCtx {
  const dim = daysInMonth(now), day = now.getDate();
  const pct = day / dim;
  return {
    now, key: monthKey(now), daysLeft: dim - day + 1, pct, pctL: Math.round(pct * 100) + '%',
    name: MONTH_LONG[now.getMonth()],
    todayL: `${DOW[now.getDay()]} ${day} de ${MONTH_LONG[now.getMonth()]}`,
    longL: `${DOW[now.getDay()].toLowerCase()} ${day} de ${MONTH_LONG[now.getMonth()]} de ${now.getFullYear()}`,
  };
}

/** "nov 2026" para n meses después del mes de `from`. */
export const monthAt = (n: number, from = new Date()) => {
  const i = from.getMonth() + n;
  return MON[((i % 12) + 12) % 12] + ' ' + (from.getFullYear() + Math.floor(i / 12));
};

/** Abreviatura del mes de una clave "2026-10" → "oct". */
export const monthShort = (key: string) => MON[Number(key.slice(5, 7)) - 1];

/** Las últimas n claves de mes terminando en el mes actual. */
export function lastMonthKeys(n: number, now = new Date()): string[] {
  return Array.from({ length: n }, (_, i) => monthKey(new Date(now.getFullYear(), now.getMonth() - (n - 1 - i), 1)));
}

const time = (d: Date) => {
  const h = d.getHours(), m = String(d.getMinutes()).padStart(2, '0');
  return `${h % 12 || 12}:${m} ${h < 12 ? 'a. m.' : 'p. m.'}`;
};

/** Etiqueta de un movimiento: "Hoy · 1:12 p. m.", "Ayer", "Sáb 10" o "10 oct". */
export function whenLabel(iso: string, now = new Date()): string {
  const d = new Date(iso);
  if (sameDay(d, now)) return 'Hoy · ' + time(d);
  const y = new Date(now); y.setDate(now.getDate() - 1);
  if (sameDay(d, y)) return 'Ayer';
  const diff = (now.getTime() - d.getTime()) / 86400000;
  if (diff > 0 && diff < 6) return `${DOW_SHORT[d.getDay()]} ${d.getDate()}`;
  return `${d.getDate()} ${MON[d.getMonth()]}` + (d.getFullYear() !== now.getFullYear() ? ' ' + d.getFullYear() : '');
}

/** Próxima fecha de pago para un día del mes (si ya pasó este mes, el siguiente): "5 nov". */
export function nextDueLabel(dueDay: number, now = new Date()): string {
  const day = Math.min(Math.max(1, Math.round(dueDay) || 1), 31);
  let d = new Date(now.getFullYear(), now.getMonth(), Math.min(day, daysInMonth(now)));
  if (d.getDate() < now.getDate()) {
    const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    d = new Date(next.getFullYear(), next.getMonth(), Math.min(day, daysInMonth(next)));
  }
  return `${d.getDate()} ${MON[d.getMonth()]}`;
}

/** Hace cuánto: "hace 2 min", "hace 3 h", "ayer". */
export function agoLabel(ts: number, now = Date.now()): string {
  const s = Math.max(0, (now - ts) / 1000);
  if (s < 45) return 'hace un momento';
  if (s < 3600) return `hace ${Math.round(s / 60)} min`;
  if (s < 86400) return `hace ${Math.round(s / 3600)} h`;
  return s < 172800 ? 'ayer' : `hace ${Math.round(s / 86400)} días`;
}
