import { describe, expect, it } from 'vitest';
import { buildCsv, csvName } from './exportCsv';

const tx = (id: string, name: string, amt: number, f: string | null, date: string, extra = {}) => ({ id, name, amt, f, pay: 'cash', date, why: '', source: 'manual' as const, ...extra });

describe('exportar a CSV', () => {
  const txs = [
    tx('a', 'Tambo', 14.8, 'mercado', new Date(2026, 10, 13, 9, 5).toISOString()),
    tx('b', 'Netflix, "Premium"', 44.9, 'suscripciones', new Date(2026, 10, 12, 20, 0).toISOString(), { sub: 'n', source: 'applepay' }),
    tx('c', '=HYPERLINK("x")', 5, null, new Date(2026, 9, 30, 8, 0).toISOString()),
  ];
  const incomes = [{ id: 'i', name: 'Bono', amt: 300, f: 'libre', date: new Date(2026, 10, 10, 12, 0).toISOString() }];
  const subs = [{ id: 'n', name: 'Netflix', amt: 44.9 }];

  it('encabezado, BOM, orden por fecha, gastos negativos e ingresos positivos', () => {
    const csv = buildCsv(txs, incomes, subs, '2026-11');
    expect(csv.startsWith('﻿Fecha,Hora,Tipo,Descripción,Carpeta,Monto (S/),Origen,Suscripción\r\n')).toBe(true);
    const lines = csv.trim().split('\r\n').slice(1);
    expect(lines).toEqual([
      '2026-11-13,09:05,Gasto,Tambo,Mercado y súper,-14.80,A mano,',
      '2026-11-12,20:00,Gasto,"Netflix, ""Premium""",Suscripciones,-44.90,Wallet,Netflix',
      '2026-11-10,12:00,Ingreso,Bono,Libre,300.00,A mano,',
    ]);
  });
  it('todo el historial y texto que parece fórmula se exporta como texto', () => {
    const csv = buildCsv(txs, incomes, subs, null);
    expect(csv.trim().split('\r\n')).toHaveLength(5);
    expect(csv).toContain(`"'=HYPERLINK(""x"")",Sin carpeta,-5.00`);
  });
  it('nombre del archivo', () => {
    expect(csvName('2026-11', new Date(2026, 10, 13))).toBe('finanzas-peru-2026-11-20261113.csv');
    expect(csvName(null, new Date(2026, 10, 13))).toBe('finanzas-peru-todo-20261113.csv');
  });
});
