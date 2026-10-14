import { useState } from 'react';
import { agoLabel } from '../domain/dates';
import { BackendError, parseConnection } from '../sync/backend';
import type { Store } from '../state/store';
import { Field, Icon, Spinner, inputStyle } from './common';

const STATUS: Record<string, string> = {
  idle: 'Guardado en tu Drive', syncing: 'Guardando…', offline: 'Sin señal: se guardará al reconectar', error: 'Revisa la conexión', off: 'No conectado',
};

/** Estado de sincronización en una línea ("Guardado en tu Drive · hace 2 min"). */
export function syncLabel(s: Store['s']): string {
  if (!s.conn) return 'Solo en este teléfono';
  if (s.sync === 'idle') return s.meta.dirty ? 'Cambios por guardar' : STATUS.idle + (s.meta.lastSync ? ' · ' + agoLabel(s.meta.lastSync) : '');
  return STATUS[s.sync];
}

export function ConnectForm({ store, compact }: { store: Store; compact?: boolean }) {
  const { s } = store;
  const [code, setCode] = useState('');
  const [secret, setSecret] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [info, setInfo] = useState<{ folderUrl: string; gemini: boolean; model: string } | null>(null);

  const raw = code.trim();
  const isUrl = /^https?:\/\//.test(raw);
  const isDev = isUrl && /\/dev\/?$/.test(raw);
  // Si pegan primero el código secreto (b1a…), lo pasamos a su campo.
  const onCode = (v: string) => {
    const t = v.trim();
    if (/^[0-9a-f]{32,}$/i.test(t)) { setSecret(t); setCode(''); setErr(''); return; }
    setCode(v);
  };
  const needsSecret = isUrl || (!!secret && !raw.startsWith('FP1.'));

  const submit = async () => {
    setErr('');
    const c = parseConnection(code, secret);
    if (!c) { setErr(needsSecret ? 'Pega la URL que termina en /exec y el código secreto (32+ caracteres).' : 'Ese código no es válido. Cópialo completo desde el registro del Apps Script.'); return; }
    setBusy(true);
    try {
      setInfo(await store.connect(c));
      setCode(''); setSecret('');
    } catch (e) {
      setErr(e instanceof BackendError ? (e.kind === 'auth' ? 'El código secreto no coincide con el del Apps Script.' : e.message) : 'No se pudo conectar.');
    } finally { setBusy(false); }
  };

  if (s.conn) {
    return (
      <div style={{ padding: 12, borderRadius: 12, background: 'var(--color-bg)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Icon name={s.sync === 'error' ? 'ph ph-warning-circle' : s.sync === 'offline' ? 'ph ph-cloud-slash' : 'ph ph-cloud-check'} style={{ fontSize: 22, color: 'var(--color-accent-300)' }} />
          <div className="row-main">
            <div className="row-title">Conectado a tu Drive</div>
            <div className="row-sub">{syncLabel(s)}{s.sync === 'error' && s.syncError ? ` · ${s.syncError}` : ''}</div>
          </div>
          {s.sync === 'syncing' && <Spinner size={16} color="var(--color-accent-300)" />}
        </div>
        {info && (
          <div style={{ fontSize: 12.5, color: 'var(--color-neutral-300)', marginTop: 10, lineHeight: 1.5 }}>
            Carpeta: <a href={info.folderUrl} target="_blank" rel="noreferrer">Finanzas Perú</a> · Asesor: {info.gemini ? `Gemini listo (${info.model})` : 'falta GEMINI_API_KEY en el Apps Script'}
          </div>
        )}
        {!compact && (
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button type="button" className="btn btn-secondary" style={{ flex: 1, height: 38, borderRadius: 10 }} onClick={() => void store.pull()}><Icon name="ph ph-arrows-clockwise" />Sincronizar</button>
            <button type="button" className="btn btn-ghost" style={{ flex: 1, height: 38, borderRadius: 10 }} onClick={store.disconnect}>Desconectar</button>
          </div>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={e => { e.preventDefault(); void submit(); }} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <Field label={isUrl ? 'URL de la aplicación web (termina en /exec)' : 'Código de conexión o URL /exec'}
        hint={isUrl ? 'En script.google.com: Implementar › Administrar implementaciones › URL de la aplicación web.' : 'Pega el código que empieza con FP1. Si configurar() te mostró un código largo (ej. b1a…), pega aquí la URL que termina en /exec y el código abajo.'}>
        <input className="input" style={inputStyle} value={code} onChange={e => onCode(e.target.value)} placeholder="FP1.… o https://script.google.com/…/exec" autoComplete="off" autoCapitalize="off" spellCheck={false} />
      </Field>
      {(needsSecret || !!secret) && (
        <Field label="Código secreto" hint="El código largo que te mostró configurar() (ej. b1a…).">
          <input className="input" style={inputStyle} value={secret} onChange={e => setSecret(e.target.value)} autoComplete="off" autoCapitalize="off" spellCheck={false} />
        </Field>
      )}
      {isDev && <div role="alert" style={{ fontSize: 12.5, color: 'var(--color-accent-300)', lineHeight: 1.45 }}>Esa es la URL de prueba (/dev). Usa la de la implementación, que termina en /exec.</div>}
      {err && <div role="alert" style={{ fontSize: 12.5, color: 'var(--color-accent-300)', lineHeight: 1.45 }}>{err}</div>}
      <button type="submit" className="btn btn-primary btn-block" disabled={busy || !code.trim()} style={{ height: 44, borderRadius: 12 }}>
        {busy ? <><Spinner size={16} />Conectando…</> : <><Icon name="ph ph-plugs-connected" />Conectar</>}
      </button>
    </form>
  );
}

function CopyRow({ label, value, secret }: { label: string; value: string; secret?: boolean }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(value); setDone(true); setTimeout(() => setDone(false), 1500); } catch { /* sin portapapeles */ }
  };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 10, background: 'var(--color-bg)', marginTop: 6 }}>
      <div className="row-main">
        <div style={{ fontSize: 11.5, color: 'var(--color-neutral-500)' }}>{label}</div>
        <div style={{ fontSize: 12.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>{secret ? value.slice(0, 6) + '••••••' : value}</div>
      </div>
      <button type="button" className="btn btn-secondary" style={{ height: 32, borderRadius: 8, padding: '0 10px', fontSize: 12.5 }} onClick={() => void copy()}>
        <Icon name={done ? 'ph ph-check' : 'ph ph-copy'} />{done ? 'Copiado' : 'Copiar'}
      </button>
    </div>
  );
}

/** Atajo "Gasto": Siri pregunta qué gastaste y lo manda al Apps Script con una sola URL. */
export function ShortcutGuide({ store }: { store: Store }) {
  const c = store.s.conn;
  const [test, setTest] = useState<'idle' | 'busy' | 'ok' | 'fail'>('idle');
  const [showWallet, setShowWallet] = useState(false);
  if (!c) return <div style={{ fontSize: 13, color: 'var(--color-neutral-400)', lineHeight: 1.5 }}>Primero conecta tu Apps Script (arriba): el Atajo envía cada gasto ahí.</div>;
  const base = `${c.url}?s=${encodeURIComponent(c.secret)}`;
  const vozUrl = `${base}&a=voz&t=`;
  const walletUrl = `${base}&a=gasto&monto=`;
  const probar = async () => {
    setTest('busy');
    try {
      const r = await fetch(vozUrl + encodeURIComponent('1 sol en Prueba del Atajo'), { credentials: 'omit' });
      const j = await r.json() as { ok?: boolean; id?: string };
      if (!j.ok || !j.id) throw new Error('sin ok');
      await store.pull();
      store.removeTx('ap-' + j.id);
      store.flash('✅ La URL del Atajo funciona');
      setTest('ok');
    } catch { setTest('fail'); }
  };
  const steps = [
    'Toca "Copiar URL del Atajo" (abajo).',
    'Abre la app Atajos → pestaña Atajos → botón + (arriba a la derecha). Arriba, ponle de nombre: Gasto.',
    'Toca "Agregar acción", busca "Solicitar entrada" y agrégala. Toca "Solicitud" y escribe: ¿Qué gastaste?',
    'Busca "Codificar URL" y agrégala (usa la Entrada proporcionada).',
    'Busca "Obtener contenido de URL" y agrégala. Toca el campo URL, pega lo que copiaste y, justo al final, toca la variable "URL codificada" en la barra de arriba del teclado.',
    'Toca OK. Listo: di "Oye Siri, Gasto" y contesta, por ejemplo, "25 soles en Tambo con BBVA". El gasto aparece al abrir la app.',
  ];
  return (
    <div>
      <div style={{ fontSize: 13, color: 'var(--color-neutral-400)', lineHeight: 1.5, marginBottom: 8 }}>
        Funciona en cualquier iPhone. Puedes decir el monto, el lugar y la tarjeta: "12 con 50 en Inkafarma con Interbank". Si olvidas el monto, te lo pide la app.
      </div>
      <ol style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, lineHeight: 1.45, color: 'var(--color-neutral-300)' }}>
        {steps.map(x => <li key={x}>{x}</li>)}
      </ol>
      <CopyRow label="URL del Atajo (ya incluye tu código secreto)" value={vozUrl} />
      <button type="button" className="btn btn-secondary btn-block" onClick={() => void probar()} disabled={test === 'busy'} style={{ height: 40, borderRadius: 10, marginTop: 8 }}>
        {test === 'busy' ? <><Spinner size={14} />Probando…</> : <><Icon name="ph ph-paper-plane-tilt" />Probar la URL</>}
      </button>
      {test === 'ok' && <div role="status" style={{ fontSize: 12.5, color: 'var(--color-accent-300)', marginTop: 6 }}>✅ La URL funciona: tu Atajo podrá registrar gastos.</div>}
      {test === 'fail' && <div role="alert" style={{ fontSize: 12.5, color: 'var(--color-accent-300)', marginTop: 6 }}>No respondió. Revisa que pegaste la nueva versión de Code.gs (Implementar › Administrar implementaciones › Nueva versión).</div>}
      <div style={{ fontSize: 12, color: 'var(--color-neutral-500)', marginTop: 10, lineHeight: 1.45 }}>
        Tip: en Ajustes del iPhone › Accesibilidad › Tocar › Toque posterior, elige "Gasto" para abrirlo tocando dos veces la parte de atrás del teléfono.
      </div>
      <button type="button" className="link-btn" onClick={() => setShowWallet(v => !v)} style={{ marginTop: 10, fontSize: 12.5 }}>
        {showWallet ? 'Ocultar' : '¿Tienes iOS 17 o más y ves "Transacción" en Automatización?'}
      </button>
      {showWallet && (
        <div style={{ fontSize: 12.5, color: 'var(--color-neutral-300)', lineHeight: 1.5, marginTop: 6 }}>
          Automatización → Nueva → Transacción → tus tarjetas → Ejecutar inmediatamente → acción "Obtener contenido de URL" con esta URL y, al final, la variable Importe. Agrega también &amp;comercio= con la variable Comercio.
          <CopyRow label="URL para Wallet" value={walletUrl} />
        </div>
      )}
    </div>
  );
}
