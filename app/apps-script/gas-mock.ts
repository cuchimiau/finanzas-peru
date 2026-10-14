// Entorno simulado de Google Apps Script para probar Code.gs en Node.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

interface MockFile { id: string; name: string; content: string; trashed: boolean }
interface MockFolder { id: string; name: string; files: MockFile[]; trashed: boolean }
export interface FetchCall { url: string; opts: { headers: Record<string, string>; payload: string } }
export interface FakeResponse { code: number; body: unknown }

export function loadGas(opts: { folderIds?: string[]; webAppUrl?: string | null; onFetch?: (url: string, body: any) => FakeResponse } = {}) {
  const props = new Map<string, string>();
  const folders = new Map<string, MockFolder>();
  for (const id of opts.folderIds ?? []) folders.set(id, { id, name: 'Finanzas Perú', files: [], trashed: false });
  const sheets = new Map<string, { name: string; values: unknown[][]; writes: number }>();
  const fetchQueue: FakeResponse[] = [];
  const fetchCalls: FetchCall[] = [];
  const logs: string[] = [];
  let seq = 0;
  const iter = <T>(xs: T[]) => { let i = 0; return { hasNext: () => i < xs.length, next: () => xs[i++] }; };

  const fileApi = (f: MockFile) => ({
    getId: () => f.id,
    getBlob: () => ({ getDataAsString: () => f.content }),
    setContent: (t: string) => { f.content = t; },
    moveTo: (folder: { getId: () => string }) => {
      folders.forEach(x => { x.files = x.files.filter(y => y !== f); });
      folders.get(folder.getId())!.files.push(f);
    },
  });
  const folderApi = (fo: MockFolder) => ({
    getId: () => fo.id,
    getUrl: () => `https://drive.google.com/drive/folders/${fo.id}`,
    isTrashed: () => fo.trashed,
    getFilesByName: (n: string) => iter(fo.files.filter(f => f.name === n && !f.trashed).map(fileApi)),
    createFile: (name: string, content: string) => { const f = { id: 'file' + ++seq, name, content, trashed: false }; fo.files.push(f); return fileApi(f); },
  });
  const allFiles = () => Array.from(folders.values()).flatMap(f => f.files);
  const loose: MockFile[] = [];

  const range = (sheet: { values: unknown[][]; writes: number }, r: number) => {
    const api = {
      setValues: (v: unknown[][]) => { v.forEach((row, i) => { sheet.values[r - 1 + i] = row; }); sheet.writes++; return api; },
      setFontWeight: () => api,
      setNumberFormat: () => api,
    };
    return api;
  };
  const sheetApi = (id: string) => {
    const sh = sheets.get(id)!;
    return {
      getId: () => id,
      getSheets: () => [{
        setName: (n: string) => { sh.name = n; },
        clearContents: () => { sh.values = []; },
        getRange: (r: number) => range(sh, r),
        setFrozenRows: () => {},
      }],
    };
  };

  const ctx = vm.createContext({
    console: { log: (...a: unknown[]) => logs.push(a.join(' ')), error: (...a: unknown[]) => logs.push('ERR ' + a.join(' ')) },
    JSON, Math, Date, String, Number, Array, Object, Error, isFinite, parseFloat, encodeURIComponent, RegExp,
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (k: string) => props.get(k) ?? null,
        setProperty: (k: string, v: string) => { props.set(k, v); },
        deleteProperty: (k: string) => { props.delete(k); },
      }),
    },
    DriveApp: {
      getFolderById: (id: string) => { const f = folders.get(id); if (!f) throw new Error('No item with the given ID'); return folderApi(f); },
      getRootFolder: () => ({ getFoldersByName: (n: string) => iter(Array.from(folders.values()).filter(f => f.name === n && !f.trashed).map(folderApi)) }),
      createFolder: (name: string) => { const f = { id: 'folder' + ++seq, name, files: [], trashed: false }; folders.set(f.id, f); return folderApi(f); },
      getFileById: (id: string) => { const f = allFiles().find(x => x.id === id) || loose.find(x => x.id === id)!; return fileApi(f); },
    },
    SpreadsheetApp: {
      create: (name: string) => { const id = 'ss' + ++seq; sheets.set(id, { name, values: [], writes: 0 }); loose.push({ id, name, content: '', trashed: false }); return sheetApi(id); },
      openById: (id: string) => { if (!sheets.has(id)) throw new Error('not found'); return sheetApi(id); },
    },
    UrlFetchApp: {
      fetch: (url: string, o: FetchCall['opts']) => {
        fetchCalls.push({ url, opts: o });
        const r = fetchQueue.shift() ?? opts.onFetch?.(url, JSON.parse(o.payload)) ?? { code: 500, body: { error: { message: 'sin respuesta simulada' } } };
        return { getResponseCode: () => r.code, getContentText: () => JSON.stringify(r.body) };
      },
    },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} }) },
    ContentService: { MimeType: { JSON: 'application/json' }, createTextOutput: (t: string) => ({ text: t, setMimeType() { return this; } }) },
    ScriptApp: { getService: () => ({ getUrl: () => opts.webAppUrl ?? null }) },
    Utilities: {
      getUuid: () => crypto.randomUUID(),
      base64EncodeWebSafe: (s: string) => Buffer.from(s, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_'),
      base64Encode: (b: number[]) => Buffer.from(b).toString('base64'),
      computeDigest: (_a: string, s: string) => Array.from(crypto.createHash('md5').update(s).digest()),
      DigestAlgorithm: { MD5: 'MD5' },
      Charset: { UTF_8: 'UTF-8' },
    },
  });
  const code = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'Code.gs'), 'utf8');
  vm.runInContext(code + '\n;globalThis.__gas = { doPost, doGet, configurar, codigoDeConexion, parseAmount_ };', ctx);
  const gas = (ctx as unknown as { __gas: Record<string, (...a: unknown[]) => unknown> }).__gas;

  return {
    props, folders, sheets, fetchQueue, fetchCalls, logs, gas,
    /** Llama a doPost como lo haría la app y devuelve el JSON. */
    post: (body: Record<string, unknown>) => JSON.parse((gas.doPost({ postData: { contents: JSON.stringify(body) } }) as { text: string }).text),
    fileText: (name: string) => allFiles().find(f => f.name === name)?.content ?? null,
  };
}
