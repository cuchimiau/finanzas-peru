import {
  BASE_INCOME, FM, FOLDERS, FOLDER_IDS, KEYWORDS,
  type Budgets, type Folder, type FolderId, type Goal, type GoalId, type Prios, type Tx,
} from './data';
import { monthAt, monthKey, monthKeyOf } from './dates';
import { fmt, fmt0, pct } from './format';

export interface PlanOpts extends Prios { deuda: boolean }

/** Reparte el ingreso neto en carpetas (base cero: la suma siempre es igual al ingreso). */
export function buildBudgets(inc: number, pr: PlanOpts, minDebtPayment = 0): Budgets {
  const k = inc / BASE_INCOME;
  const b = Object.fromEntries(FOLDERS.map(f => [f.id, Math.round((f.base * k) / 5) * 5])) as Budgets;
  if (!pr.deuda) { b.emergencia += b.deudas; b.deudas = 0; }
  if (!pr.invertir) { b.emergencia += b.inversion; b.inversion = 0; }
  if (pr.viaje) { const m = Math.min(b.libre, Math.round((inc * 0.02) / 5) * 5); b.viaje += m; b.libre -= m; }
  const s = sumBudgets(b);
  b.libre += inc - s;
  // Los mínimos de las tarjetas siempre caben: la diferencia sale de Libre, luego de ahorro voluntario.
  let need = Math.max(0, Math.ceil(minDebtPayment) - b.deudas);
  for (const from of ['libre', 'inversion', 'viaje', 'ocio', 'restaurantes', 'emergencia'] as FolderId[]) {
    if (need <= 0) break;
    const take = Math.min(need, b[from]);
    b[from] -= take; b.deudas += take; need -= take;
  }
  return b;
}

export const sumBudgets = (b: Budgets) => FOLDER_IDS.reduce((a, id) => a + (b[id] || 0), 0);

/** Ingreso del plan = suma de carpetas (se mantiene en base cero tras cada ajuste). */
export const planIncome = sumBudgets;

export const isFlow = (f: Folder) => f.grp === 'nec' || f.grp === 'des';

export const txsOfMonth = (txs: Tx[], key: string) => txs.filter(t => monthKeyOf(t.date) === key);

export const spentOf = (id: FolderId, monthTxs: Tx[]) => monthTxs.filter(t => t.f === id).reduce((a, t) => a + t.amt, 0);

export interface FolderView {
  id: FolderId; name: string; icon: string; grp: Folder['grp']; flow: boolean;
  budget: number; spent: number; left: number; r: number;
  leftL: string; leftLabel: string; leftColor: string; ofL: string; barW: string; barColor: string;
}

/** Ritmo por encima del avance del mes a partir del cual una carpeta se marca como "caliente". */
export const HOT_MARGIN = 0.3;

export interface ViewCtx { monthPct: number; firstDue: string | null }

export function folderView(f: Folder, budgets: Budgets, monthTxs: Tx[], ctx: ViewCtx): FolderView {
  const b = budgets[f.id] || 0;
  const base = { id: f.id, name: f.name, icon: 'ph ph-' + f.icon, grp: f.grp };
  if (isFlow(f)) {
    const sp = spentOf(f.id, monthTxs), left = b - sp, r = b ? sp / b : sp > 0 ? 1 : 0;
    return {
      ...base, flow: true, budget: b, spent: sp, left, r,
      leftL: fmt(left), leftLabel: left < 0 ? 'excedido' : 'disponible',
      leftColor: left < 0 ? 'var(--color-accent-300)' : 'var(--color-text)',
      ofL: fmt(sp) + ' de ' + fmt0(b), barW: pct(sp, b),
      barColor: f.id !== 'vivienda' && r > ctx.monthPct + HOT_MARGIN ? 'var(--color-accent-400)' : 'var(--color-neutral-300)',
    };
  }
  const debt = f.grp === 'deu';
  return {
    ...base, flow: false, budget: b, spent: b, left: 0, r: 1,
    leftL: fmt0(b), leftLabel: b ? (debt ? 'para pagar' : 'apartado') : 'sin aporte',
    leftColor: b ? 'var(--color-accent-300)' : 'var(--color-neutral-500)',
    ofL: b ? (debt ? (ctx.firstDue ? `Se paga antes del ${ctx.firstDue}` : 'Pago de tus tarjetas') : 'Transferido el día de pago') : 'Sin aporte este mes',
    barW: b ? '100%' : '0%',
    barColor: debt ? 'var(--color-accent-700)' : 'var(--color-accent)',
  };
}

export const essentials = (b: Budgets) => FOLDERS.filter(f => f.grp === 'nec').reduce((a, f) => a + b[f.id], 0);

export interface GoalView extends Goal { icon: string; monthly: number; auto: boolean; foot: string }

const GOAL_ICON: Record<GoalId, string> = { emergencia: 'ph ph-lifebuoy', inversion: 'ph ph-trend-up', viaje: 'ph ph-mountains' };

/** Metas con su aporte mensual (= presupuesto de su carpeta) y fecha estimada. */
export function goalViews(b: Budgets, goals: Goal[], now = new Date()): GoalView[] {
  return goals.map(g => {
    const auto = g.id === 'emergencia' && !(g.target > 0);
    const target = auto ? essentials(b) * 3 : g.target;
    const monthly = b[g.id] || 0;
    const left = Math.max(0, target - g.saved);
    const m = monthly && left > 0 ? Math.ceil(left / monthly) : null;
    let foot: string;
    if (target > 0 && left === 0) foot = '¡Meta cumplida! Puedes pasar el aporte a otra meta.';
    else if (g.id === 'emergencia') foot = 'Meta: 3 meses de gastos esenciales. Tu CTS es un respaldo adicional.' + (m ? ' Lo completas en ' + monthAt(m, now) + '.' : '');
    else foot = m ? `Llegas a ${fmt0(target)} en ${monthAt(m, now)}.` : 'Sin aporte mensual: a este ritmo no llegas.';
    return { ...g, target, icon: GOAL_ICON[g.id], monthly, auto, foot };
  });
}

/** Adivina la carpeta de un gasto por el nombre del comercio. */
export function guessFolder(name: string): { id: FolderId | null; confident: boolean } {
  if (!name.trim()) return { id: null, confident: false };
  const hit = KEYWORDS.find(([re, id]) => FM[id] && re.test(name));
  return { id: hit ? hit[1] : 'libre', confident: !!hit };
}

/** Si ya corregiste antes la carpeta de un comercio, la recordamos. */
export function learnedFolder(name: string, txs: Tx[]): FolderId | null {
  const key = name.trim().toLowerCase();
  const prev = txs.find(t => t.f && t.name.trim().toLowerCase() === key && t.why.startsWith('Lo moviste'));
  return prev?.f && FM[prev.f] ? prev.f : null;
}

export interface Move { de: FolderId; a: FolderId; monto: number }

/** Normaliza movimientos propuestos: carpetas válidas, distintas, monto entero y sin superar lo disponible. */
export function sanitizeMoves(raw: unknown, b: Budgets): Move[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((m): m is Move => {
      if (!m || typeof m !== 'object') return false;
      const o = m as Record<string, unknown>;
      return typeof o.de === 'string' && o.de in FM && typeof o.a === 'string' && o.a in FM && o.de !== o.a && typeof o.monto === 'number' && o.monto > 0;
    })
    .map(m => ({ de: m.de, a: m.a, monto: Math.min(Math.round(m.monto), b[m.de]) }))
    .filter(m => m.monto > 0);
}

/** Aplica movimientos manteniendo el total (base cero). */
export function applyMoves(b: Budgets, moves: Move[]): Budgets {
  const nb = { ...b };
  moves.forEach(mv => { const a = Math.min(mv.monto, nb[mv.de]); nb[mv.de] -= a; nb[mv.a] += a; });
  return nb;
}

/** Ingreso bruto aproximado a partir del neto (descuento de AFP ~13%). */
export const grossFromNet = (net: number) => net / 0.87;

/** Gasto de carpetas de necesidades y deseos por mes, para el gráfico. */
export function spendByMonth(txs: Tx[], keys: string[]): Record<string, number> {
  const out = Object.fromEntries(keys.map(k => [k, 0]));
  txs.forEach(t => { const k = monthKeyOf(t.date); if (k in out && (!t.f || !FM[t.f] || FM[t.f].grp === 'nec' || FM[t.f].grp === 'des')) out[k] += t.amt; });
  return out;
}

export const currentMonthKey = () => monthKey(new Date());

// ─── Editar el presupuesto de una carpeta moviendo dinero desde otras ───

export interface Source { id: FolderId; available: number; warn: boolean }

const ORDER: FolderId[] = ['libre', 'restaurantes', 'ocio', 'suscripciones', 'viaje', 'inversion', 'mercado', 'transporte', 'servicios', 'salud', 'vivienda', 'emergencia', 'deudas'];
const WARN = new Set<FolderId>(['emergencia', 'deudas', 'mercado', 'transporte', 'servicios', 'salud', 'vivienda']);

/**
 * De dónde sacar dinero para subir `target`: primero Libre, luego lo no gastado de deseos,
 * luego ahorro voluntario y, con advertencia, necesidades, emergencia y tarjetas
 * (estas nunca por debajo de los mínimos). Nunca se toma lo ya gastado.
 */
export function suggestSources(b: Budgets, spent: Partial<Record<FolderId, number>>, target: FolderId, minDebt = 0): Source[] {
  return ORDER.filter(id => id !== target).map(id => {
    const floor = Math.max(spent[id] || 0, id === 'deudas' ? minDebt : 0);
    return { id, available: Math.max(0, Math.floor(b[id] - floor)), warn: WARN.has(id) };
  }).filter(s => s.available > 0);
}

/** Toma de las fuentes en orden hasta cubrir `need`. */
export type Take = { de: FolderId; monto: number };
export function autoCover(sources: Source[], need: number): Take[] {
  const out: Take[] = [];
  let left = Math.ceil(need);
  for (const s of sources) {
    if (left <= 0) break;
    const take = Math.min(s.available, left);
    if (take > 0) { out.push({ de: s.id, monto: take }); left -= take; }
  }
  return out;
}

/**
 * Cambia el presupuesto de `id` a `amount` manteniendo el total:
 * si sube, sale de `takes` (y lo que falte, de Libre); si baja, la diferencia va a `to` (Libre por defecto).
 * Devuelve null si no alcanza o rompe algún límite.
 */
export function planChange(b: Budgets, id: FolderId, amount: number, takes: Take[], spent: Partial<Record<FolderId, number>> = {}, minDebt = 0, to: FolderId = 'libre'): Budgets | null {
  const target = Math.max(0, Math.round(amount));
  const nb = { ...b };
  const diff = target - b[id];
  if (diff === 0) return nb;
  if (diff < 0) {
    if (target < (spent[id] || 0) - 0.001 && FM[id].grp !== 'aho') return null;
    if (id === 'deudas' && target < minDebt) return null;
    nb[id] = target; nb[to === id ? 'libre' : to] += -diff;
    return nb;
  }
  const limits = Object.fromEntries(suggestSources(b, spent, id, minDebt).map(s => [s.id, s.available])) as Partial<Record<FolderId, number>>;
  let need = diff;
  for (const t of takes) {
    const m = Math.min(Math.round(t.monto), limits[t.de] ?? 0, need);
    if (m <= 0 || t.de === id) continue;
    nb[t.de] -= m; limits[t.de] = (limits[t.de] ?? 0) - m; need -= m;
  }
  if (need > 0) {
    const fromLibre = Math.min(need, limits.libre ?? 0);
    nb.libre -= fromLibre; need -= fromLibre;
  }
  if (need > 0) return null;
  nb[id] = target;
  return nb;
}
