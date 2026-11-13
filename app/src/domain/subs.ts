// Suscripciones: cada una con su monto mensual; se marca pagada con el pago del mes que le corresponde.
import type { Sub, Tx } from './data';
import { monthKeyOf } from './dates';

export const SUBS_FOLDER = 'suscripciones';

const norm = (x: string) => x.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

export interface SubView extends Sub { paid: Tx | null }

/**
 * Estado del mes de cada suscripción. Un pago cuenta para una suscripción si se registró con ella
 * o si está en la carpeta Suscripciones y su nombre la contiene ("NETFLIX.COM" → Netflix). Cada pago sirve para una sola.
 */
export function subStatus(subs: Sub[], txs: Tx[], key: string): SubView[] {
  const month = txs.filter(t => t.amt > 0 && monthKeyOf(t.date) === key && (t.sub || t.f === SUBS_FOLDER));
  const used = new Set<string>();
  const pick = (fn: (t: Tx) => boolean) => { const t = month.find(x => !used.has(x.id) && fn(x)); if (t) used.add(t.id); return t ?? null; };
  // Primero los registrados con su suscripción; luego por nombre.
  const byId = new Map(subs.map(s => [s.id, pick(t => t.sub === s.id)] as const));
  return subs.map(s => ({ ...s, paid: byId.get(s.id) ?? (norm(s.name).length >= 3 ? pick(t => !t.sub && norm(t.name).includes(norm(s.name))) : null) }));
}

/** Lo que falta pagar este mes en suscripciones. */
export const subsUnpaid = (subs: Sub[], txs: Tx[], key: string) => subStatus(subs, txs, key).filter(s => !s.paid).reduce((a, s) => a + s.amt, 0);
export const subsTotal = (subs: Sub[]) => subs.reduce((a, s) => a + s.amt, 0);
