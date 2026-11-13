/**
 * Calculadora del teclado de "Registrar" (estilo Incomes): números con + − × ÷.
 * Sin eval: se lee la expresión con un analizador propio, con precedencia (× ÷ antes que + −).
 */
import { parseAmount } from './format';

export const MAX_EXPR = 40;
const OP = /[+−×÷]/;

/** Pasa lo que llegue (teclado físico, pegado, pruebas) a la forma del teclado: × ÷ − y punto decimal. */
export function normalizeExpr(raw: string): string {
  return String(raw ?? '')
    .replace(/[*xX]/g, '×').replace(/\//g, '÷').replace(/-/g, '−')
    .replace(/[^0-9.,+−×÷]/g, '')
    .slice(0, MAX_EXPR);
}

/** ¿Tiene alguna operación? (un número solo no se muestra como cuenta). */
export const hasOp = (e: string) => OP.test(e);

/** Resultado de la expresión, redondeado a céntimos. NaN si no se puede leer. Ignora un operador al final ("12+"). */
export function evalExpr(raw: string): number {
  const e = normalizeExpr(raw).replace(/[+−×÷]+$/, '');
  if (!e) return NaN;
  if (/[.,]{2}/.test(e)) return NaN;
  if (!hasOp(e)) { const v = parseAmount(e); return v > 0 || /^0*[.,]?0*$/.test(e) ? v : NaN; }
  const parts = e.split(/([+−×÷])/).filter(x => x !== '');
  // Debe alternar número, operador, número…
  const nums: number[] = [], ops: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    if (i % 2 === 0) {
      if (!/^\d*[.,]?\d*$/.test(parts[i]) || !/\d/.test(parts[i])) return NaN;
      nums.push(Number(parts[i].replace(',', '.')));
    } else {
      if (!OP.test(parts[i]) || parts[i].length !== 1) return NaN;
      ops.push(parts[i]);
    }
  }
  if (nums.length !== ops.length + 1) return NaN;
  // Primero × y ÷, luego + y −.
  const n2 = [nums[0]], o2: string[] = [];
  for (let i = 0; i < ops.length; i++) {
    const b = nums[i + 1];
    if (ops[i] === '×') n2[n2.length - 1] *= b;
    else if (ops[i] === '÷') { if (b === 0) return NaN; n2[n2.length - 1] /= b; }
    else { o2.push(ops[i]); n2.push(b); }
  }
  let r = n2[0];
  o2.forEach((o, i) => { r = o === '+' ? r + n2[i + 1] : r - n2[i + 1]; });
  return Number.isFinite(r) ? Math.round(r * 100) / 100 : NaN;
}

/** Aplica una tecla: dígito, ".", operador o "del". Evita cosas sin sentido (dos operadores, dos puntos, más de 2 decimales). */
export function pressKey(expr: string, key: string): string {
  const e = normalizeExpr(expr);
  if (key === 'del') return e.slice(0, -1);
  const last = e.slice(-1);
  const current = e.split(OP).pop() ?? '';
  if (OP.test(key)) {
    if (!e) return '';
    return OP.test(last) ? e.slice(0, -1) + key : (e + key).slice(0, MAX_EXPR);
  }
  if (e.length >= MAX_EXPR) return e;
  if (key === '.') {
    if (current.includes('.') || current.includes(',')) return e;
    return e + (current === '' ? '0.' : '.');
  }
  if (!/^\d$/.test(key)) return e;
  if (/[.,]\d\d$/.test(current)) return e; // ya tiene 2 decimales
  if (current === '0') return e.slice(0, -1) + key; // sin ceros a la izquierda
  return e + key;
}
