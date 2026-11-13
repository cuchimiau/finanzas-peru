import { useEffect, useRef, useState } from 'react';
import { FM, FOLDERS, SOURCES, SOURCE_IDS, type Card, type Goal } from '../domain/data';
import { fmt, fmt0, parseAmount } from '../domain/format';
import { evalExpr, hasOp, normalizeExpr, pressKey } from '../domain/calc';
import { agoLabel, whenLabel } from '../domain/dates';
import { emptyCard, payInfo, viaApplePay } from '../domain/cards';
import { essentials, guessFolder, isFlow, learnedFolder } from '../domain/plan';
import { Field, Icon, Segmented, SourceCard, inputStyle } from '../components/common';
import { ConnectForm, ShortcutGuide } from '../components/ConnectForm';
import type { Store } from '../state/store';
import type { Derived } from '../state/selectors';
import { CloseSheet, FolderForm, OptimizeSheet, PaidSheet, PlanEditor } from './PlanSheets';
import { AllTxSheet, PayDebtSheet } from './MoreSheets';
import { ExportSheet, FilterSheet, SubForm } from './AnalyticsSheets';

const TITLES = { recat: 'Movimiento', connect: 'Cómo leemos tus gastos', add: 'Registrar', card: 'Deuda o tarjeta', goal: 'Meta', settings: 'Ajustes', folder: 'Carpeta', plan: 'Editar plan', optimize: 'Optimizar', close: 'Tu dinero del mes', paid: 'Ya me pagaron', paydebt: 'Pago de deudas', alltx: 'Todos los movimientos', sub: 'Suscripción', filter: 'Filtrar', export: 'Exportar a Excel' };

export function SheetHost({ store, d }: { store: Store; d: Derived }) {
  const { s } = store;
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!s.sheet) return;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') store.closeSheet(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [s.sheet]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!s.sheet) return null;
  return (
    <>
      <div className="sheet-backdrop" onClick={store.closeSheet} />
      <div className="sheet" role="dialog" aria-modal="true" aria-label={TITLES[s.sheet]} tabIndex={-1} ref={ref}>
        <div className="sheet-grip" />
        {s.sheet === 'recat' && <Recat store={store} />}
        {s.sheet === 'connect' && <Sources store={store} d={d} />}
        {s.sheet === 'add' && <AddExpense store={store} />}
        {s.sheet === 'card' && <CardForm key={s.cardId || 'new'} store={store} />}
        {s.sheet === 'goal' && <GoalForm key={s.goalId || ''} store={store} />}
        {s.sheet === 'settings' && <Settings store={store} />}
        {s.sheet === 'folder' && <FolderForm key={s.editFolderId || 'new'} store={store} />}
        {s.sheet === 'plan' && <PlanEditor store={store} />}
        {s.sheet === 'optimize' && <OptimizeSheet store={store} d={d} />}
        {s.sheet === 'close' && <CloseSheet store={store} d={d} />}
        {s.sheet === 'paid' && <PaidSheet store={store} />}
        {s.sheet === 'paydebt' && <PayDebtSheet store={store} d={d} />}
        {s.sheet === 'alltx' && <AllTxSheet store={store} d={d} />}
        {s.sheet === 'sub' && <SubForm key={s.subId || 'new'} store={store} />}
        {s.sheet === 'filter' && <FilterSheet store={store} />}
        {s.sheet === 'export' && <ExportSheet store={store} />}
      </div>
    </>
  );
}

/** "2026-11-06" en hora del teléfono. */
const localDay = (iso: string) => { const d = new Date(iso); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

function Recat({ store }: { store: Store }) {
  const { s } = store;
  const tx = s.txs.find(t => t.id === s.rcId);
  if (!tx) return null;
  const p = payInfo(tx.pay, s.cards);
  return (
    <>
      <div className="row-sub">{(viaApplePay(tx) ? 'Apple Pay · ' : '') + (p.card || !viaApplePay(tx) ? p.label + ' · ' : '') + whenLabel(tx.date)}</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', margin: '2px 0 8px', gap: 12 }}>
        <span style={{ fontSize: 20, fontWeight: 500 }}>{tx.name}</span>
        <span className="tnum" style={{ fontSize: 20 }}>{tx.pending ? 'S/ ?' : '−' + fmt(tx.amt)}</span>
      </div>
      <div style={{ fontSize: 13, color: 'var(--color-neutral-400)', lineHeight: 1.45, marginBottom: 14, display: 'flex', gap: 8 }}>
        <Icon name="ph ph-sparkle" style={{ color: 'var(--color-accent-300)', fontSize: 16 }} /><span>{tx.why}</span>
      </div>
      <AmountEdit key={tx.id + tx.amt} store={store} id={tx.id} amt={tx.amt} pending={!!tx.pending} />
      <div style={{ fontSize: 12, color: 'var(--color-neutral-500)', margin: '4px 0 6px' }}>Carpeta</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {FOLDERS.filter(isFlow).map(f => (
          <button key={f.id} className={'option' + (tx.f === f.id ? ' on' : '')} aria-pressed={tx.f === f.id} style={{ height: 44 }} onClick={() => store.recategorize(f.id)}>
            <Icon name={'ph ph-' + f.icon} style={{ fontSize: 16 }} />{f.name}
          </button>
        ))}
      </div>
      <Field label="Nombre"><input className="input" style={{ ...inputStyle, marginTop: 4 }} key={tx.id} defaultValue={tx.name} aria-label="Nombre del movimiento"
        onBlur={e => { const v = e.target.value.trim(); if (v && v !== tx.name) store.setTxName(tx.id, v); }} /></Field>
      <Field label="Fecha"><input className="input" type="date" style={{ ...inputStyle, marginTop: 4 }} key={tx.id + tx.date} aria-label="Fecha del movimiento"
        defaultValue={localDay(tx.date)} max={localDay(new Date().toISOString())}
        onChange={e => { if (e.target.value && e.target.value !== localDay(tx.date)) store.setTxDate(tx.id, e.target.value); }} /></Field>
      {tx.ocr && (
        <details style={{ marginTop: 10, fontSize: 12.5, color: 'var(--color-neutral-400)' }}>
          <summary style={{ cursor: 'pointer' }}>Texto leído de la constancia</summary>
          <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 11.5, margin: '6px 0 0', padding: 8, borderRadius: 8, background: 'var(--color-bg)' }}>{tx.ocr}</pre>
        </details>
      )}
      <button type="button" className="btn btn-ghost" onClick={() => { if (confirm(`¿Eliminar "${tx.name}" (${fmt(tx.amt)})?`)) store.deleteTx(tx.id); }} style={{ marginTop: 14, height: 38, gap: 6, color: 'var(--color-neutral-400)' }}>
        <Icon name="ph ph-trash" />Eliminar movimiento
      </button>
    </>
  );
}

function AmountEdit({ store, id, amt, pending }: { store: Store; id: string; amt: number; pending: boolean }) {
  const [v, setV] = useState(amt ? String(amt) : '');
  return (
    <form onSubmit={e => { e.preventDefault(); store.setTxAmount(id, v); }} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12, padding: 10, borderRadius: 12, background: 'var(--color-bg)', border: pending ? '1px solid var(--color-accent-700)' : '1px solid transparent' }}>
      <span style={{ fontSize: 13, color: pending ? 'var(--color-accent-300)' : 'var(--color-neutral-400)', flex: 1 }}>{pending ? 'Falta el monto' : 'Monto'}</span>
      <span style={{ color: 'var(--color-neutral-500)' }}>S/</span>
      <input className="input" inputMode="decimal" value={v} onChange={e => setV(e.target.value.replace(/[^0-9.,]/g, ''))} placeholder="0.00" autoFocus={pending}
        aria-label="Monto" style={{ width: 96, height: 38, borderRadius: 9, fontSize: 15, textAlign: 'right' }} />
      <button type="submit" className="btn btn-primary" disabled={!v || parseAmount(v) === amt} style={{ height: 38, borderRadius: 9, padding: '0 12px' }}>Guardar</button>
    </form>
  );
}

function Sources({ store, d }: { store: Store; d: Derived }) {
  const { s } = store;
  const last = d.lastApplePay;
  return (
    <>
      <div style={{ fontSize: 20, fontWeight: 500 }}>Cómo leemos tus gastos</div>
      <div style={{ fontSize: 13, color: 'var(--color-neutral-400)', margin: '4px 0 14px', lineHeight: 1.45 }}>Sin pedir tus claves del banco. Lo que no llega solo, lo registras con +.</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {SOURCE_IDS.map(id => {
          const x = SOURCES[id];
          if (id === 'applepay') {
            const sub = last ? `Último pago ${agoLabel(new Date(last.date).getTime())}` : s.conn ? 'Falta crear el Atajo' : 'Conecta tu Apps Script primero';
            return <SourceCard key={id} icon={x.icon} name={x.name} sub={sub} how={x.how} ground="var(--color-bg)"
              btn={last ? { label: 'Activo', icon: 'ph ph-check', on: true, onClick: () => store.openSheet('settings') } : { label: 'Configurar', icon: 'ph ph-gear-six', onClick: () => store.openSheet('settings') }} />;
          }
          return <SourceCard key={id} icon={x.icon} name={x.name} sub={x.sub} how={x.how} ground="var(--color-bg)" btn={{ label: 'Pronto', icon: 'ph ph-clock', disabled: true }} />;
        })}
      </div>
    </>
  );
}

const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'del'];
const OPS: [string, string, string][] = [['÷', 'ph ph-divide', 'Dividir'], ['×', 'ph ph-x', 'Multiplicar'], ['−', 'ph ph-minus', 'Restar'], ['+', 'ph ph-plus', 'Sumar']];

/** Registrar (estilo Incomes): monto con teclado de calculadora, medio de pago, fecha y carpeta. */
function AddExpense({ store }: { store: Store }) {
  const { s } = store;
  const income = s.addKind === 'ingreso';
  const learned = learnedFolder(s.addName, s.txs);
  const g = guessFolder(s.addName);
  const auto = learned || g.id;
  const chosen = s.addF && FM[s.addF] ? s.addF : null;
  const id = income ? chosen || 'libre' : chosen || auto;
  const [hist, setHist] = useState<string[]>([]);
  const holdRef = useRef<number | null>(null);
  const today = isoDay(new Date()), yest = isoDay(new Date(Date.now() - 86400000));
  const dateMode = !s.addDate ? 'hoy' : s.addDate === yest ? 'ayer' : 'otra';
  const options = income ? FOLDERS : FOLDERS.filter(isFlow);
  const result = evalExpr(s.addAmt);
  const color = income ? 'var(--color-positive)' : 'var(--color-negative)';

  const change = (next: string) => { if (next === s.addAmt) return; setHist(h => [...h.slice(-30), s.addAmt]); store.setAddAmt(next); };
  const press = (k: string) => change(pressKey(s.addAmt, k));
  const undo = () => { if (!hist.length) return; store.setAddAmt(hist[hist.length - 1]); setHist(h => h.slice(0, -1)); };
  // Mantener ⌫ apretado borra todo (y "Deshacer" lo recupera).
  const holdStart = () => { holdRef.current = window.setTimeout(() => { holdRef.current = -1; change(''); }, 550); };
  const holdEnd = (e: React.SyntheticEvent) => { if (holdRef.current === -1) e.preventDefault(); else if (holdRef.current) window.clearTimeout(holdRef.current); };
  const delClick = () => { if (holdRef.current === -1) { holdRef.current = null; return; } holdRef.current = null; press('del'); };

  return (
    <form onSubmit={e => { e.preventDefault(); store.saveAdd(); }} className="add-sheet">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button type="button" className="add-x" aria-label="Cerrar" onClick={store.closeSheet}><Icon name="ph ph-x" /></button>
        <div style={{ flex: 1 }}>
          <Segmented label="Tipo" value={s.addKind} options={[['gasto', 'Gasto'], ['ingreso', 'Ingreso']]} onChange={k => store.setAdd({ addKind: k, addF: null })} />
        </div>
      </div>

      <div className="add-amount">
        <input type="text" inputMode="none" aria-label="Monto" placeholder={income ? 'Ingresar ingreso' : 'Ingresar gasto'} autoComplete="off" value={s.addAmt}
          onChange={e => change(normalizeExpr(e.target.value))} style={{ color, fontSize: s.addAmt.length > 12 ? 30 : s.addAmt ? 46 : 30 }} />
        <div className="add-result" aria-live="polite" style={{ color }}>
          {s.addAmt && hasOp(s.addAmt) ? (Number.isNaN(result) ? 'Cuenta incompleta' : `= ${fmt(result)}`) : ' '}
        </div>
        <button type="button" className="add-undo" aria-label="Deshacer" disabled={!hist.length} onClick={undo}><Icon name="ph ph-arrow-counter-clockwise" /></button>
      </div>

      <input type="text" className="input" placeholder={income ? '¿De dónde? Bono, venta, cachuelo…' : '¿Dónde? Tambo, InDrive, Inkafarma…'} aria-label="Lugar" value={s.addName} maxLength={80}
        onChange={e => store.setAddName(e.target.value)} style={{ ...inputStyle, height: 40, fontSize: 14, textAlign: 'center' }} />

      {!income && id === 'suscripciones' && s.subs.length > 0 && (
        <div className="add-subs" role="radiogroup" aria-label="Suscripción">
          {s.subs.map(x => (
            <button type="button" key={x.id} role="radio" aria-checked={s.addSub === x.id} className={'chip' + (s.addSub === x.id ? ' on' : '')} onClick={() => store.pickAddSub(s.addSub === x.id ? null : x.id)}>
              {x.name} · {fmt(x.amt)}
            </button>
          ))}
        </div>
      )}

      <div className="add-pad">
        <div className="seg" role="radiogroup" aria-label="Fecha" style={{ display: 'flex' }}>
          <button type="button" role="radio" aria-checked={dateMode === 'hoy'} className={'seg-btn' + (dateMode === 'hoy' ? ' on' : '')} onClick={() => store.setAdd({ addDate: '' })}>Hoy</button>
          <button type="button" role="radio" aria-checked={dateMode === 'ayer'} className={'seg-btn' + (dateMode === 'ayer' ? ' on' : '')} onClick={() => store.setAdd({ addDate: yest })}>Ayer</button>
          <label className={'seg-btn' + (dateMode === 'otra' ? ' on' : '')} style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {dateMode === 'otra' ? new Date(s.addDate + 'T12:00:00').toLocaleDateString('es-PE', { day: 'numeric', month: 'short' }) : 'Otra fecha'}
            <input type="date" aria-label="Otra fecha" max={today} value={dateMode === 'otra' ? s.addDate : ''}
              onChange={e => store.setAdd({ addDate: e.target.value === today ? '' : e.target.value })}
              style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', cursor: 'pointer' }} />
          </label>
        </div>
        <div className="add-ops">
          {OPS.map(([k, icon, l]) => <button type="button" key={k} aria-label={l} onClick={() => press(k)}><Icon name={icon} /></button>)}
        </div>
        <div className="add-keys">
          {KEYS.map(k => k === 'del'
            ? <button type="button" key={k} aria-label="Borrar (mantén para borrar todo)" onClick={delClick} onPointerDown={holdStart} onPointerUp={holdEnd} onPointerLeave={holdEnd} onContextMenu={e => e.preventDefault()}><Icon name="ph ph-backspace" /></button>
            : <button type="button" key={k} aria-label={k === '.' ? 'Punto decimal' : k} onClick={() => press(k)}>{k}</button>)}
        </div>
      </div>

      <div className="row-sub" style={{ textAlign: 'center' }}>
        {income ? 'Suma a la carpeta (solo este mes)' : chosen ? 'Carpeta elegida' : auto ? (learned ? 'Carpeta aprendida de tus correcciones' : g.confident ? 'Carpeta por el tipo de comercio' : 'Carpeta sugerida') : 'Elige la carpeta o escribe dónde compraste'}
      </div>
      <div className="add-folders" role="radiogroup" aria-label="Carpeta">
        {options.map(f => (
          <button type="button" key={f.id} role="radio" aria-checked={id === f.id} className={'add-folder' + (id === f.id ? ' on' : '')} onClick={() => store.setAdd({ addF: f.id })}>
            <span className="add-ficon"><Icon name={'ph ph-' + f.icon} /></span><span className="add-fname">{f.name}</span>
          </button>
        ))}
      </div>
      <button type="submit" className="btn btn-primary btn-block" style={{ height: 48, borderRadius: 14 }}>
        {income ? 'Guardar ingreso' : 'Guardar gasto'}{result > 0 ? ` · ${fmt(result)}` : ''}
      </button>
    </form>
  );
}

const num = (v: number) => (v ? String(v) : '');

function CardForm({ store }: { store: Store }) {
  const { s } = store;
  const existing = s.cards.find(c => c.id === s.cardId);
  const [c, setC] = useState<Card>(() => existing ?? emptyCard());
  const [txt, setTxt] = useState({ bal: num(existing?.bal ?? 0), limit: num(existing?.limit ?? 0), tcea: existing ? num(Math.round(existing.tcea * 1000) / 10) : '', min: num(existing?.min ?? 0), dueDay: existing?.dueDay && (existing.dueConfirmed || existing.dueDay !== 5) ? String(existing.dueDay) : '' });
  const [err, setErr] = useState('');
  const credit = c.kind === 'credit', loan = c.kind === 'loan', debt = credit || loan;
  const field = (k: keyof typeof txt) => ({ value: txt[k], onChange: (e: React.ChangeEvent<HTMLInputElement>) => setTxt(t => ({ ...t, [k]: e.target.value.replace(/[^0-9.,]/g, '') })) });

  const save = () => {
    const name = c.name.trim();
    if (!name) { setErr(loan ? 'Escribe a quién le debes, por ejemplo "Préstamo de mi tío" o "Caja Huancayo".' : 'Ponle un nombre, por ejemplo "BBVA Visa" o "CMR".'); return; }
    const bal = parseAmount(txt.bal), tcea = parseAmount(txt.tcea) / 100, dueDay = Math.round(parseAmount(txt.dueDay)), min = parseAmount(txt.min);
    if (credit && bal > 0 && !(tcea > 0 && tcea < 5)) { setErr('Escribe la TCEA en % (aparece en tu estado de cuenta, ej. 58).'); return; }
    if (loan && bal > 0 && !(min > 0)) { setErr('Escribe cuánto pagas al mes (la cuota).'); return; }
    if (loan && tcea >= 5) { setErr('El interés anual parece muy alto. Escríbelo en %, ej. 25.'); return; }
    if (debt && (dueDay < 1 || dueDay > 31)) { setErr('Escribe el día del mes en que vence el pago (1 a 31). Lo ves en tu estado de cuenta o en la app del banco.'); return; }
    // El saldo se cuenta desde hoy: los cargos que lleguen después se suman solos.
    const balChanged = !existing || existing.bal !== bal;
    store.saveCard({
      ...c, name: name.slice(0, 30), applePay: loan ? false : c.applePay,
      bal: debt ? bal : 0, limit: credit ? parseAmount(txt.limit) : 0, tcea: debt ? tcea : 0, min: debt ? min : 0, dueDay: debt ? dueDay : 0, dueConfirmed: debt ? true : undefined,
      cuotas: debt ? c.cuotas : '', balDate: balChanged ? new Date().toISOString() : c.balDate,
    });
  };

  return (
    <form onSubmit={e => { e.preventDefault(); save(); }} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 20, fontWeight: 500 }}>{existing ? (loan ? 'Editar préstamo' : 'Editar tarjeta') : 'Agregar deuda o tarjeta'}</div>
      <Segmented label="Tipo" value={c.kind} options={[['credit', 'T. crédito'], ['debit', 'T. débito'], ['loan', 'Préstamo']]} onChange={kind => setC({ ...c, kind })} />
      {loan && <div className="row-sub" style={{ marginTop: -4 }}>Deudas que no son de tarjeta: familia o amigos, caja, cooperativa, financiera, compras en cuotas de tienda…</div>}
      <Field label={loan ? '¿A quién le debes?' : 'Nombre'}>
        <input className="input" style={inputStyle} value={c.name} onChange={e => setC({ ...c, name: e.target.value })} placeholder={loan ? 'Préstamo de mi tío, Caja Arequipa…' : 'BBVA Visa, Interbank débito, CMR…'} autoFocus={!existing} />
      </Field>
      {!loan && (
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, cursor: 'pointer' }}>
          <input type="checkbox" checked={c.applePay} onChange={e => setC({ ...c, applePay: e.target.checked })} style={{ width: 20, height: 20, accentColor: 'var(--color-accent)' }} />
          La uso con Apple Pay
        </label>
      )}
      {credit && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Field label="Deuda actual (S/)" hint="Total que debes hoy, con cuotas."><input className="input" style={inputStyle} inputMode="decimal" {...field('bal')} placeholder="0" /></Field>
          <Field label="Línea de crédito (S/)"><input className="input" style={inputStyle} inputMode="decimal" {...field('limit')} placeholder="0" /></Field>
          <Field label="TCEA (%)" hint="En tu estado de cuenta."><input className="input" style={inputStyle} inputMode="decimal" {...field('tcea')} placeholder="58" /></Field>
          <Field label="Pago mínimo (S/)"><input className="input" style={inputStyle} inputMode="decimal" {...field('min')} placeholder="0" /></Field>
          <Field label="Día de pago"><input className="input" style={inputStyle} inputMode="numeric" {...field('dueDay')} placeholder="Ej. 15" /></Field>
        </div>
      )}
      {loan && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Field label="Cuánto debes hoy (S/)"><input className="input" style={inputStyle} inputMode="decimal" {...field('bal')} placeholder="0" /></Field>
          <Field label="Cuota mensual (S/)"><input className="input" style={inputStyle} inputMode="decimal" {...field('min')} placeholder="0" /></Field>
          <Field label="Interés anual (%)" hint="Déjalo en 0 si no te cobra intereses."><input className="input" style={inputStyle} inputMode="decimal" {...field('tcea')} placeholder="0" /></Field>
          <Field label="Día de pago"><input className="input" style={inputStyle} inputMode="numeric" {...field('dueDay')} placeholder="Ej. 15" /></Field>
        </div>
      )}
      {debt && (
        <Field label={loan ? 'Detalle (opcional)' : 'Compras en cuotas (opcional)'}>
          <input className="input" style={inputStyle} value={c.cuotas} onChange={e => setC({ ...c, cuotas: e.target.value.slice(0, 80) })} placeholder={loan ? 'Faltan 6 cuotas · sin intereses' : 'Televisor · cuota 4 de 12 · S/ 98'} />
        </Field>
      )}
      {err && <div role="alert" style={{ fontSize: 12.5, color: 'var(--color-accent-300)' }}>{err}</div>}
      <div style={{ display: 'flex', gap: 8 }}>
        {existing && <button type="button" className="btn btn-secondary" style={{ flex: 1, height: 46, borderRadius: 12 }} onClick={() => { if (confirm(`¿Eliminar ${existing.name}?`)) store.deleteCard(existing.id); }}><Icon name="ph ph-trash" />Eliminar</button>}
        <button type="submit" className="btn btn-primary" style={{ flex: 2, height: 46, borderRadius: 12 }}>Guardar</button>
      </div>
    </form>
  );
}

function GoalForm({ store }: { store: Store }) {
  const { s } = store;
  const g0 = s.goalId ? s.goals.find(g => g.id === s.goalId) : undefined;
  const [name, setName] = useState(g0?.name ?? '');
  const [saved, setSaved] = useState(num(g0?.saved ?? 0));
  const [target, setTarget] = useState(num(g0?.target ?? 0));
  const [monthly, setMonthly] = useState(num(g0 ? s.budgets[g0.id] || 0 : 0));
  const [err, setErr] = useState('');
  const isEf = g0?.id === 'emergencia';
  const auto = essentials(s.budgets) * 3;
  const save = () => {
    const n = name.trim().slice(0, 30);
    if (!n) { setErr('Ponle un nombre a tu meta.'); return; }
    if (!isEf && !(parseAmount(target) > 0)) { setErr('Escribe cuánto quieres juntar.'); return; }
    const g: Goal = { id: g0?.id ?? 'g' + Date.now().toString(36), name: n, saved: parseAmount(saved), target: parseAmount(target) };
    store.saveGoal(g, parseAmount(monthly));
  };
  const amt = (set: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => { set(e.target.value.replace(/[^0-9.,]/g, '')); setErr(''); };
  return (
    <form onSubmit={e => { e.preventDefault(); save(); }} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 20, fontWeight: 500 }}>{g0 ? 'Editar meta' : 'Nueva meta'}</div>
      <Field label="Nombre"><input className="input" style={inputStyle} value={name} onChange={e => { setName(e.target.value); setErr(''); }} placeholder="Ej. Laptop, Viaje a Cusco" autoFocus={!g0} /></Field>
      <Field label="Meta (S/)" hint={isEf ? `Déjalo vacío para usar 3 meses de gastos esenciales (${fmt0(auto)}).` : undefined}>
        <input className="input" style={inputStyle} inputMode="decimal" value={target} onChange={amt(setTarget)} placeholder={isEf ? String(auto) : 'Ej. 3000'} aria-label="Monto de la meta" />
      </Field>
      <Field label="Lo que ya tienes ahorrado (S/)"><input className="input" style={inputStyle} inputMode="decimal" value={saved} onChange={amt(setSaved)} placeholder="0" aria-label="Ya ahorrado" /></Field>
      <Field label="Aporte mensual (S/)" hint="Es el presupuesto de su carpeta de Ahorro. Si sube, la diferencia sale de Libre y luego de lo no gastado en tus deseos.">
        <input className="input" style={inputStyle} inputMode="decimal" value={monthly} onChange={amt(setMonthly)} placeholder="0" aria-label="Aporte mensual" />
      </Field>
      {err && <div role="alert" style={{ fontSize: 12.5, color: 'var(--color-accent-300)' }}>{err}</div>}
      <button type="submit" className="btn btn-primary btn-block" style={{ height: 46, borderRadius: 12 }}>{g0 ? 'Guardar' : 'Crear meta'}</button>
      {g0 && !isEf && (
        <button type="button" className="btn btn-ghost btn-block" style={{ height: 40, color: 'var(--color-accent-300)' }}
          onClick={() => { if (confirm(`¿Borrar la meta ${g0.name}? Su aporte mensual vuelve a Libre.`)) store.deleteGoal(g0.id); }}>Borrar meta</button>
      )}
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 20 }}>
      <div style={{ fontSize: 12, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--color-neutral-500)', marginBottom: 8 }}>{title}</div>
      {children}
    </div>
  );
}

export function Settings({ store, embedded }: { store: Store; embedded?: boolean }) {
  const { s } = store;
  const [income, setIncome] = useState(s.income);
  return (
    <>
      {!embedded && <div style={{ fontSize: 20, fontWeight: 500 }}>Ajustes</div>}

      <Section title="Tu perfil">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Field label="Nombre"><input className="input" style={inputStyle} value={s.profile.name} onChange={e => store.setName(e.target.value)} /></Field>
          <Field label="Sueldo neto mensual (S/)" hint="Al cambiarlo se rehace el plan y se pierden los ajustes manuales de carpetas.">
            <div style={{ display: 'flex', gap: 8 }}>
              <input className="input" style={{ ...inputStyle, flex: 1 }} inputMode="numeric" value={income} onChange={e => setIncome(e.target.value.replace(/[^0-9]/g, ''))} />
              <button type="button" className="btn btn-secondary" style={{ height: 44, borderRadius: 11 }} disabled={!income || Number(income) < 500}
                onClick={() => { if (confirm(`¿Rehacer tu plan con ${fmt0(Number(income))}?`)) store.rebuildPlan(income); }}>Rehacer plan</button>
            </div>
          </Field>
        </div>
      </Section>

      <Section title="Tu dinero del mes">
        <div style={{ fontSize: 13, color: 'var(--color-neutral-300)', lineHeight: 1.5 }}>
          {s.cash.opening === null ? 'Aún no escribiste cuánto tienes este mes.'
            : <>Empezaste con <b className="tnum">{fmt0(s.cash.opening)}</b>. {s.cash.salary ? `Sueldo recibido: ${fmt0(s.cash.salary.amt)}.` : `Sueldo pendiente${s.profile.payday ? ` (día ${s.profile.payday})` : ''}.`}</>}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-secondary" style={{ height: 38, borderRadius: 10 }} onClick={() => store.openSheet('close')}>{s.cash.opening === null ? 'Escribir mi dinero de hoy' : 'Corregir dinero y día de pago'}</button>
          {s.cash.opening !== null && (s.cash.salary
            ? <button type="button" className="btn btn-ghost" style={{ height: 38, borderRadius: 10 }} onClick={() => store.undoPaid()}>Aún no me pagan</button>
            : <button type="button" className="btn btn-ghost" style={{ height: 38, borderRadius: 10 }} onClick={() => store.openSheet('paid')}>Ya me pagaron</button>)}
        </div>
      </Section>

      <div id="ajustes-drive" />
      <Section title="Drive y asesor (Apps Script)">
        <ConnectForm store={store} />
      </Section>

      <Section title="Registrar gastos con Siri (Atajo)">
        <ShortcutGuide store={store} />
      </Section>

      <Section title="Privacidad">
        <div style={{ fontSize: 12.5, color: 'var(--color-neutral-400)', lineHeight: 1.5 }}>
          Tus datos viven en este teléfono y en la carpeta "Finanzas Perú" de tu Drive. Al usar el asesor, tus montos se envían a Gemini. En el plan gratuito de Gemini, Google puede usar y revisar esas consultas; con la facturación activada en tu proyecto, no.
        </div>
        <button type="button" className="btn btn-ghost" style={{ marginTop: 10, height: 38, color: 'var(--color-neutral-400)', gap: 6 }}
          onClick={() => { if (confirm('¿Borrar los datos de este teléfono? Lo guardado en tu Drive no se toca.')) store.wipeLocal(); }}>
          <Icon name="ph ph-trash" />Borrar datos de este teléfono
        </button>
      </Section>
    </>
  );
}
