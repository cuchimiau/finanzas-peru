// Dinero real del mes: lo que de verdad tienes, sin suponer que ya te pagaron.
import { FOLDERS, type Budgets, type Card, type FolderId, type Income, type Tx } from './data';
import { daysInMonth, monthCtx, monthKeyOf } from './dates';

/** Carpetas de gasto variable (el resto de necesidades se consideran pagos fijos por reservar). */
export const FLEX_IDS: FolderId[] = ['mercado', 'transporte', 'restaurantes', 'ocio', 'libre'];

/** Lo que escribiste al empezar el mes. `opening: null` = aún no lo dijiste (la app no lo inventa). */
export interface CashMonth {
  key: string;
  opening: number | null;
  /** Desde cuándo cuentan los gastos (lo anterior ya está dentro de `opening`). */
  openedAt: string;
  /**
   * Sueldo de este mes ya recibido (monto real y fecha), o null si aún no llega.
   * `inOpening`: ya estaba dentro del monto inicial que escribiste (no se suma dos veces).
   */
  salary: { amt: number; date: string; inOpening?: boolean } | null;
  /** Pagos fijos (carpetas de necesidades) que dijiste que aún debes pagar con este dinero antes del sueldo. */
  reserve?: FolderId[];
}

export const emptyCash = (key: string, now = new Date()): CashMonth => ({ key, opening: null, openedAt: now.toISOString(), salary: null });

export interface Reserved { id: string; name: string; amt: number }

export interface RealMoney {
  /** false hasta que escribas cuánto tienes: entonces no hay número que mostrar. */
  known: boolean;
  opening: number;
  salaryIn: number;
  extraIn: number;
  /** Todo lo que entró: inicial + sueldo recibido + ingresos extra. */
  total: number;
  spent: number;
  /** Gasto desde que empezaste, por carpeta ('' = sin carpeta). */
  byFolder: Record<string, number>;
  /** Lo que tienes ahora. */
  real: number;
  salaryPending: boolean;
  payday: number | null;
  /** Días (contando hoy) hasta el día antes del pago, o hasta fin de mes si ya cobraste. */
  days: number;
  reserved: Reserved[];
  reservedTotal: number;
  /** Lo que puedes usar sin tocar lo reservado. */
  free: number;
  perDay: number;
}

const after = (iso: string, from: string) => new Date(iso).getTime() >= new Date(from).getTime();

/**
 * Lo que tienes y cuánto puedes gastar por día.
 * - Antes del sueldo: (dinero real − pagos fijos sin pagar − cuotas que vencen antes del pago) ÷ días hasta el pago.
 * - Después: lo mismo hasta fin de mes, pero nunca más de lo libre en tus carpetas de gasto (`flexLeft`).
 */
export function realMoney(o: {
  cash: CashMonth; txs: Tx[]; incomes: Income[]; budgets: Budgets; cards: Card[];
  payday: number | null; flexLeft: number; now?: Date;
}): RealMoney {
  const now = o.now ?? new Date();
  const m = monthCtx(now);
  const day = now.getDate();
  const known = o.cash.opening !== null && o.cash.key === m.key;
  const opening = known ? o.cash.opening! : 0;
  const salaryIn = known && o.cash.salary && !o.cash.salary.inOpening ? o.cash.salary.amt : 0;
  const since = o.cash.openedAt;
  const counted = o.txs.filter(t => t.amt > 0 && after(t.date, since) && monthKeyOf(t.date) === m.key);
  const spent = known ? counted.reduce((a, t) => a + t.amt, 0) : 0;
  const byFolder: Record<string, number> = {};
  if (known) counted.forEach(t => { const k = t.f ?? ''; byFolder[k] = (byFolder[k] || 0) + t.amt; });
  const extraIn = known ? o.incomes.filter(i => after(i.date, since) && monthKeyOf(i.date) === m.key).reduce((a, i) => a + i.amt, 0) : 0;
  const total = opening + salaryIn + extraIn;
  const real = total - spent;
  const salaryPending = known && !o.cash.salary;
  const payday = o.payday && o.payday >= 1 && o.payday <= 31 ? Math.min(o.payday, daysInMonth(now)) : null;
  const beforePay = salaryPending && payday !== null && payday > day;
  const days = beforePay ? payday! - day : m.daysLeft;

  // Pagos fijos del mes aún sin pagar (alquiler, servicios, salud, carpetas propias de necesidades).
  const spentIn = (id: FolderId) => o.txs.filter(t => t.f === id && monthKeyOf(t.date) === m.key).reduce((a, t) => a + t.amt, 0);
  // Antes del sueldo solo se reserva lo que marcaste; después, todos los fijos del plan que falten.
  const fixedIds = (id: FolderId) => (beforePay || salaryPending ? (o.cash.reserve ?? []).includes(id) : true);
  const reserved: Reserved[] = FOLDERS.filter(f => f.grp === 'nec' && !FLEX_IDS.includes(f.id) && fixedIds(f.id))
    .map(f => ({ id: f.id, name: f.name, amt: Math.max(0, (o.budgets[f.id] || 0) - spentIn(f.id)) }))
    .filter(r => r.amt > 0);
  // Cuotas: antes del sueldo solo las que vencen antes del pago; después, lo que falta del Pago de deudas.
  if (beforePay) {
    o.cards.filter(c => c.kind !== 'debit' && c.min > 0 && c.dueDay >= day && c.dueDay < payday!)
      .forEach(c => reserved.push({ id: 'card-' + c.id, name: 'Cuota ' + c.name, amt: c.min }));
  } else {
    const debtLeft = Math.max(0, (o.budgets.deudas || 0) - spentIn('deudas'));
    if (debtLeft > 0) reserved.push({ id: 'deudas', name: 'Pago de deudas', amt: debtLeft });
  }
  const reservedTotal = reserved.reduce((a, r) => a + r.amt, 0);
  const free = Math.max(0, real - reservedTotal);
  const usable = beforePay || salaryPending ? free : Math.min(free, o.flexLeft);
  return {
    known, opening, salaryIn, extraIn, total, spent, byFolder, real, salaryPending, payday, days: Math.max(1, days),
    reserved, reservedTotal, free, perDay: known ? usable / Math.max(1, days) : 0,
  };
}
