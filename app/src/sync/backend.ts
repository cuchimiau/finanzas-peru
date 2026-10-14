// Cliente del Apps Script (tu cuenta de Google): guarda en Drive, llama a Gemini y entrega los pagos del Atajo.
// Se envía como text/plain para evitar la consulta CORS previa, que Apps Script no responde.

export interface Connection { url: string; secret: string }

export type BackendErrorKind = 'network' | 'timeout' | 'auth' | 'server' | 'config';
export class BackendError extends Error {
  constructor(message: string, readonly kind: BackendErrorKind) { super(message); }
}

const KEY = 'finanzas-peru:conexion';
const CODE_PREFIX = 'FP1.';

const validUrl = (u: string) => /^https:\/\/script\.google(usercontent)?\.com\/.+/.test(u) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//.test(u);

/**
 * Acepta el código que muestra `configurar()` en el Apps Script ("FP1.xxxx"),
 * o la URL de la aplicación web y el secreto por separado.
 */
export function parseConnection(input: string, secretInput = ''): Connection | null {
  const raw = input.trim();
  if (raw.startsWith(CODE_PREFIX)) {
    try {
      const b64 = raw.slice(CODE_PREFIX.length).replace(/-/g, '+').replace(/_/g, '/');
      const o = JSON.parse(atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4))) as { u?: string; s?: string };
      return o.u && o.s && validUrl(o.u) ? { url: o.u, secret: o.s } : null;
    } catch { return null; }
  }
  const secret = secretInput.trim();
  return validUrl(raw) && secret.length >= 16 ? { url: raw, secret } : null;
}

export const encodeConnection = (c: Connection) =>
  CODE_PREFIX + btoa(JSON.stringify({ u: c.url, s: c.secret })).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

export function loadConnection(): Connection | null {
  try { const raw = localStorage.getItem(KEY); return raw ? (JSON.parse(raw) as Connection) : null; } catch { return null; }
}
export function saveConnection(c: Connection | null) {
  try { if (c) localStorage.setItem(KEY, JSON.stringify(c)); else localStorage.removeItem(KEY); } catch { /* sin almacenamiento */ }
}

export async function call<T>(conn: Connection, action: string, payload: Record<string, unknown> = {}, timeoutMs = 25000): Promise<T> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(conn.url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ ...payload, action, secret: conn.secret }),
      credentials: 'omit',
      signal: ac.signal,
    });
  } catch {
    throw ac.signal.aborted ? new BackendError('Drive tardó demasiado en responder', 'timeout') : new BackendError('Sin conexión', 'network');
  } finally {
    clearTimeout(timer);
  }
  let body: { ok?: boolean; error?: string; code?: string } & Record<string, unknown>;
  try { body = await res.json(); } catch {
    // Apps Script devuelve HTML cuando la implementación no es pública o la URL está mal.
    throw new BackendError('El Apps Script no respondió JSON: revisa que esté implementado con acceso "Cualquier persona"', 'config');
  }
  if (!body.ok) {
    const kind: BackendErrorKind = body.code === 'auth' ? 'auth' : body.code === 'config' ? 'config' : 'server';
    throw new BackendError(body.error || 'Error del Apps Script', kind);
  }
  return body as T;
}

// ─── Contrato de acciones ───
export interface InboxItem { id: string; amount: unknown; merchant?: string; card?: string; text?: string; kind?: string; at: string }
export interface LoadResponse { rev: number; updatedAt: string | null; state: unknown; inbox: InboxItem[] }
export interface SaveResponse { rev: number; conflict?: boolean; state?: unknown }
export interface PingResponse { folderUrl: string; model: string; gemini: boolean }
