import type { Debt } from './data';

export type Strategy = 'avalanche' | 'snowball' | 'min';
export const MAX_MONTHS = 240;

export interface SimResult { months: number; interest: number; done: Record<string, number | null> }

/**
 * Simula mes a mes el pago de deudas con TCEA → tasa mensual efectiva.
 * Cada mes: se cargan intereses, se cubren mínimos y el excedente va a la deuda
 * prioritaria (avalancha: mayor tasa; bola de nieve: menor saldo).
 * Con "solo mínimo" se corta a 240 meses si los mínimos no cubren los intereses.
 */
export function simulate(debts: Debt[], monthlyPay: number, strat: Strategy): SimResult {
  const ds = debts.map(d => ({ ...d, r: Math.pow(1 + d.tcea, 1 / 12) - 1, done: null as number | null }));
  let month = 0, interest = 0;
  const pay = strat === 'min' ? ds.reduce((a, d) => a + d.min, 0) : monthlyPay;
  while (ds.some(d => d.bal > 0.5) && month < MAX_MONTHS) {
    month++;
    ds.forEach(d => { if (d.bal > 0) { const i = d.bal * d.r; d.bal += i; interest += i; } });
    let budget = pay;
    ds.forEach(d => { if (d.bal > 0) { const p = Math.min(d.min, d.bal, budget); d.bal -= p; budget -= p; } });
    const live = ds.filter(d => d.bal > 0.5).sort((a, b) => (strat === 'snowball' ? a.bal - b.bal : b.r - a.r));
    for (const d of live) { if (budget <= 0) break; const p = Math.min(d.bal, budget); d.bal -= p; budget -= p; }
    ds.forEach(d => { if (d.bal <= 0.5 && d.done === null) d.done = month; });
    if (strat === 'min' && month > 1 && ds.every(d => d.bal > 0.5 && d.min <= d.bal * d.r)) { month = MAX_MONTHS; break; }
  }
  return { months: month, interest, done: Object.fromEntries(ds.map(d => [d.id, d.done])) };
}

/** Orden de pago según la estrategia (el primero recibe el excedente). */
export const payOrder = (debts: Debt[], strat: Strategy) =>
  strat === 'snowball' ? debts.slice().sort((a, b) => a.bal - b.bal) : debts.slice().sort((a, b) => b.tcea - a.tcea);
