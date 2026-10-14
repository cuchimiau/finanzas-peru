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

/** Texto para pedirle a Siri (Apple Intelligence) que arme el Atajo "Gasto" con la URL ya puesta. */
export function siriPrompt(vozUrl: string) {
  return [
    'Crea un atajo llamado "Gasto" con estas 3 acciones, en este orden:',
    '1. "Solicitar entrada" de tipo Texto, con la pregunta "¿Qué gastaste?".',
    '2. "Codificar URL" sobre la Entrada proporcionada.',
    `3. "Obtener contenido de URL" con método GET. La URL es exactamente este texto: ${vozUrl} y justo al final, sin espacios, va la variable "URL codificada" del paso 2.`,
    'No agregues otras acciones ni cambies la URL.',
  ].join('\n');
}

const OL = { margin: '6px 0 0', paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6 } as const;

function Collapsible({ open, toggle, title, children }: { open: boolean; toggle: () => void; title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 12, borderTop: '1px solid var(--color-neutral-800)', paddingTop: 10 }}>
      <button type="button" className="link-btn" aria-expanded={open} onClick={toggle} style={{ fontSize: 13.5, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
        <Icon name={open ? 'ph ph-caret-down' : 'ph ph-caret-right'} />{title}
      </button>
      {open && <div style={{ fontSize: 12.5, color: 'var(--color-neutral-300)', lineHeight: 1.5, marginTop: 6 }}>{children}</div>}
    </div>
  );
}

/** Prompt para que Siri arme el atajo que recibe cada pago de Wallet (lo dispara la automatización "Wallet"). */
export function walletPrompt(url: string, secret: string) {
  return [
    'Crea un atajo llamado "Pago Wallet" que reciba como entrada la transacción de Wallet, con una sola acción:',
    `"Obtener contenido de URL" a ${url} con método POST y cuerpo de solicitud JSON con estos campos de texto:`,
    `secret = ${secret}`,
    'action = addTx',
    'kind = wallet',
    'amount = el Importe (Amount) de la Entrada del atajo',
    'merchant = el Comercio (Merchant) de la Entrada del atajo',
    'card = la Tarjeta o pase (Card or Pass) de la Entrada del atajo',
    'No agregues otras acciones.',
  ].join('\n');
}

/** Prompt para el atajo de la hoja de Compartir que lee una constancia de Yape o Plin. */
export function yapePrompt(url: string, secret: string) {
  return [
    'Crea un atajo llamado "Registrar Yape" que aparezca en la hoja de Compartir y reciba imágenes, con estas acciones:',
    '1. "Extraer texto de la imagen" (Extract Text from Image) de la Entrada del atajo.',
    `2. "Obtener contenido de URL" a ${url} con método POST y cuerpo de solicitud JSON con estos campos de texto: secret = ${secret}, action = addTx, kind = yape, text = el Texto extraído del paso 1.`,
    '3. "Mostrar notificación" con el resultado del paso 2.',
    'No agregues otras acciones.',
  ].join('\n');
}

/** Atajo "Gasto": Siri pregunta qué gastaste y lo manda al Apps Script con una sola URL. */
export function ShortcutGuide({ store }: { store: Store }) {
  const c = store.s.conn;
  const [test, setTest] = useState<'idle' | 'busy' | 'ok' | 'fail'>('idle');
  const [showWallet, setShowWallet] = useState(false);
  const [showYape, setShowYape] = useState(false);
  const [showManual, setShowManual] = useState(false);
  if (!c) return <div style={{ fontSize: 13, color: 'var(--color-neutral-400)', lineHeight: 1.5 }}>Primero conecta tu Apps Script (arriba): el Atajo envía cada gasto ahí.</div>;
  const base = `${c.url}?s=${encodeURIComponent(c.secret)}`;
  const vozUrl = `${base}&a=voz&t=`;
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
    'Toca "Agregar acción", busca "Solicitar entrada" (Ask for Input) y agrégala. Toca "Solicitud" y escribe: ¿Qué gastaste?',
    'Busca "Codificar URL" (URL Encode) y agrégala (usa la Entrada proporcionada / Provided Input).',
    'Busca "Obtener contenido de URL" (Get Contents of URL) y agrégala. Toca el campo URL, pega lo que copiaste y, justo al final, toca la variable "URL codificada" (URL Encoded Text) en la barra de arriba del teclado.',
    'Toca OK. Listo: di "Oye Siri, Gasto" y contesta, por ejemplo, "25 soles en Tambo con BBVA". El gasto aparece al abrir la app.',
  ];
  return (
    <div>
      <div style={{ fontSize: 13, color: 'var(--color-neutral-400)', lineHeight: 1.5, marginBottom: 8 }}>
        Funciona en cualquier iPhone. Puedes decir el monto, el lugar y la tarjeta: "12 con 50 en Inkafarma con Interbank". Si olvidas el monto, te lo pide la app.
      </div>
      <div style={{ fontSize: 13.5, fontWeight: 500, marginTop: 4 }}>Opción rápida: que Siri lo arme</div>
      <ol style={{ margin: '6px 0 0', paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, lineHeight: 1.45, color: 'var(--color-neutral-300)' }}>
        <li>Toca "Copiar" en "Prompt para Siri" (abajo).</li>
        <li>Abre Atajos → botón + y pídele a Siri que lo cree: pega el texto en el campo de Apple Intelligence (o díselo).</li>
        <li>Revisa la acción "Obtener contenido de URL" (Get Contents of URL): debe empezar con tu URL real https://script.google.com/… (sin "…") y terminar en &amp;a=voz&amp;t= seguida de la burbuja azul "URL codificada" (URL Encoded Text).</li>
        <li>Toca "Probar la URL" aquí, y luego di "Oye Siri, Gasto" → "25 soles en Tambo".</li>
      </ol>
      <CopyRow label="Prompt para Siri (incluye tu URL y tu código secreto)" value={siriPrompt(vozUrl)} />
      <div style={{ fontSize: 12, color: 'var(--color-neutral-500)', marginTop: 6, lineHeight: 1.45 }}>
        No compartas este texto: trae tu código secreto. Si se filtra, ejecuta rotarSecreto() en el Apps Script y vuelve a conectar.
      </div>
      <button type="button" className="link-btn" onClick={() => setShowManual(v => !v)} style={{ marginTop: 10, fontSize: 12.5 }}>
        {showManual ? 'Ocultar pasos a mano' : 'Prefiero armarlo a mano'}
      </button>
      {showManual && (
        <ol style={{ margin: '6px 0 0', paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, lineHeight: 1.45, color: 'var(--color-neutral-300)' }}>
          {steps.map(x => <li key={x}>{x}</li>)}
        </ol>
      )}
      <CopyRow label="URL del Atajo (ya incluye tu código secreto)" value={vozUrl} />
      <button type="button" className="btn btn-secondary btn-block" onClick={() => void probar()} disabled={test === 'busy'} style={{ height: 40, borderRadius: 10, marginTop: 8 }}>
        {test === 'busy' ? <><Spinner size={14} />Probando…</> : <><Icon name="ph ph-paper-plane-tilt" />Probar la URL</>}
      </button>
      {test === 'ok' && <div role="status" style={{ fontSize: 12.5, color: 'var(--color-accent-300)', marginTop: 6 }}>✅ La URL funciona: tu Atajo podrá registrar gastos.</div>}
      {test === 'fail' && <div role="alert" style={{ fontSize: 12.5, color: 'var(--color-accent-300)', marginTop: 6 }}>No respondió. Revisa que pegaste la nueva versión de Code.gs (Implementar › Administrar implementaciones › Nueva versión).</div>}
      <div style={{ fontSize: 12, color: 'var(--color-neutral-500)', marginTop: 10, lineHeight: 1.45 }}>
        Tip: en Ajustes del iPhone › Accesibilidad › Tocar › Toque posterior, elige "Gasto" para abrirlo tocando dos veces la parte de atrás del teléfono.
      </div>
      <Collapsible open={showWallet} toggle={() => setShowWallet(v => !v)} title="Registrar solo cada pago con Wallet">
        <div>Cada vez que pagas acercando el iPhone o el reloj, el gasto llega solo con monto, comercio y tarjeta. En compras por internet no siempre se activa.</div>
        <ol style={OL}>
          <li>Copia el prompt de abajo. En Atajos → +, pídele a Siri que cree el atajo "Pago Wallet".</li>
          <li>Revisa "Obtener contenido de URL" (Get Contents of URL): método POST, cuerpo JSON, y en amount, merchant y card las burbujas azules de la Entrada del atajo (Shortcut Input).</li>
          <li>Pestaña Automatización (Automation) → + → <b>Wallet</b> → elige tus tarjetas → Ejecutar inmediatamente (Run Immediately) → Siguiente → elige "Pago Wallet".</li>
          <li>Paga algo con el iPhone y abre la app: el gasto ya está en su carpeta.</li>
        </ol>
        <CopyRow label="Prompt para Siri · Pago Wallet (incluye tu código secreto)" value={walletPrompt(c.url, c.secret)} />
        <CopyRow label="URL (si lo armas a mano)" value={c.url} />
        <CopyRow label="secret" value={c.secret} secret />
        <div style={{ marginTop: 6 }}>Si también dictas el gasto a Siri, la app lo marca como "¿Duplicado?" en Inicio para que borres uno.</div>
      </Collapsible>
      <Collapsible open={showYape} toggle={() => setShowYape(v => !v)} title="Registrar Yape o Plin con 2 toques">
        <div>iPhone no deja que un atajo lea las notificaciones de Yape. Lo más rápido: en la constancia, toca Compartir → "Registrar Yape". El atajo lee la imagen en tu iPhone y manda monto y nombre.</div>
        <ol style={OL}>
          <li>Copia el prompt de abajo y pídele a Siri en Atajos → + que cree "Registrar Yape".</li>
          <li>En los detalles del atajo (ⓘ), activa "Mostrar en hoja de compartir" (Show in Share Sheet) si Siri no lo hizo.</li>
          <li>Después de yapear: Compartir → Registrar Yape. Si compartes la misma constancia dos veces, se registra una sola vez.</li>
        </ol>
        <CopyRow label="Prompt para Siri · Registrar Yape (incluye tu código secreto)" value={yapePrompt(c.url, c.secret)} />
      </Collapsible>
    </div>
  );
}
