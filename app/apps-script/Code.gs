/**
 * Finanzas Perú · Apps Script (corre en TU cuenta de Google).
 *
 * Hace tres cosas para la app del iPhone:
 *  1. Guarda tus datos en tu Drive, carpeta "Finanzas Perú" (datos.json + hoja "Movimientos").
 *  2. Llama a Gemini con tu clave (la clave nunca sale de aquí).
 *  3. Recibe los pagos que manda el Atajo de Apple Pay (bandeja.json).
 *
 * Instalación (una vez):
 *  1. ⚙️ Configuración del proyecto ▸ Propiedades del script ▸ agrega GEMINI_API_KEY con tu clave de aistudio.google.com/apikey.
 *  2. Implementar ▸ Nueva implementación ▸ Aplicación web · Ejecutar como: Yo · Quién tiene acceso: Cualquier persona.
 *  3. Elige la función `configurar` arriba y presiona Ejecutar. Copia el "código de conexión" del registro y pégalo en la app.
 * Para actualizar el código después: Implementar ▸ Administrar implementaciones ▸ editar ▸ Nueva versión (así la URL no cambia).
 */

const FOLDER_NAME = 'Finanzas Perú';
/** Carpeta creada para ti en tu Drive. Si no existe, se busca por nombre o se crea. */
const FOLDER_ID = '1q6xfb8cznmj0l7X_lRGEOLrgbG3HBieH';
const DATA_FILE = 'datos.json';
const INBOX_FILE = 'bandeja.json';
const SHEET_NAME = 'Finanzas Perú – Movimientos';
const DEFAULT_MODEL = 'gemini-3.8-flash';
const MAX_TOOL_ROUNDS = 3;

// ─── Entrada HTTP ───

/**
 * GET para el Atajo de Siri / Wallet (una sola URL, sin JSON):
 *   …/exec?s=SECRETO&a=voz&t=25 soles en Tambo con BBVA
 *   …/exec?s=SECRETO&a=gasto&monto=16,90&comercio=Starbucks&tarjeta=BBVA
 */
function doGet(e) {
  const p = (e && e.parameter) || {};
  if (!p.a) return json_({ ok: true, app: 'finanzas-peru', hint: 'Usa POST desde la app.' });
  const secret = PropertiesService.getScriptProperties().getProperty('APP_SECRET');
  if (!secret || !safeEqual_(String(p.s || ''), secret)) return json_({ ok: false, code: 'auth', error: 'Código secreto incorrecto.' });
  try {
    if (p.a === 'voz') return json_(addTx_({ text: p.t }));
    if (p.a === 'gasto') return json_(addTx_({ amount: p.monto, merchant: p.comercio, card: p.tarjeta }));
    return json_({ ok: false, code: 'bad_request', error: 'Acción desconocida: ' + p.a });
  } catch (err) {
    return json_({ ok: false, code: err.code || 'server', error: err.userMessage || String(err) });
  }
}

function doPost(e) {
  let req;
  try {
    req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (err) {
    return json_({ ok: false, code: 'bad_request', error: 'JSON inválido' });
  }
  try {
    const props = PropertiesService.getScriptProperties();
    const secret = props.getProperty('APP_SECRET');
    if (!secret) return json_({ ok: false, code: 'config', error: 'Falta ejecutar configurar() en el Apps Script.' });
    if (!safeEqual_(String(req.secret || ''), secret)) return json_({ ok: false, code: 'auth', error: 'Código secreto incorrecto.' });
    switch (req.action) {
      case 'ping': return json_(ping_());
      case 'load': return json_(load_());
      case 'save': return json_(save_(req));
      case 'addTx': return json_(addTx_(req));
      case 'voz': return json_(addTx_({ text: req.text }));
      case 'ask': return json_(ask_(req));
      default: return json_({ ok: false, code: 'bad_request', error: 'Acción desconocida: ' + req.action });
    }
  } catch (err) {
    if (err && err.userMessage) return json_({ ok: false, code: err.code || 'server', error: err.userMessage });
    console.error(err && err.stack ? err.stack : err);
    return json_({ ok: false, code: 'server', error: 'Error en el Apps Script: ' + (err && err.message ? err.message : err) });
  }
}

// ─── Acciones ───

function ping_() {
  const props = PropertiesService.getScriptProperties();
  return { ok: true, folderUrl: folder_().getUrl(), model: props.getProperty('GEMINI_MODEL') || DEFAULT_MODEL, gemini: !!props.getProperty('GEMINI_API_KEY') };
}

function load_() {
  const data = readJson_(DATA_FILE, null);
  const inbox = readJson_(INBOX_FILE, []);
  return { ok: true, rev: data ? data.rev : 0, updatedAt: data ? data.updatedAt : null, state: data ? data.state : null, inbox: inbox };
}

function save_(req) {
  if (!req.state || typeof req.state !== 'object') throw userError_('Falta el estado a guardar.', 'bad_request');
  return withLock_(function () {
    const current = readJson_(DATA_FILE, null);
    const rev = current ? current.rev : 0;
    // Otro dispositivo guardó después de que este leyó: que la app combine y reintente.
    if (current && req.baseRev !== rev) return { ok: true, conflict: true, rev: rev, state: current.state };
    const next = { rev: rev + 1, updatedAt: new Date().toISOString(), state: req.state };
    writeJson_(DATA_FILE, next);
    if (Array.isArray(req.ackInbox) && req.ackInbox.length) {
      const ack = {};
      req.ackInbox.forEach(function (id) { ack[id] = true; });
      const inbox = readJson_(INBOX_FILE, []);
      const left = inbox.filter(function (i) { return !ack[i.id]; });
      if (left.length !== inbox.length) writeJson_(INBOX_FILE, left);
    }
    if (Array.isArray(req.sheetRows)) writeSheet_(req.sheetRows);
    return { ok: true, rev: next.rev };
  });
}

/** Deja un pago en la bandeja. Puede venir sin monto (la app pide completarlo) o como frase dictada. */
function addTx_(req) {
  const text = String(req.text || '').trim().slice(0, 200);
  const amount = parseAmount_(req.amount);
  if (!text && !(amount > 0) && !String(req.merchant || '').trim()) throw userError_('No llegó ni monto, ni comercio, ni texto.', 'bad_request');
  return withLock_(function () {
    const inbox = readJson_(INBOX_FILE, []);
    const item = {
      id: Utilities.getUuid(),
      amount: amount,
      merchant: String(req.merchant || '').slice(0, 80),
      card: String(req.card || '').slice(0, 60),
      text: text,
      at: new Date().toISOString(),
    };
    inbox.push(item);
    writeJson_(INBOX_FILE, inbox.slice(-500));
    return { ok: true, id: item.id, msg: '✅ Registrado en Finanzas Perú' };
  });
}

/** Ciclo con Gemini: si pide proponer_ajuste, se le confirma y se devuelve la propuesta a la app. */
function ask_(req) {
  if (!req.system || !Array.isArray(req.contents) || !req.contents.length) throw userError_('Pregunta vacía.', 'bad_request');
  const contents = req.contents.slice(-40);
  const calls = [];
  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const data = gemini_({
      systemInstruction: { parts: [{ text: String(req.system).slice(0, 20000) }] },
      contents: contents,
      tools: req.tools,
      generationConfig: { temperature: 0.6, maxOutputTokens: 4096 },
    });
    const cand = data.candidates && data.candidates[0];
    if (!cand) {
      const block = data.promptFeedback && data.promptFeedback.blockReason;
      return { ok: true, text: block ? 'Prefiero no responder eso. Puedo ayudarte con tus carpetas, deudas y metas.' : 'No obtuve respuesta. Intenta de nuevo.', calls: calls };
    }
    const parts = (cand.content && cand.content.parts) || [];
    const fcs = parts.filter(function (p) { return p.functionCall; });
    if (!fcs.length) {
      const text = parts.filter(function (p) { return p.text && !p.thought; }).map(function (p) { return p.text; }).join('').trim();
      if (!text && cand.finishReason === 'SAFETY') return { ok: true, text: 'Prefiero no responder eso. Puedo ayudarte con tus carpetas, deudas y metas.', calls: calls };
      return { ok: true, text: text, calls: calls };
    }
    // Se devuelve el turno del modelo tal cual (incluye las firmas de razonamiento que Gemini exige).
    contents.push(cand.content);
    contents.push({
      role: 'user',
      parts: fcs.map(function (p) {
        const known = p.functionCall.name === 'proponer_ajuste';
        if (known) calls.push(p.functionCall.args || {});
        return { functionResponse: { name: p.functionCall.name, response: { result: known ? 'Propuesta mostrada a la usuaria con botón Aplicar.' : 'Función desconocida.' } } };
      }),
    });
  }
  return { ok: true, text: calls.length ? 'Listo, revisa la propuesta.' : '', calls: calls };
}

function gemini_(body) {
  const props = PropertiesService.getScriptProperties();
  const key = props.getProperty('GEMINI_API_KEY');
  if (!key) throw userError_('Falta GEMINI_API_KEY en las Propiedades del script.', 'config');
  const model = props.getProperty('GEMINI_MODEL') || DEFAULT_MODEL;
  const res = UrlFetchApp.fetch('https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model) + ':generateContent', {
    method: 'post',
    contentType: 'application/json',
    headers: { 'x-goog-api-key': key },
    payload: JSON.stringify(body),
    muteHttpExceptions: true,
  });
  const code = res.getResponseCode();
  let data = {};
  try { data = JSON.parse(res.getContentText() || '{}'); } catch (e) { /* respuesta no JSON */ }
  if (code === 200) return data;
  const msg = (data.error && data.error.message) || ('HTTP ' + code);
  console.error('Gemini ' + code + ': ' + msg);
  if (code === 429) throw userError_('Gemini está al límite de consultas. Intenta en un minuto.', 'server');
  if (code === 400 && /API key/i.test(msg)) throw userError_('La GEMINI_API_KEY no es válida.', 'config');
  if (code === 403) throw userError_('La GEMINI_API_KEY no tiene permiso para la API de Gemini.', 'config');
  if (code === 404) throw userError_('El modelo "' + model + '" no existe. Cambia GEMINI_MODEL en las Propiedades del script.', 'config');
  throw userError_('Gemini respondió con error (' + code + '): ' + msg, 'server');
}

// ─── Instalación ───

/** Ejecútala una vez desde el editor después de implementar como aplicación web. */
function configurar() {
  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty('APP_SECRET')) props.setProperty('APP_SECRET', Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, ''));
  const folder = folder_();
  console.log('Carpeta de datos: ' + folder.getUrl());
  if (!props.getProperty('GEMINI_API_KEY')) {
    console.log('⚠️ Falta GEMINI_API_KEY: agrégala en Configuración del proyecto ▸ Propiedades del script y vuelve a ejecutar configurar().');
  } else {
    try {
      gemini_({ contents: [{ role: 'user', parts: [{ text: 'Responde solo: ok' }] }], generationConfig: { maxOutputTokens: 256 } });
      console.log('✅ Gemini responde (' + (props.getProperty('GEMINI_MODEL') || DEFAULT_MODEL) + ').');
    } catch (err) {
      console.log('⚠️ Gemini: ' + (err.userMessage || err.message));
    }
  }
  console.log(codigo_());
}

/** Muestra el código que se pega en la app (Ajustes ▸ Drive y asesor). */
function codigoDeConexion() {
  const text = codigo_();
  console.log(text);
  return text;
}

function codigo_() {
  const secret = PropertiesService.getScriptProperties().getProperty('APP_SECRET');
  if (!secret) return 'Primero ejecuta configurar().';
  const url = ScriptApp.getService().getUrl();
  if (!url || !/\/exec$/.test(url)) {
    return 'Aún no hay una implementación como aplicación web (o el editor devolvió la URL de prueba). Implementa, copia la URL que termina en /exec y pégala en la app junto con este código secreto:\n' + secret;
  }
  const code = 'FP1.' + Utilities.base64EncodeWebSafe(JSON.stringify({ u: url, s: secret })).replace(/=+$/, '');
  return '📱 Código de conexión (cópialo completo en la app):\n' + code;
}

/** Cambia el código secreto (por ejemplo si lo compartiste por error). Luego reconecta la app y actualiza el Atajo. */
function rotarSecreto() {
  PropertiesService.getScriptProperties().deleteProperty('APP_SECRET');
  configurar();
}

// ─── Drive ───

function folder_() {
  const props = PropertiesService.getScriptProperties();
  const ids = [props.getProperty('FOLDER_ID'), FOLDER_ID].filter(function (x) { return !!x; });
  for (let i = 0; i < ids.length; i++) {
    try {
      const f = DriveApp.getFolderById(ids[i]);
      if (!f.isTrashed()) { props.setProperty('FOLDER_ID', f.getId()); return f; }
    } catch (e) { /* no existe o no es tuya */ }
  }
  const it = DriveApp.getRootFolder().getFoldersByName(FOLDER_NAME);
  const f = it.hasNext() ? it.next() : DriveApp.createFolder(FOLDER_NAME);
  props.setProperty('FOLDER_ID', f.getId());
  return f;
}

function file_(name) {
  const it = folder_().getFilesByName(name);
  return it.hasNext() ? it.next() : null;
}

function readJson_(name, fallback) {
  const f = file_(name);
  if (!f) return fallback;
  try { return JSON.parse(f.getBlob().getDataAsString('UTF-8')); } catch (e) { return fallback; }
}

function writeJson_(name, obj) {
  const text = JSON.stringify(obj);
  const f = file_(name);
  if (f) f.setContent(text);
  else folder_().createFile(name, text, 'application/json');
}

/** Hoja de cálculo legible con tus movimientos. Solo se reescribe si cambió. */
function writeSheet_(rows) {
  const props = PropertiesService.getScriptProperties();
  const hash = Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, JSON.stringify(rows), Utilities.Charset.UTF_8));
  if (props.getProperty('SHEET_HASH') === hash) return;
  let ss = null;
  const id = props.getProperty('SHEET_ID');
  if (id) { try { ss = SpreadsheetApp.openById(id); } catch (e) { ss = null; } }
  if (!ss) {
    const it = folder_().getFilesByName(SHEET_NAME);
    if (it.hasNext()) ss = SpreadsheetApp.openById(it.next().getId());
    else {
      ss = SpreadsheetApp.create(SHEET_NAME);
      DriveApp.getFileById(ss.getId()).moveTo(folder_());
    }
    props.setProperty('SHEET_ID', ss.getId());
  }
  const sh = ss.getSheets()[0];
  sh.setName('Movimientos');
  sh.clearContents();
  const header = ['Fecha', 'Comercio', 'Monto (S/)', 'Carpeta', 'Medio de pago', 'Origen'];
  const data = rows.map(function (r) { return [new Date(r[0]), String(r[1]), Number(r[2]), String(r[3]), String(r[4]), String(r[5])]; });
  sh.getRange(1, 1, 1, header.length).setValues([header]).setFontWeight('bold');
  if (data.length) {
    sh.getRange(2, 1, data.length, header.length).setValues(data);
    sh.getRange(2, 1, data.length, 1).setNumberFormat('dd/mm/yyyy hh:mm');
    sh.getRange(2, 3, data.length, 1).setNumberFormat('"S/" #,##0.00');
  }
  sh.setFrozenRows(1);
  props.setProperty('SHEET_HASH', hash);
}

// ─── Utilidades ───

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function withLock_(fn) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) throw userError_('Drive está ocupado, intenta de nuevo.', 'server');
  try { return fn(); } finally { lock.releaseLock(); }
}

function userError_(msg, code) {
  const e = new Error(msg);
  e.userMessage = msg;
  e.code = code;
  return e;
}

/** Comparación en tiempo constante para el secreto. */
function safeEqual_(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** "S/ 1,234.50" · "16,90" · "16.9" · 16.9 → número. */
function parseAmount_(raw) {
  if (typeof raw === 'number') return isFinite(raw) ? Math.round(Math.abs(raw) * 100) / 100 : 0;
  let s = String(raw == null ? '' : raw).replace(/[^0-9.,-]/g, '');
  if (s.indexOf(',') >= 0 && s.indexOf('.') >= 0) s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  else if (s.indexOf(',') >= 0) s = /,\d{1,2}$/.test(s) ? s.replace(',', '.') : s.replace(/,/g, '');
  const n = parseFloat(s);
  return isFinite(n) ? Math.round(Math.abs(n) * 100) / 100 : 0;
}
