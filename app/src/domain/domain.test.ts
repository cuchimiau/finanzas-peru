import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEFAULT_GOALS, FOLDERS, type Card, type Debt, type Tx } from './data';
import { simulate, type Strategy } from './debts';
import { applyMoves, autoCover, buildBudgets, folderView, goalViews, planChange, sanitizeMoves, spendByMonth, suggestSources, sumBudgets, txsOfMonth, type PlanOpts } from './plan';
import { currentDebts, matchCard, payInfo } from './cards';
import { buildGeminiRequest, buildSystemPrompt, toGeminiContents } from './advisor';
import { agoLabel, lastMonthKeys, monthAt, monthCtx, nextDueLabel, whenLabel } from './dates';
import { fmt, fmt0, parseAmount } from './format';
import { inboxToTxs, mergeRemote } from '../sync/merge';
import { encodeConnection, parseConnection } from '../sync/backend';
import type { Persisted } from '../state/persisted';

/** Lógica pura del prototipo (Finanzas Perú.dc.html), evaluada tal cual para comparar. */
function loadPrototype() {
  const html = fs.readFileSync(path.resolve(__dirname, '../../../project/Finanzas Perú.dc.html'), 'utf8');
  const src = html.slice(html.indexOf('const F = ['), html.indexOf('class Component'));
  // eslint-disable-next-line no-new-func
  return new Function(`${src}; return { buildBudgets, simulate, DEBTS0 };`)() as {
    buildBudgets: (inc: number, pr: PlanOpts) => Record<string, number>;
    simulate: (d: Debt[], pay: number, s: Strategy) => { months: number; interest: number; done: Record<string, number | null> };
    DEBTS0: Debt[];
  };
}

const proto = loadPrototype();
const OCT12 = new Date(2026, 9, 12, 15, 0);
const card = (o: Partial<Card>): Card => ({ id: 'c1', name: 'BBVA Visa', kind: 'credit', applePay: true, limit: 8000, bal: 3260, balDate: '2026-10-01T00:00:00.000Z', tcea: 0.58, min: 165, dueDay: 8, cuotas: '', ...o });
const tx = (o: Partial<Tx>): Tx => ({ id: 't' + Math.random(), name: 'X', amt: 10, f: 'mercado', pay: 'cash', date: OCT12.toISOString(), why: '', source: 'manual', ...o });

describe('paridad con el prototipo', () => {
  const combos: PlanOpts[] = [
    { deuda: true, emergencia: true, invertir: true, viaje: false },
    { deuda: false, emergencia: true, invertir: false, viaje: true },
    { deuda: true, emergencia: false, invertir: true, viaje: true },
  ];
  it.each([500, 1800, 2600, 3333, 7400])('buildBudgets(%i) coincide', inc => {
    for (const pr of combos) expect(buildBudgets(inc, pr)).toEqual(proto.buildBudgets(inc, pr));
  });
  it.each(['avalanche', 'snowball', 'min'] as Strategy[])('simulate(%s) coincide', strat => {
    for (const pay of [235, 400, 520, 900]) {
      const a = simulate(proto.DEBTS0, pay, strat), b = proto.simulate(proto.DEBTS0, pay, strat);
      expect(a.months).toBe(b.months);
      expect(a.interest).toBeCloseTo(b.interest, 6);
      expect(a.done).toEqual(b.done);
    }
  });
});

describe('plan base cero', () => {
  it('la suma de carpetas es exactamente el ingreso, incluso subiendo los mínimos de tarjetas', () => {
    for (const inc of [600, 1234, 2600, 9999]) expect(sumBudgets(buildBudgets(inc, { deuda: true, emergencia: true, invertir: true, viaje: true }))).toBe(inc);
    const b = buildBudgets(2600, { deuda: true, emergencia: true, invertir: true, viaje: false }, 700);
    expect(b.deudas).toBe(700);
    expect(sumBudgets(b)).toBe(2600);
    expect(b.vivienda).toBe(650); // las necesidades no se tocan
  });

  it('sanitizeMoves descarta lo inválido y no excede lo disponible', () => {
    const b = buildBudgets(2600, { deuda: true, emergencia: true, invertir: true, viaje: false });
    const moves = sanitizeMoves([
      { de: 'restaurantes', a: 'libre', monto: 30.4 }, { de: 'ocio', a: 'ocio', monto: 10 },
      { de: 'nope', a: 'libre', monto: 10 }, { de: 'ocio', a: 'libre', monto: -5 }, { de: 'suscripciones', a: 'viaje', monto: 999 }, null, 'x',
    ], b);
    expect(moves).toEqual([{ de: 'restaurantes', a: 'libre', monto: 30 }, { de: 'suscripciones', a: 'viaje', monto: b.suscripciones }]);
    expect(sumBudgets(applyMoves(b, moves))).toBe(2600);
  });
});

describe('fechas reales', () => {
  it('ritmo del mes y etiquetas', () => {
    const m = monthCtx(OCT12);
    expect(m.todayL).toBe('Lunes 12 de octubre');
    expect(m.daysLeft).toBe(20); // incluye hoy
    expect(m.pctL).toBe('39%');
    expect(monthCtx(new Date(2026, 9, 31)).daysLeft).toBe(1);
    expect(monthAt(3, OCT12)).toBe('ene 2027');
    expect(lastMonthKeys(3, new Date(2026, 0, 15))).toEqual(['2025-11', '2025-12', '2026-01']);
  });
  it('etiquetas de movimientos', () => {
    expect(whenLabel(new Date(2026, 9, 12, 13, 12).toISOString(), OCT12)).toBe('Hoy · 1:12 p. m.');
    expect(whenLabel(new Date(2026, 9, 11, 9).toISOString(), OCT12)).toBe('Ayer');
    expect(whenLabel(new Date(2026, 9, 10, 9).toISOString(), OCT12)).toBe('Sáb 10');
    expect(whenLabel(new Date(2026, 8, 2).toISOString(), OCT12)).toBe('2 sep');
    expect(agoLabel(Date.now() - 5 * 60000)).toBe('hace 5 min');
  });
  it('próxima fecha de pago', () => {
    expect(nextDueLabel(5, OCT12)).toBe('5 nov');
    expect(nextDueLabel(20, OCT12)).toBe('20 oct');
    expect(nextDueLabel(31, new Date(2026, 1, 10))).toBe('28 feb');
  });
  it('el mes se reinicia: solo cuenta lo gastado en el mes actual', () => {
    const txs = [tx({ amt: 50 }), tx({ amt: 99, date: new Date(2026, 8, 30).toISOString() })];
    const b = buildBudgets(2600, { deuda: false, emergencia: true, invertir: true, viaje: false });
    const v = folderView(FOLDERS[1], b, txsOfMonth(txs, '2026-10'), { monthPct: 0.39, firstDue: null });
    expect(v.spent).toBe(50);
    expect(spendByMonth(txs, ['2026-09', '2026-10'])).toEqual({ '2026-09': 99, '2026-10': 50 });
  });
});

describe('tarjetas y deudas', () => {
  it('el saldo suma solo los cargos posteriores al saldo informado', () => {
    const c = card({});
    const txs = [tx({ pay: 'c1', amt: 100 }), tx({ pay: 'c1', amt: 999, date: '2026-09-20T00:00:00.000Z' }), tx({ pay: 'cash', amt: 50 })];
    const [d] = currentDebts([c], txs, OCT12);
    expect(d.bal).toBe(3360);
    expect(d.due).toBe('8 nov');
    expect(currentDebts([card({ kind: 'debit' }), card({ id: 'c2', bal: 0 })], [], OCT12)).toEqual([]);
  });
  it('medios de pago y tarjeta del Atajo', () => {
    const cards = [card({}), card({ id: 'c2', name: 'Interbank Débito', kind: 'debit', applePay: true })];
    expect(payInfo('c1', cards)).toMatchObject({ ap: true, credit: true, short: 'BBVA Visa' });
    expect(payInfo('yape', cards)).toMatchObject({ ap: false, label: 'Yape' });
    expect(matchCard('Interbank Débito', cards)).toBe('c2');
    expect(matchCard('bbva visa signature', cards)).toBe('c1');
    expect(matchCard('Otra', cards)).toBe('c1'); // primera con Apple Pay
    expect(matchCard('Otra', [])).toBe('applepay');
  });
  it('metas: emergencia automática y fecha estimada', () => {
    const b = buildBudgets(2600, { deuda: true, emergencia: true, invertir: true, viaje: false });
    const [ef, inv, viaje] = goalViews(b, DEFAULT_GOALS.map(g => (g.id === 'inversion' ? { ...g, saved: 620 } : g)), OCT12);
    expect(ef.target).toBe(1530 * 3);
    expect(ef.auto).toBe(true);
    expect(inv.foot).toBe('Llegas a S/ 3,000 en oct 2030.');
    expect(viaje.monthly).toBe(0);
  });
});

describe('formatos', () => {
  it('soles y montos escritos', () => {
    expect(fmt(86.4)).toBe('S/ 86.40');
    expect(fmt(-12.5)).toBe('−S/ 12.50');
    expect(fmt0(2600)).toBe('S/ 2,600');
    expect(parseAmount('S/ 16,90')).toBe(16.9);
    expect(parseAmount('1,234.50')).toBe(1234.5);
    expect(parseAmount('1.234,50')).toBe(1234.5);
    expect(parseAmount('1,234')).toBe(1234);
    expect(parseAmount(16.904)).toBe(16.9);
    expect(parseAmount('abc')).toBe(0);
  });
});

describe('sincronización', () => {
  it('convierte la bandeja de Apple Pay en movimientos sin duplicar', () => {
    const cards = [card({})];
    const inbox = [
      { id: 'a', amount: 'S/ 16,90', merchant: 'Starbucks Miraflores', card: 'BBVA Visa', at: OCT12.toISOString() },
      { id: 'b', amount: 25, merchant: 'Comercio raro', card: '', at: 'no-es-fecha' },
      { id: 'c', amount: 0, merchant: 'X', at: OCT12.toISOString() },
    ];
    const out = inboxToTxs(inbox, cards, []);
    expect(out.map(t => [t.id, t.amt, t.f, t.pay, t.source])).toEqual([['ap-a', 16.9, 'restaurantes', 'c1', 'applepay'], ['ap-b', 25, 'libre', 'c1', 'applepay']]);
    expect(inboxToTxs(inbox, cards, out)).toEqual([]);
    // Si ya corregiste ese comercio, se respeta.
    const learned = [tx({ name: 'Comercio raro', f: 'ocio', why: 'Lo moviste a Salidas y ocio. Aprendido para la próxima.' })];
    expect(inboxToTxs([inbox[1]], cards, learned)[0].f).toBe('ocio');
  });

  it('en conflicto gana Drive pero no se pierden movimientos locales', () => {
    const base = { v: 2, phase: 'app', profile: { name: 'A' }, income: '2600', prios: { emergencia: true, invertir: true, viaje: false }, budgets: buildBudgets(2600, { deuda: false, emergencia: true, invertir: true, viaje: false }), cards: [], goals: DEFAULT_GOALS, strat: 'avalanche', messages: [] } as unknown as Persisted;
    const remote = { ...base, profile: { name: 'Remoto' }, txs: [tx({ id: 'r1', date: '2026-10-10T00:00:00.000Z' })] };
    const local = { ...base, txs: [tx({ id: 'l1', date: '2026-10-11T00:00:00.000Z' }), tx({ id: 'r1', amt: 1 })] };
    const m = mergeRemote(remote, local);
    expect(m.profile.name).toBe('Remoto');
    expect(m.txs.map(t => t.id)).toEqual(['l1', 'r1']);
    expect(m.txs[1].amt).toBe(10);
  });

  it('código de conexión', () => {
    const c = { url: 'https://script.google.com/macros/s/ABC/exec', secret: 'x'.repeat(64) };
    expect(parseConnection(encodeConnection(c))).toEqual(c);
    expect(parseConnection(c.url, c.secret)).toEqual(c);
    expect(parseConnection('https://evil.example/exec', c.secret)).toBeNull();
    expect(parseConnection(c.url, 'corto')).toBeNull();
    expect(parseConnection('FP1.basura')).toBeNull();
  });
});

describe('asesor con Gemini', () => {
  const b = buildBudgets(2600, { deuda: true, emergencia: true, invertir: true, viaje: false });
  const ctx = { name: 'Leo Díaz', budgets: b, txs: [tx({ name: 'Tambo+', f: null, amt: 18.5 })], cards: [card({})], goals: DEFAULT_GOALS, now: OCT12 };

  it('el prompt usa los datos reales', () => {
    const p = buildSystemPrompt(ctx);
    expect(p).toContain('Usuaria o usuario: Leo,');
    expect(p).toContain('sueldo neto S/ 2600/mes');
    expect(p).toContain('lunes 12 de octubre de 2026 (39% del mes, quedan 20 días contando hoy)');
    expect(p).toContain('BBVA Visa: saldo S/ 3260, TCEA 58%, mínimo S/ 165, vence 8 nov');
    expect(p).toContain('Movimientos sin categorizar este mes: Tambo+ S/ 18.5.');
  });

  it('historial en formato Gemini y declaración de la función', () => {
    expect(toGeminiContents([{ role: 'assistant', text: 'Hola' }, { role: 'user', text: 'a' }, { role: 'user', text: 'b' }, { role: 'assistant', text: 'c' }]))
      .toEqual([{ role: 'user', parts: [{ text: 'a\nb' }] }, { role: 'model', parts: [{ text: 'c' }] }]);
    const req = buildGeminiRequest(ctx, [{ role: 'user', text: 'hola' }]);
    const fn = req.tools[0].functionDeclarations[0] as { name: string; parameters: { properties: { movimientos: { items: { properties: { de: { enum: string[] } } } } } } };
    expect(fn.name).toBe('proponer_ajuste');
    expect(fn.parameters.properties.movimientos.items.properties.de.enum).toContain('restaurantes');
  });
});

describe('editar presupuesto moviendo dinero', () => {
  // Plan con Libre en 0 para reproducir el caso real.
  const base = () => { const b = buildBudgets(2600, { deuda: true, emergencia: true, invertir: true, viaje: false }); b.emergencia += b.libre; b.libre = 0; return b; };

  it('sugiere primero deseos no gastados, luego ahorro voluntario y al final emergencia/tarjetas', () => {
    const b = base();
    const src = suggestSources(b, { restaurantes: 100 }, 'vivienda', 400);
    expect(src.map(x => x.id).slice(0, 5)).toEqual(['restaurantes', 'ocio', 'suscripciones', 'inversion', 'mercado']);
    expect(src.find(x => x.id === 'restaurantes')!.available).toBe(60); // 160 − 100 gastado
    expect(src.find(x => x.id === 'deudas')!.available).toBe(120);      // 520 − 400 de mínimos
    expect(src.find(x => x.id === 'emergencia')!.warn).toBe(true);
  });

  it('sube Alquiler tomando de otras carpetas y el total no cambia', () => {
    const b = base();
    const src = suggestSources(b, {}, 'vivienda');
    const takes = autoCover(src, 250);
    expect(takes).toEqual([{ de: 'restaurantes', monto: 160 }, { de: 'ocio', monto: 80 }, { de: 'suscripciones', monto: 10 }]);
    const nb = planChange(b, 'vivienda', 900, takes)!;
    expect(nb.vivienda).toBe(900);
    expect(sumBudgets(nb)).toBe(2600);
    expect(planChange(b, 'vivienda', 900, [])).toBeNull(); // Libre en 0 y sin fuentes
  });

  it('no toma más de lo disponible ni baja de lo gastado o de los mínimos', () => {
    const b = base();
    expect(planChange(b, 'vivienda', 700, [{ de: 'restaurantes', monto: 50 }], { restaurantes: 140 })).toBeNull(); // solo 20 disponibles
    expect(planChange(b, 'mercado', 100, [], { mercado: 150 })).toBeNull();
    expect(planChange(b, 'deudas', 100, [], {}, 300)).toBeNull();
  });

  it('al bajar, la diferencia va a la carpeta elegida', () => {
    const b = base();
    const nb = planChange(b, 'restaurantes', 100, [], {}, 0, 'emergencia')!;
    expect(nb.restaurantes).toBe(100);
    expect(nb.emergencia).toBe(b.emergencia + 60);
    expect(sumBudgets(nb)).toBe(2600);
  });
});
