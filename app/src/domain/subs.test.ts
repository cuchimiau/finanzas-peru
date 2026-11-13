import { describe, expect, it } from 'vitest';
import { FOLDERS } from './data';
import { subStatus, subsUnpaid } from './subs';
import { realMoney } from './money';

const now = new Date(2026, 10, 13, 10, 0);
const at = (d: number, h = 9) => new Date(2026, 10, d, h, 0).toISOString();
const tx = (id: string, name: string, amt: number, f: string, date: string, sub?: string) => ({ id, name, amt, f, pay: 'cash', date, why: '', source: 'manual' as const, ...(sub ? { sub } : {}) });
const subs = [{ id: 'n', name: 'Netflix', amt: 44.9 }, { id: 's', name: 'Spotify', amt: 22.9, day: 20 }, { id: 'i', name: 'iCloud', amt: 3.9 }];

describe('suscripciones', () => {
  it('marca pagadas por suscripción elegida o por nombre del comercio, cada pago una sola vez', () => {
    const txs = [tx('a', 'NETFLIX.COM', 44.9, 'suscripciones', at(5)), tx('b', 'Pago', 22.9, 'suscripciones', at(6), 's'), tx('c', 'Netflix', 44.9, 'suscripciones', at(2, 9).replace('2026-11', '2026-10'))];
    const st = subStatus(subs, txs, '2026-11');
    expect(st.map(x => !!x.paid)).toEqual([true, true, false]);
    expect(subsUnpaid(subs, txs, '2026-11')).toBeCloseTo(3.9, 5);
  });
  it('se separa lo que falta de cada suscripción y pagarla no baja el monto del día', () => {
    const budgets = { ...Object.fromEntries(FOLDERS.map(f => [f.id, 0])), suscripciones: 45, libre: 300 };
    const cash = { key: '2026-11', opening: 900, openedAt: at(1, 8), salary: null, skip: [] };
    const r0 = realMoney({ cash, txs: [], incomes: [], budgets, cards: [], payday: 28, flexLeft: 300, now, subs });
    expect(r0.reserved.find(x => x.id === 'suscripciones')?.amt).toBeCloseTo(71.7, 5); // la suma de las 3, no el presupuesto
    const r1 = realMoney({ cash, txs: [tx('a', 'Netflix', 44.9, 'suscripciones', at(13), 'n')], incomes: [], budgets, cards: [], payday: 28, flexLeft: 300, now, subs });
    expect(r1.perDay).toBeCloseTo(r0.perDay, 5);
    expect(r1.todayLeft).toBeCloseTo(r0.todayLeft, 5);
  });
  it('salud ya no es gasto fijo: no se separa', () => {
    const budgets = { ...Object.fromEntries(FOLDERS.map(f => [f.id, 0])), salud: 80, vivienda: 300 };
    const r = realMoney({ cash: { key: '2026-11', opening: 900, openedAt: at(1, 8), salary: null, skip: [] }, txs: [], incomes: [], budgets, cards: [], payday: 28, flexLeft: 300, now });
    expect(r.reserved.map(x => x.id)).toEqual(['vivienda']);
  });
});
