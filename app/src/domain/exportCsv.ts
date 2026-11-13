// Exportar a Excel (.csv): movimientos e ingresos en una tabla que Excel y Google Sheets abren con tildes.
import { folderName, type Income, type Sub, type Tx } from './data';
import { monthKeyOf } from './dates';

const SOURCE: Record<Tx['source'], string> = { manual: 'A mano', applepay: 'Wallet', siri: 'Siri', yape: 'Yape/Plin' };
const pad = (n: number) => String(n).padStart(2, '0');
/** Celda segura: comillas si hace falta y sin fórmulas (=, +, -, @ al inicio se leen como texto). */
const cell = (v: string | number) => {
  if (typeof v === 'number') return v.toFixed(2);
  const t = /^[=+\-@\t\r]/.test(v) ? "'" + v : v;
  return /[",\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
};

export const CSV_HEADER = ['Fecha', 'Hora', 'Tipo', 'Descripción', 'Carpeta', 'Monto (S/)', 'Origen', 'Suscripción'];

/**
 * Filas ordenadas de la más reciente a la más antigua. Gastos en negativo e ingresos en positivo (como en Incomes),
 * para que la suma de la columna Monto sea lo que creció o bajó tu dinero. `month` = "2026-11" o null para todo.
 */
export function buildCsv(txs: Tx[], incomes: Income[], subs: Sub[], month: string | null): string {
  const inRange = (iso: string) => !month || monthKeyOf(iso) === month;
  const subName = (id?: string) => (id ? subs.find(s => s.id === id)?.name ?? '' : '');
  const rows: { date: string; cols: (string | number)[] }[] = [
    ...txs.filter(t => t.amt > 0 && inRange(t.date)).map(t => ({ date: t.date, cols: ['Gasto', t.name, t.f ? folderName(t.f) : 'Sin carpeta', -t.amt, SOURCE[t.source] ?? t.source, subName(t.sub)] })),
    ...incomes.filter(i => inRange(i.date)).map(i => ({ date: i.date, cols: ['Ingreso', i.name, folderName(i.f), i.amt, 'A mano', ''] })),
  ].sort((a, b) => b.date.localeCompare(a.date));
  const lines = rows.map(r => {
    const d = new Date(r.date);
    return [`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, `${pad(d.getHours())}:${pad(d.getMinutes())}`, ...r.cols].map(cell).join(',');
  });
  // BOM: Excel lee bien las tildes y la ñ.
  return '﻿' + [CSV_HEADER.join(','), ...lines].join('\r\n') + '\r\n';
}

export const csvName = (month: string | null, now = new Date()) =>
  `finanzas-peru-${month ?? 'todo'}-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}.csv`;
