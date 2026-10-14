import { useEffect, useRef, useState } from 'react';
import { FM, FOLDERS, SOURCES, SOURCE_IDS, folderName, type Card, type Goal } from '../domain/data';
import { fmt, fmt0, parseAmount } from '../domain/format';
import { agoLabel, whenLabel } from '../domain/dates';
import { emptyCard, payChoices, payInfo, viaApplePay } from '../domain/cards';
import { essentials, guessFolder, isFlow, learnedFolder } from '../domain/plan';
import { Field, Icon, Segmented, SourceCard, inputStyle } from '../components/common';
import { ConnectForm, ShortcutGuide } from '../components/ConnectForm';
import type { Store } from '../state/store';
import type { Derived } from '../state/selectors';
import { CloseSheet, FolderForm, OptimizeSheet, PlanEditor } from './PlanSheets';

const TITLES = { recat: 'Movimiento', connect: 'Cómo leemos tus gastos', add: 'Registrar', card: 'Deuda o tarjeta', goal: 'Meta', settings: 'Ajustes', folder: 'Carpeta', plan: 'Editar plan', optimize: 'Optimizar', close: 'Cierre de mes' };

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
      </div>
    </>
  );
}

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

function AddExpense({ store }: { store: Store }) {
  const { s } = store;
  const income = s.addKind === 'ingreso';
  const learned = learnedFolder(s.addName, s.txs);
  const g = guessFolder(s.addName);
  const auto = learned || g.id;
  const chosen = s.addF && FM[s.addF] ? s.addF : null;
  const id = income ? chosen || 'libre' : chosen || auto;
  const [pick, setPick] = useState(false);
  const today = isoDay(new Date()), yest = isoDay(new Date(Date.now() - 86400000));
  const dateMode = !s.addDate ? 'hoy' : s.addDate === yest ? 'ayer' : 'otra';
  const options = income ? FOLDERS : FOLDERS.filter(isFlow);
  return (
    <form onSubmit={e => { e.preventDefault(); store.saveAdd(); }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 10 }}>
        <div style={{ fontSize: 20, fontWeight: 500 }}>Registrar</div>
        <div style={{ width: 190 }}>
          <Segmented label="Tipo" value={s.addKind} options={[['gasto', 'Gasto'], ['ingreso', 'Ingreso']]} onChange={k => { store.setAdd({ addKind: k, addF: null }); setPick(false); }} />
        </div>
      </div>
      <label className="amount-field" style={{ gap: 6, paddingBottom: 6 }}>
        <span style={{ fontSize: 26, color: income ? 'var(--color-accent-300)' : 'var(--color-neutral-500)' }}>{income ? '+S/' : 'S/'}</span>
        <span className="visually-hidden">Monto</span>
        <input type="text" inputMode="decimal" placeholder="0" autoComplete="off" value={s.addAmt} onChange={e => store.setAddAmt(e.target.value)} style={{ fontSize: 34, letterSpacing: 0 }} autoFocus />
      </label>
      <input type="text" className="input" placeholder={income ? '¿De dónde? ej. Bono, venta, cachuelo, devolución' : '¿Dónde? ej. Tambo, InDrive, Inkafarma'} aria-label="Lugar" value={s.addName} maxLength={80}
        onChange={e => store.setAddName(e.target.value)} style={{ ...inputStyle, marginTop: 14, fontSize: 14 }} />

      <div style={{ display: 'flex', gap: 6, marginTop: 12, alignItems: 'center' }} role="radiogroup" aria-label="Fecha">
        {([['hoy', 'Hoy', ''], ['ayer', 'Ayer', yest]] as const).map(([k, l, v]) => (
          <button type="button" key={k} role="radio" aria-checked={dateMode === k} className={'option ghost' + (dateMode === k ? ' on' : '')}
            style={{ height: 36, borderRadius: 10, justifyContent: 'center', padding: '0 14px' }} onClick={() => store.setAdd({ addDate: v })}>{l}</button>
        ))}
        <input type="date" className="input" aria-label="Otra fecha" max={today} value={dateMode === 'otra' ? s.addDate : ''}
          onChange={e => store.setAdd({ addDate: e.target.value === today ? '' : e.target.value })}
          style={{ flex: 1, height: 36, borderRadius: 10, fontSize: 13.5, borderColor: dateMode === 'otra' ? 'var(--color-accent)' : undefined }} />
      </div>

      {!income && (
        <div style={{ display: 'flex', gap: 6, marginTop: 10, overflowX: 'auto' }} role="radiogroup" aria-label="Medio de pago">
          {payChoices(s.cards).map(m => (
            <button type="button" key={m.id} role="radio" aria-checked={s.addPay === m.id} className={'option ghost' + (s.addPay === m.id ? ' on' : '')}
              style={{ flex: '1 0 auto', height: 36, borderRadius: 10, justifyContent: 'center', gap: 5, whiteSpace: 'nowrap' }} onClick={() => store.setAddPay(m.id)}>
              <Icon name={m.icon} />{m.label}
            </button>
          ))}
        </div>
      )}

      <button type="button" onClick={() => setPick(v => !v)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, marginTop: 12, padding: 12, borderRadius: 12, background: 'var(--color-bg)', border: 0, color: 'var(--color-text)', cursor: 'pointer', textAlign: 'left' }}>
        <Icon name={id && FM[id] ? 'ph ph-' + FM[id].icon : 'ph ph-question'} style={{ fontSize: 20, color: 'var(--color-accent-300)' }} />
        <div style={{ flex: 1 }}>
          <div className="row-sub">{income ? 'Suma a la carpeta (solo este mes)' : chosen ? 'Carpeta elegida' : 'Carpeta detectada'}</div>
          <div className="row-title">{id && FM[id] ? FM[id].name : 'Escribe dónde compraste'}</div>
        </div>
        <span style={{ fontSize: 12, color: 'var(--color-accent-300)' }}>{pick ? 'Cerrar' : 'Cambiar'}</span>
      </button>
      {!income && !chosen && auto && <div className="row-sub" style={{ marginTop: 4 }}>{learned ? 'Aprendido de tus correcciones' : g.confident ? 'Por el tipo de comercio' : 'Sugerencia'}</div>}
      {pick && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 8 }}>
          {options.map(f => (
            <button type="button" key={f.id} className={'option' + (id === f.id ? ' on' : '')} style={{ height: 40 }} onClick={() => { store.setAdd({ addF: f.id }); setPick(false); }}>
              <Icon name={'ph ph-' + f.icon} style={{ fontSize: 15 }} />{f.name}
            </button>
          ))}
        </div>
      )}
      <button type="submit" className="btn btn-primary btn-block" style={{ height: 46, borderRadius: 12, marginTop: 12 }}>{income ? 'Guardar ingreso' : 'Guardar gasto'}</button>
    </form>
  );
}

const num = (v: number) => (v ? String(v) : '');

function CardForm({ store }: { store: Store }) {
  const { s } = store;
  const existing = s.cards.find(c => c.id === s.cardId);
  const [c, setC] = useState<Card>(() => existing ?? emptyCard());
  const [txt, setTxt] = useState({ bal: num(existing?.bal ?? 0), limit: num(existing?.limit ?? 0), tcea: existing ? num(Math.round(existing.tcea * 1000) / 10) : '', min: num(existing?.min ?? 0), dueDay: String(existing?.dueDay || 5) });
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
    if (debt && (dueDay < 1 || dueDay > 31)) { setErr('El día de pago va de 1 a 31.'); return; }
    // El saldo se cuenta desde hoy: los cargos que lleguen después se suman solos.
    const balChanged = !existing || existing.bal !== bal;
    store.saveCard({
      ...c, name: name.slice(0, 30), applePay: loan ? false : c.applePay,
      bal: debt ? bal : 0, limit: credit ? parseAmount(txt.limit) : 0, tcea: debt ? tcea : 0, min: debt ? min : 0, dueDay: debt ? dueDay : 0,
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
          <Field label="Día de pago"><input className="input" style={inputStyle} inputMode="numeric" {...field('dueDay')} placeholder="5" /></Field>
        </div>
      )}
      {loan && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Field label="Cuánto debes hoy (S/)"><input className="input" style={inputStyle} inputMode="decimal" {...field('bal')} placeholder="0" /></Field>
          <Field label="Cuota mensual (S/)"><input className="input" style={inputStyle} inputMode="decimal" {...field('min')} placeholder="0" /></Field>
          <Field label="Interés anual (%)" hint="Déjalo en 0 si no te cobra intereses."><input className="input" style={inputStyle} inputMode="decimal" {...field('tcea')} placeholder="0" /></Field>
          <Field label="Día de pago"><input className="input" style={inputStyle} inputMode="numeric" {...field('dueDay')} placeholder="5" /></Field>
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
  const g0 = s.goals.find(g => g.id === s.goalId);
  const [name, setName] = useState(g0?.name ?? '');
  const [saved, setSaved] = useState(num(g0?.saved ?? 0));
  const [target, setTarget] = useState(num(g0?.target ?? 0));
  if (!g0) return null;
  const isEf = g0.id === 'emergencia';
  const auto = essentials(s.budgets) * 3;
  const save = () => {
    const g: Goal = { ...g0, name: name.trim().slice(0, 30) || g0.name, saved: parseAmount(saved), target: parseAmount(target) };
    store.saveGoal(g);
  };
  return (
    <form onSubmit={e => { e.preventDefault(); save(); }} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 20, fontWeight: 500 }}>Editar meta</div>
      <Field label="Nombre"><input className="input" style={inputStyle} value={name} onChange={e => setName(e.target.value)} /></Field>
      <Field label="Lo que ya tienes ahorrado (S/)"><input className="input" style={inputStyle} inputMode="decimal" value={saved} onChange={e => setSaved(e.target.value.replace(/[^0-9.,]/g, ''))} placeholder="0" /></Field>
      <Field label="Meta (S/)" hint={isEf ? `Déjalo vacío para usar 3 meses de gastos esenciales (${fmt0(auto)}).` : undefined}>
        <input className="input" style={inputStyle} inputMode="decimal" value={target} onChange={e => setTarget(e.target.value.replace(/[^0-9.,]/g, ''))} placeholder={isEf ? String(auto) : '0'} />
      </Field>
      <div className="row-sub">El aporte mensual es el presupuesto de la carpeta "{folderName(g0.id)}" ({fmt0(s.budgets[g0.id])}). Cámbialo en Carpetas.</div>
      <button type="submit" className="btn btn-primary btn-block" style={{ height: 46, borderRadius: 12 }}>Guardar</button>
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

function Settings({ store }: { store: Store }) {
  const { s } = store;
  const [income, setIncome] = useState(s.income);
  return (
    <>
      <div style={{ fontSize: 20, fontWeight: 500 }}>Ajustes</div>

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
