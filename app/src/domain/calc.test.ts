import { describe, expect, it } from 'vitest';
import { evalExpr, normalizeExpr, pressKey } from './calc';

const type = (keys: string[]) => keys.reduce((e, k) => pressKey(e, k), '');

describe('calculadora del teclado', () => {
  it('suma, resta y respeta la precedencia', () => {
    expect(evalExpr('245+454+45×2')).toBe(789);
    expect(evalExpr('100−20÷4')).toBe(95);
    expect(evalExpr('12.5×3')).toBe(37.5);
    expect(evalExpr('10÷3')).toBe(3.33);
  });
  it('acepta * / - del teclado físico y coma decimal', () => {
    expect(evalExpr('10*2-5/5')).toBe(19);
    expect(evalExpr('12,50+1')).toBe(13.5);
    expect(normalizeExpr('3x4')).toBe('3×4');
  });
  it('un número solo se lee como antes (miles con coma)', () => {
    expect(evalExpr('45.50')).toBe(45.5);
    expect(evalExpr('1,200.50')).toBe(1200.5);
  });
  it('ignora un operador al final y rechaza lo que no es cuenta', () => {
    expect(evalExpr('12+')).toBe(12);
    expect(evalExpr('')).toBeNaN();
    expect(evalExpr('5÷0')).toBeNaN();
    expect(evalExpr('alert(1)')).toBe(1); // el texto se descarta: nunca se ejecuta
    expect(evalExpr('1..2')).toBeNaN();
  });
  it('las teclas evitan dos operadores, dos puntos y más de 2 decimales', () => {
    expect(type(['1', '+', '×', '2'])).toBe('1×2');
    expect(type(['+', '5'])).toBe('5');
    expect(type(['.', '5', '.', '1', '2', '3'])).toBe('0.51');
    expect(type(['0', '0', '7'])).toBe('7');
    expect(type(['9', 'del', '8'])).toBe('8');
  });
});
