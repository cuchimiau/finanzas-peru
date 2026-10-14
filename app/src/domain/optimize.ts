// Optimización del mes: qué hacer con lo que queda de este mes y cómo armar el próximo.
import { FOLDERS, FM, type Budgets, type Debt, type FolderId, type Tx } from './data';
import { sumBudgets, type Take } from './plan';

const floor10 = (n: number) => Math.max(0, Math.floor(n / 10) * 10);
const ceil10 = (n: number) => Math.max(0, Math.ceil(Math.round(n * 100) / 1000) * 10);
const flowIds = () => FOLDERS.filter(f => f.grp === 'nec' || f.grp === 'des').map(f => f.id);

export function spentByFolder(monthTxs: Tx[]): Record<FolderId, number> {
  const out: Record<FolderId, number> = {};
  monthTxs.forEach(t => { if (t.f) out[t.f] = (out[t.f] || 0) + t.amt; });
  return out;
}

/** A dónde conviene mandar lo que sobra: deuda más cara → fondo de emergencia → inversión. */
export function savingsTarget(debts: Debt[], emergencyGap: number): { id: FolderId; why: string } {
  if (debts.length && FM.deudas) {
    const top = debts.slice().sort((a, b) => b.tcea - a.tcea)[0];
    return { id: 'deudas', why: top.tcea > 0 ? `adelantar ${top.name} (la de mayor interés, ${Math.round(top.tcea * 100)}%)` : `adelantar ${top.name}` };
  }
  if (emergencyGap > 0 || !FM.inversion) return { id: 'emergencia', why: 'tu fondo de emergencia' };
  return { id: 'inversion', why: 'tu inversión' };
}

export interface RestRow { id: FolderId; budget: number; spent: number; left: number; perDay: number; projected: number; risk: boolean; free: number }
export interface RestOfMonth { rows: RestRow[]; perDay: number; canSave: number; moves: Take[]; target: { id: FolderId; why: string }; risks: RestRow[] }

/**
 * Resto del mes: cuánto puedes gastar por día en cada carpeta, qué carpetas se van a pasar
 * y cuánto puedes ahorrar todavía de tus deseos (sin tocar necesidades).
 */
export function restOfMonth(b: Budgets, monthTxs: Tx[], monthPct: number, daysLeft: number, debts: Debt[], emergencyGap: number): RestOfMonth {
  const spent = spentByFolder(monthTxs);
  const pct = Math.min(1, Math.max(monthPct, 1 / 31));
  const rows: RestRow[] = flowIds().map(id => {
    const budget = b[id] || 0, sp = spent[id] || 0, left = budget - sp;
    const projected = sp / pct;
    // Lo que probablemente gastarás de aquí a fin de mes (si aún no gastas nada, se asume la mitad de lo que queda).
    const expectedRest = sp > 0 ? projected - sp : budget * (1 - pct) * 0.5;
    const isDesire = FM[id]?.grp === 'des';
    return {
      id, budget, spent: sp, left, perDay: Math.max(0, left) / Math.max(1, daysLeft), projected,
      risk: sp > 0 && projected > budget * 1.02 && id !== 'vivienda',
      free: isDesire ? floor10(left - Math.max(0, expectedRest)) : 0,
    };
  });
  const target = savingsTarget(debts, emergencyGap);
  const moves = rows.filter(r => r.free >= 10 && r.id !== target.id).map(r => ({ de: r.id, monto: r.free }));
  const flex = rows.filter(r => FM[r.id]?.grp === 'des' || r.id === 'mercado' || r.id === 'transporte');
  return {
    rows, target, moves,
    perDay: flex.reduce((a, r) => a + r.perDay, 0),
    canSave: moves.reduce((a, m) => a + m.monto, 0),
    risks: rows.filter(r => r.risk).sort((a, c) => c.projected / (c.budget || 1) - a.projected / (a.budget || 1)),
  };
}

export interface NextMonthPlan { budgets: Budgets; notes: string[]; changes: { id: FolderId; from: number; to: number }[] }

/**
 * Plan del próximo mes con lo que realmente gastas:
 * - cada carpeta de gasto = gasto proyectado del mes + 10% (los deseos suben como máximo 25%);
 * - pago de deudas nunca por debajo de los mínimos;
 * - si sobra, va a la deuda más cara (o a emergencia); si falta, se recorta primero lo voluntario. Nunca las necesidades.
 */
export function nextMonthPlan(template: Budgets, monthTxs: Tx[], monthPct: number, salary: number, minDebt: number, debts: Debt[], emergencyGap: number): NextMonthPlan {
  const spent = spentByFolder(monthTxs);
  const ids = FOLDERS.map(f => f.id);
  const nb: Budgets = Object.fromEntries(ids.map(id => [id, template[id] || 0]));
  const notes: string[] = [];
  const reliable = monthPct >= 0.25;
  if (!reliable) notes.push('Aún hay pocos días de datos: las carpetas sin suficiente información mantienen su monto.');

  for (const id of flowIds()) {
    if (id === 'libre') continue;
    const sp = spent[id] || 0;
    if (!reliable || sp <= 0) continue;
    const projected = sp / Math.min(1, monthPct);
    let v = ceil10(projected * 1.1);
    if (FM[id]?.grp === 'des' && nb[id] > 0) v = Math.min(v, ceil10(nb[id] * 1.25));
    nb[id] = v;
  }
  nb.deudas = debts.length ? Math.max(Math.ceil(minDebt), nb.deudas || 0) : 0;

  let diff = salary - sumBudgets(nb);
  if (diff < 0) {
    const cutOrder: FolderId[] = ['libre', 'viaje', 'inversion', ...FOLDERS.filter(f => f.grp === 'aho' && !['emergencia', 'viaje', 'inversion'].includes(f.id)).map(f => f.id),
      ...FOLDERS.filter(f => f.grp === 'des' && f.id !== 'libre').map(f => f.id), 'emergencia'];
    for (const id of cutOrder) {
      if (diff >= 0) break;
      if (!(id in nb)) continue;
      const floor = FM[id]?.grp === 'des' && reliable ? ceil10((spent[id] || 0) / Math.max(monthPct, 0.25)) : 0;
      const cut = Math.min(-diff, Math.max(0, nb[id] - floor));
      nb[id] -= cut; diff += cut;
    }
    if (diff < 0) notes.push(`Tus gastos necesarios y deudas superan tu sueldo por ${Math.round(-diff)} soles: revisa necesidades o busca un ingreso extra.`);
    else notes.push('Para que alcance, recorté primero ahorro voluntario y deseos, nunca necesidades ni deudas.');
  }
  if (diff > 0) {
    const target = savingsTarget(debts, emergencyGap);
    nb[target.id] = (nb[target.id] || 0) + diff;
    notes.push(`Te sobran ${Math.round(diff)} soles: van a ${target.why}.`);
    diff = 0;
  }
  if (diff < 0) nb.libre = (nb.libre || 0) + diff; // base cero aunque falte: Libre queda negativo como alerta
  if (nb.libre < 0) nb.libre = 0;

  const changes = ids.filter(id => (nb[id] || 0) !== (template[id] || 0)).map(id => ({ id, from: template[id] || 0, to: nb[id] || 0 }));
  return { budgets: nb, notes, changes };
}
