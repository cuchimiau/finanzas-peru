// Formato de soles. Perú usa coma de miles y punto decimal (S/ 2,600.50).

const num = (n: number, d: number) =>
  Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });

/** S/ con decimales solo si los hay: S/ 86.40, S/ 650, −S/ 12.50 */
export const fmt = (n: number) => {
  const r = Math.round(n * 100) / 100;
  return (r < 0 ? '−S/ ' : 'S/ ') + num(r, Math.abs(r) % 1 ? 2 : 0);
};

/** S/ redondeado a soles enteros. */
export const fmt0 = (n: number) => {
  const r = Math.round(n);
  return (r < 0 ? '−S/ ' : 'S/ ') + num(r, 0);
};

/** Porcentaje acotado a [0, 100] como valor CSS. */
export const pct = (a: number, b: number) => (b > 0 ? Math.max(0, Math.min(100, (a / b) * 100)) : 0) + '%';

/** Lee un monto escrito a mano o enviado por el Atajo: "S/ 1,234.50", "S/. 16.90", "PEN 16,90", "16.9". */
export function parseAmount(raw: unknown): number {
  if (typeof raw === 'number') return Number.isFinite(raw) ? Math.round(raw * 100) / 100 : 0;
  // Solo el primer número: así "S/. 16.90" no se lee como ".16.90".
  let s = (String(raw ?? '').match(/\d[\d.,]*/)?.[0] ?? '').replace(/[.,]+$/, '');
  if (s.includes(',') && s.includes('.')) s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  else if (s.includes(',')) s = /,\d{1,2}$/.test(s) ? s.replace(',', '.') : s.replace(/,/g, '');
  const n = parseFloat(s);
  return Number.isFinite(n) ? Math.round(Math.abs(n) * 100) / 100 : 0;
}
