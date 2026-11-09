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

  it('Wallet y Yape: montos con "S/." o "PEN" y el tipo de origen', () => {
    const g = setup();
    g.call('addTx', { amount: 'S/. 16.90', merchant: 'TAMBO MIRAFLORES', card: 'Interbank Visa', kind: 'wallet' });
    g.call('addTx', { amount: 'PEN 1,234.50', merchant: 'Saga' });
    g.call('addTx', { text: '¡Yapeaste!\nS/ 25\nJuan Pérez', kind: 'yape' });
    g.call('addTx', { text: 'x', kind: 'raro' });
    g.call('addTx', { text: 'S/ 9\n' + 'texto largo '.repeat(60) + 'Nro. de operación 123456', kind: 'yape' });
    const inbox = g.call('load').inbox;
    expect(inbox.map((i: { amount: number }) => i.amount).slice(0, 2)).toEqual([16.9, 1234.5]);
    expect(inbox.map((i: { kind: string }) => i.kind)).toEqual(['wallet', '', 'yape', '', 'yape']);
    expect(inbox[4].text).toContain('operación 123456');
  });

  it('el Atajo pide tus carpetas (gasto primero, Libre al final de los gastos) y manda la elegida', () => {
    const g = setup();
    const get = (q: Record<string, string>) => (g.gas.doGet({ parameter: q }) as { text: string }).text;
    expect(get({ s: g.secret, a: 'carpetas' })).toBe('Libre');
    const folders = [
      { id: 'emergencia', name: 'Fondo de emergencia', grp: 'aho' }, { id: 'libre', name: 'Libre', grp: 'des' },
      { id: 'restaurantes', name: 'Comer fuera', grp: 'des' }, { id: 'deudas', name: 'Pago de deudas', grp: 'deu' },
      { id: 'mercado', name: 'Mercado y súper', grp: 'nec' },
    ];
    g.call('save', { baseRev: 0, state: { ...state(0), folders } });
    expect(get({ s: g.secret, a: 'carpetas' }).split('\n')).toEqual(['Mercado y súper', 'Comer fuera', 'Libre', 'Fondo de emergencia', 'Pago de deudas']);
    expect(JSON.parse(get({ s: 'mal', a: 'carpetas' }))).toMatchObject({ ok: false, code: 'auth' });
    g.call('addTx', { amount: '25', merchant: 'Tambo', folder: ' Comer fuera ' });
    expect(g.call('load').inbox[0].folder).toBe('Comer fuera');
  });

  it('Wallet: registra primero (responde solo el id) y luego manda la carpeta', () => {
    const g = setup();
    const out = g.gas.doPost({ postData: { contents: JSON.stringify({ secret: g.secret, action: 'addTx', amount: 'S/ 12.00', merchant: 'TAMBO', kind: 'wallet', resp: 'id' }) } }) as { text: string };
    expect(out.text).toMatch(/^[\w-]{8,}$/);
    expect(g.call('setFolder', { id: out.text, folder: 'Mercado y súper' })).toMatchObject({ ok: true, msg: expect.stringContaining('Mercado') });
    expect(g.call('setFolder', { id: '', folder: 'x' })).toMatchObject({ ok: false });
    const inbox = g.call('load').inbox;
    expect(inbox[1]).toMatchObject({ kind: 'fix', ref: out.text, folder: 'Mercado y súper' });
  });

  it('registra lo que mandan los atajos (sin el secreto) y no pierde un Wallet sin datos', () => {
    const g = setup();
    const raw = (body: string, parameter: Record<string, string> = {}) => JSON.parse((g.gas.doPost({ postData: { contents: body }, parameter }) as { text: string }).text);
    expect(g.call('addTx', { amount: 'S/ 12.00', merchant: 'TAMBO MIRAFLORES CENTRO', card: 'BBVA', kind: 'wallet' })).toMatchObject({ ok: true });
    expect(g.call('addTx', { kind: 'wallet' })).toMatchObject({ ok: true, empty: true, msg: expect.stringContaining('sin datos') });
    expect(g.post({ action: 'addTx', secret: 'mal', kind: 'wallet', amount: '5' })).toMatchObject({ ok: false, code: 'auth' });
    // Atajo con cuerpo "Formulario" en vez de JSON: Apps Script lo entrega en e.parameter.
    expect(raw('secret=x&action=addTx', { secret: g.secret, action: 'addTx', kind: 'wallet', amount: '7', merchant: 'Kiosko' })).toMatchObject({ ok: true });
    expect(raw('esto no es json')).toMatchObject({ ok: false, code: 'bad_request' });
    g.call('save', { baseRev: 0, state: { v: 2, phase: 'app', txs: [] } }); // las llamadas de la app no se anotan
    const { log, inbox } = g.call('load');
    expect(log.map((x: { ok: boolean; code: string }) => (x.ok ? 'ok' : x.code))).toEqual(['ok', 'ok', 'auth', 'ok', 'bad_request']);
    expect(log[0]).toMatchObject({ via: 'POST', action: 'addTx', kind: 'wallet', got: ['amount', 'merchant', 'card'], amount: 12, merchant: 'TAMBO MIRAFLORES CEN' });
    expect(log[1]).toMatchObject({ empty: true, got: [] });
    expect(JSON.stringify(log)).not.toContain(g.secret);
    expect(inbox.map((i: { merchant: string; amount: number }) => i.merchant || i.amount)).toEqual(['TAMBO MIRAFLORES CENTRO', 0, 'Kiosko']);
    for (let i = 0; i < 35; i++) g.call('addTx', { amount: String(i + 1), merchant: 'x' });
    expect(g.call('load').log).toHaveLength(30);
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
