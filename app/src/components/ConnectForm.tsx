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

  const needsSecret = !!code.trim() && !code.trim().startsWith('FP1.');

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
      <Field label="Código de conexión" hint="Lo muestra el Apps Script al ejecutar configurar() (empieza con FP1.). También puedes pegar la URL /exec.">
        <input className="input" style={inputStyle} value={code} onChange={e => setCode(e.target.value)} placeholder="FP1.…" autoComplete="off" autoCapitalize="off" spellCheck={false} />
      </Field>
      {needsSecret && (
        <Field label="Código secreto">
          <input className="input" style={inputStyle} value={secret} onChange={e => setSecret(e.target.value)} autoComplete="off" autoCapitalize="off" spellCheck={false} />
        </Field>
      )}
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

/** Pasos para crear la automatización de Atajos que manda cada pago con Apple Pay. */
export function ShortcutGuide({ store }: { store: Store }) {
  const c = store.s.conn;
  if (!c) return <div style={{ fontSize: 13, color: 'var(--color-neutral-400)', lineHeight: 1.5 }}>Primero conecta tu Apps Script: el Atajo envía cada pago ahí.</div>;
  const steps = [
    'Abre Atajos → Automatización → Nueva automatización → Transacción.',
    'Elige tus tarjetas de Wallet y marca "Ejecutar inmediatamente".',
    'Agrega la acción "Obtener contenido de URL" y pega la URL de abajo.',
    'Toca "Mostrar más": Método POST, Cuerpo de la solicitud JSON.',
    'Agrega los campos de texto: secret (pega el código), action = addTx, amount = Importe, merchant = Comercio, card = Tarjeta (estas tres son variables de la transacción).',
    'Listo: cada pago con el iPhone llega a la app la próxima vez que la abras.',
  ];
  return (
    <div>
      <ol style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, lineHeight: 1.45, color: 'var(--color-neutral-300)' }}>
        {steps.map(x => <li key={x}>{x}</li>)}
      </ol>
      <CopyRow label="URL" value={c.url} />
      <CopyRow label="secret" value={c.secret} secret />
    </div>
  );
}
