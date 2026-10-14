import { describe, expect, it } from 'vitest';
import { loadGas } from './gas-mock';
import { parseConnection } from '../src/sync/backend';

const FOLDER = '1q6xfb8cznmj0l7X_lRGEOLrgbG3HBieH';
const URL = 'https://script.google.com/macros/s/ABC123/exec';

function setup() {
  const g = loadGas({ folderIds: [FOLDER], webAppUrl: URL });
  g.props.set('GEMINI_API_KEY', 'test-key');
  g.fetchQueue.push({ code: 200, body: { candidates: [{ content: { role: 'model', parts: [{ text: 'ok' }] } }] } });
  g.gas.configurar();
  const secret = g.props.get('APP_SECRET')!;
  return { ...g, secret, call: (action: string, extra: Record<string, unknown> = {}) => g.post({ action, secret, ...extra }) };
}

describe('Apps Script · configuración y seguridad', () => {
  it('configurar() genera el secreto, usa la carpeta creada y muestra un código que la app entiende', () => {
    const g = setup();
    expect(g.secret).toMatch(/^[0-9a-f]{64}$/);
    expect(g.props.get('FOLDER_ID')).toBe(FOLDER);
    expect(g.logs.join('\n')).toContain('✅ Gemini responde');
    const code = g.logs.find(l => l.includes('FP1.'))!.split('\n')[1];
    expect(parseConnection(code)).toEqual({ url: URL, secret: g.secret });
  });

  it('sin implementación /exec muestra el secreto para pegarlo a mano', () => {
    const g = loadGas({ folderIds: [FOLDER], webAppUrl: 'https://script.google.com/macros/s/X/dev' });
    g.gas.configurar();
    expect(g.logs.join('\n')).toContain(g.props.get('APP_SECRET'));
    expect(g.logs.join('\n')).not.toContain('FP1.');
  });

  it('rechaza un secreto incorrecto y avisa si falta configurar', () => {
    const fresh = loadGas({ folderIds: [FOLDER] });
    expect(fresh.post({ action: 'load', secret: 'x' })).toMatchObject({ ok: false, code: 'config' });
    const g = setup();
    expect(g.post({ action: 'load', secret: 'mal' })).toMatchObject({ ok: false, code: 'auth' });
    expect(g.call('nada')).toMatchObject({ ok: false, code: 'bad_request' });
  });

  it('si la carpeta ya no existe, la busca por nombre o la crea', () => {
    const g = loadGas({ folderIds: [] });
    g.gas.configurar();
    const id = g.props.get('FOLDER_ID')!;
    expect(g.folders.get(id)?.name).toBe('Finanzas Perú');
  });
});

describe('Apps Script · datos en Drive', () => {
  const state = (n: number) => ({ v: 2, phase: 'app', txs: Array.from({ length: n }, (_, i) => ({ id: 't' + i })) });

  it('guarda y carga con control de versiones', () => {
    const g = setup();
    expect(g.call('load')).toMatchObject({ ok: true, rev: 0, state: null, inbox: [] });
    expect(g.call('save', { baseRev: 0, state: state(1) })).toEqual({ ok: true, rev: 1 });
    expect(JSON.parse(g.fileText('datos.json')!)).toMatchObject({ rev: 1, state: state(1) });
    // Otro dispositivo con una versión vieja: conflicto con la versión remota.
    expect(g.call('save', { baseRev: 0, state: state(5) })).toEqual({ ok: true, conflict: true, rev: 1, state: state(1) });
    expect(g.call('save', { baseRev: 1, state: state(2) })).toEqual({ ok: true, rev: 2 });
    expect(g.call('load')).toMatchObject({ rev: 2, state: state(2) });
  });

  it('el Atajo deja pagos en la bandeja y la app los confirma al guardar', () => {
    const g = setup();
    const a = g.call('addTx', { amount: 'S/ 16,90', merchant: 'Starbucks Miraflores', card: 'BBVA Visa' });
    g.call('addTx', { amount: '1,234.50', merchant: 'Saga', card: '' });
    expect(a.ok).toBe(true);
    expect(g.call('addTx', { amount: 'abc' })).toMatchObject({ ok: false });
    const inbox = g.call('load').inbox;
    expect(inbox.map((i: { amount: number }) => i.amount)).toEqual([16.9, 1234.5]);
    g.call('save', { baseRev: 0, state: state(0), ackInbox: [a.id] });
    expect(g.call('load').inbox.map((i: { merchant: string }) => i.merchant)).toEqual(['Saga']);
  });

  it('el Atajo de Siri usa una sola URL GET (frase dictada o monto sin JSON)', () => {
    const g = setup();
    const get = (q: Record<string, string>) => JSON.parse((g.gas.doGet({ parameter: q }) as { text: string }).text);
    expect(get({ s: 'mal', a: 'voz', t: 'x' })).toMatchObject({ ok: false, code: 'auth' });
    expect(get({ s: g.secret, a: 'voz', t: '25 soles en Tambo con BBVA' })).toMatchObject({ ok: true, msg: expect.stringContaining('Registrado') });
    expect(get({ s: g.secret, a: 'gasto', monto: '', comercio: 'Starbucks', tarjeta: 'BBVA' }).ok).toBe(true); // sin monto: queda pendiente
    expect(get({ s: g.secret, a: 'gasto', monto: '', comercio: '' }).ok).toBe(false);
    const inbox = g.call('load').inbox;
    expect(inbox[0]).toMatchObject({ text: '25 soles en Tambo con BBVA', amount: 0 });
    expect(inbox[1]).toMatchObject({ merchant: 'Starbucks', amount: 0, card: 'BBVA' });
    expect(get({}).ok).toBe(true); // salud
  });

  it('escribe la hoja de Movimientos solo cuando cambia', () => {
    const g = setup();
    const rows = [['2026-10-13T15:00:00.000Z', 'Plaza Vea', 86.4, 'Mercado y súper', 'BBVA Débito', 'Manual']];
    g.call('save', { baseRev: 0, state: state(1), sheetRows: rows });
    g.call('save', { baseRev: 1, state: state(1), sheetRows: rows });
    const sh = Array.from(g.sheets.values())[0];
    expect(sh.name).toBe('Movimientos');
    expect(sh.values[0]).toEqual(['Fecha', 'Comercio', 'Monto (S/)', 'Carpeta', 'Medio de pago', 'Origen']);
    expect(sh.values[1].slice(1)).toEqual(['Plaza Vea', 86.4, 'Mercado y súper', 'BBVA Débito', 'Manual']);
    expect(sh.writes).toBe(2); // encabezado + filas, una sola vez
    expect(g.folders.get(FOLDER)!.files.some(f => f.name === 'Finanzas Perú – Movimientos')).toBe(true);
  });
});

describe('Apps Script · asesor con Gemini', () => {
  const req = { system: 'Eres el asesor', contents: [{ role: 'user', parts: [{ text: 'Optimiza mi plan' }] }], tools: [{ functionDeclarations: [{ name: 'proponer_ajuste' }] }] };

  it('ejecuta la llamada a función y devuelve propuesta + texto', () => {
    const g = setup();
    g.fetchCalls.length = 0;
    const modelTurn = { role: 'model', parts: [{ functionCall: { name: 'proponer_ajuste', args: { resumen: 'Cubre Comer fuera', movimientos: [{ de: 'libre', a: 'restaurantes', monto: 20 }] } }, thoughtSignature: 'sig' }] };
    g.fetchQueue.push({ code: 200, body: { candidates: [{ content: modelTurn, finishReason: 'STOP' }] } });
    g.fetchQueue.push({ code: 200, body: { candidates: [{ content: { role: 'model', parts: [{ text: 'Muevo S/ 20 de Libre a Comer fuera.' }] }, finishReason: 'STOP' }] } });
    const out = g.call('ask', req);
    expect(out).toEqual({ ok: true, text: 'Muevo S/ 20 de Libre a Comer fuera.', calls: [{ resumen: 'Cubre Comer fuera', movimientos: [{ de: 'libre', a: 'restaurantes', monto: 20 }] }] });
    expect(g.fetchCalls).toHaveLength(2);
    expect(g.fetchCalls[0].url).toContain('/models/gemini-3.8-flash:generateContent');
    expect(g.fetchCalls[0].opts.headers['x-goog-api-key']).toBe('test-key');
    const second = JSON.parse(g.fetchCalls[1].opts.payload);
    expect(second.systemInstruction.parts[0].text).toBe('Eres el asesor');
    expect(second.contents[1]).toEqual(modelTurn); // turno del modelo intacto (firma incluida)
    expect(second.contents[2].parts[0].functionResponse.name).toBe('proponer_ajuste');
  });

  it('traduce los errores de Gemini a mensajes claros', () => {
    const g = setup();
    g.fetchQueue.push({ code: 429, body: { error: { message: 'quota' } } });
    expect(g.call('ask', req)).toMatchObject({ ok: false, error: expect.stringContaining('límite') });
    g.fetchQueue.push({ code: 404, body: { error: { message: 'model not found' } } });
    expect(g.call('ask', req)).toMatchObject({ ok: false, code: 'config', error: expect.stringContaining('GEMINI_MODEL') });
    g.props.delete('GEMINI_API_KEY');
    expect(g.call('ask', req)).toMatchObject({ ok: false, code: 'config' });
  });

  it('respuesta bloqueada por seguridad', () => {
    const g = setup();
    g.fetchQueue.push({ code: 200, body: { promptFeedback: { blockReason: 'SAFETY' } } });
    expect(g.call('ask', req).text).toContain('Prefiero no responder');
  });
});
