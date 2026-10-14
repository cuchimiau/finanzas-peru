import { PRIOS } from '../domain/data';
import { fmt0 } from '../domain/format';
import { essentials } from '../domain/plan';
import { Field, Icon, Spinner, inputStyle, pressable } from '../components/common';
import { ConnectForm } from '../components/ConnectForm';
import type { Store } from '../state/store';
import type { Derived } from '../state/selectors';

const STEPS = 5;

export function Onboarding({ store, d }: { store: Store; d: Derived }) {
  const { s } = store;
  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', padding: '12px 24px 34px' }}>
      <div style={{ display: 'flex', gap: 6, marginBottom: 26 }} aria-label={`Paso ${s.step + 1} de ${STEPS}`}>
        {Array.from({ length: STEPS }, (_, i) => (
          <div key={i} style={{ height: 3, flex: 1, borderRadius: 2, background: i <= s.step ? 'var(--color-accent)' : 'var(--color-neutral-800)' }} />
        ))}
      </div>
      {s.step === 0 && <Welcome store={store} />}
      {s.step === 1 && <ProfileStep store={store} />}
      {s.step === 2 && <CardsStep store={store} />}
      {s.step === 3 && (s.analyzing ? <Analyzing /> : <PlanStep store={store} d={d} />)}
      {s.step === 4 && <ConnectStep store={store} />}
    </div>
  );
}

const col = { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' as const, animation: 'rise .4s ease' };

const Back = ({ store }: { store: Store }) => (
  <button type="button" className="link-btn" onClick={store.backOnb} style={{ fontSize: 14, display: 'flex', alignItems: 'center', gap: 4, alignSelf: 'flex-start', marginBottom: 10 }}>
    <Icon name="ph ph-caret-left" />Atrás
  </button>
);

function Welcome({ store }: { store: Store }) {
  const bullets: [string, string][] = [
    ['ph ph-chart-pie-slice', 'Plan base cero, con gratificación y CTS'],
    ['ph ph-apple-logo', 'Tus pagos con Apple Pay se registran solos'],
    ['ph ph-google-drive-logo', 'Todo se guarda en tu Google Drive'],
    ['ph ph-sparkle', 'Asesor personal con IA (Gemini)'],
  ];
  return (
    <div style={col}>
      <div style={{ width: 52, height: 52, borderRadius: 14, border: '1px solid var(--color-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, color: 'var(--color-accent-300)', boxShadow: '0 0 30px var(--color-accent-800)' }}>
        <Icon name="ph ph-folders" />
      </div>
      <h1 style={{ fontSize: 34, lineHeight: 1.1, fontWeight: 500, letterSpacing: '-0.02em', margin: '28px 0 12px', textWrap: 'pretty' }}>Cada sol, en su carpeta.</h1>
      <p style={{ fontSize: 16, lineHeight: 1.5, color: 'var(--color-neutral-400)', margin: 0, textWrap: 'pretty' }}>
        Calculamos tu plan óptimo con tus datos, repartimos tu sueldo en carpetas y registramos cada pago que haces con tu iPhone. Tu asesor lo ajusta contigo.
      </p>
      <div style={{ marginTop: 32, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {bullets.map(([icon, text]) => (
          <div key={text} style={{ display: 'flex', gap: 12, alignItems: 'center', fontSize: 14, color: 'var(--color-neutral-300)' }}>
            <Icon name={icon} style={{ fontSize: 20, color: 'var(--color-accent-300)' }} />{text}
          </div>
        ))}
      </div>
      <div style={{ flex: 1 }} />
      <button className="btn btn-primary btn-block btn-cta" onClick={store.nextOnb}>Crear mi plan</button>
    </div>
  );
}

function ProfileStep({ store }: { store: Store }) {
  const { s } = store;
  return (
    <div style={col}>
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        <Back store={store} />
        <div className="eyebrow">Paso 1 de 4</div>
        <h2 style={{ fontSize: 26, fontWeight: 500, margin: '8px 0 18px', letterSpacing: '-0.01em' }}>Cuéntanos de ti</h2>
        <Field label="¿Cómo te llamas?">
          <input className="input" style={inputStyle} value={s.profile.name} onChange={e => store.setName(e.target.value)} autoComplete="given-name" placeholder="Tu nombre" />
        </Field>
        <div style={{ fontSize: 15, color: 'var(--color-neutral-300)', margin: '24px 0 10px' }}>¿Cuánto te depositan al mes?</div>
        <label className="amount-field">
          <span style={{ fontSize: 30, color: 'var(--color-neutral-500)' }}>S/</span>
          <span className="visually-hidden">Sueldo neto mensual en soles</span>
          <input type="text" inputMode="numeric" autoComplete="off" placeholder="0" value={s.income} onChange={e => store.setIncome(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') store.nextOnb(); }} style={{ fontSize: 40 }} />
          <span style={{ fontSize: 13, color: 'var(--color-neutral-500)' }}>neto</span>
        </label>
        <div style={{ fontSize: 12.5, color: 'var(--color-neutral-500)', marginTop: 8 }}>Después de AFP u ONP y renta de 5ta. Gratificación y CTS se planifican aparte.</div>
        <div style={{ fontSize: 15, color: 'var(--color-neutral-300)', margin: '24px 0 12px' }}>¿Qué te importa ahora?</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {PRIOS.map(p => (
            <button key={p.id} className={'chip' + (s.prios[p.id] ? ' on' : '')} aria-pressed={s.prios[p.id]} onClick={() => store.togglePrio(p.id)}>
              <Icon name={p.icon} />{p.label}
            </button>
          ))}
        </div>
      </div>
      <button className="btn btn-primary btn-block btn-cta" style={{ marginTop: 14 }} onClick={store.nextOnb}>Siguiente</button>
    </div>
  );
}

function CardsStep({ store }: { store: Store }) {
  const { s } = store;
  return (
    <div style={col}>
      <Back store={store} />
      <div className="eyebrow">Paso 2 de 4</div>
      <h2 style={{ fontSize: 26, fontWeight: 500, margin: '8px 0 6px', letterSpacing: '-0.01em' }}>Tus tarjetas</h2>
      <p style={{ fontSize: 14, color: 'var(--color-neutral-400)', margin: '0 0 16px', lineHeight: 1.5 }}>
        Las de crédito arman tu plan de deudas (saldo, TCEA, mínimo y día de pago). Las de débito sirven para saber con qué pagas. Puedes agregarlas después.
      </p>
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {s.cards.map(c => (
          <div key={c.id} {...pressable(() => store.openCard(c.id))} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 14, background: 'var(--color-surface)' }}>
            <div className="ibox dark"><Icon name={c.applePay ? 'ph ph-apple-logo' : 'ph ph-credit-card'} /></div>
            <div className="row-main">
              <div className="row-title">{c.name}</div>
              <div className="row-sub">{c.kind === 'credit' ? `Crédito · debes ${fmt0(c.bal)} · TCEA ${Math.round(c.tcea * 100)}%` : 'Débito'}</div>
            </div>
            <Icon name="ph ph-caret-right" style={{ color: 'var(--color-neutral-600)' }} />
          </div>
        ))}
        <button type="button" className="btn btn-secondary" onClick={() => store.openCard(null)} style={{ height: 46, borderRadius: 12, gap: 6 }}>
          <Icon name="ph ph-plus" />Agregar tarjeta
        </button>
      </div>
      <button className="btn btn-primary btn-block btn-cta" style={{ marginTop: 14 }} onClick={store.nextOnb}>{s.cards.length ? 'Calcular plan óptimo' : 'Sin tarjetas por ahora'}</button>
    </div>
  );
}

const Analyzing = () => (
  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, color: 'var(--color-accent-300)' }} role="status">
    <Spinner size={34} />
    <div style={{ fontSize: 15, color: 'var(--color-neutral-300)' }}>Calculando tu plan óptimo…</div>
  </div>
);

function PlanStep({ store, d }: { store: Store; d: Derived }) {
  const b = store.s.budgets, income = d.income;
  const debts = d.debts.slice().sort((x, y) => y.tcea - x.tcea);
  const debtLine = !b.deudas ? 'Sin deudas de tarjeta: ese dinero va a tu fondo de emergencia.'
    : debts.length > 1 ? `${fmt0(b.deudas)}/mes a tarjetas: primero ${debts[0].name} (TCEA ${Math.round(debts[0].tcea * 100)}%), luego ${debts.slice(1).map(x => `${x.name} (${Math.round(x.tcea * 100)}%)`).join(', ')}. Método avalancha.`
      : `${fmt0(b.deudas)}/mes a ${debts[0]?.name ?? 'tus tarjetas'}: más que el mínimo, para pagar menos intereses.`;
  const basis = [
    `Alquiler y servicios = ${income ? Math.round(((b.vivienda + b.servicios) / income) * 100) : 0}% de tu sueldo; el hogar peruano promedio destina 21% de su gasto a vivienda y servicios (INEI 2024).`,
    debtLine,
    `Fondo de emergencia hacia 3 meses de gastos esenciales (${fmt0(essentials(b) * 3)}).`,
    'Gratificación (julio y diciembre) y CTS (mayo y noviembre) se planifican aparte, para acelerar deudas y metas.',
    'Los montos son un punto de partida: ajusta cada carpeta con − y + cuando quieras.',
  ];
  return (
    <div style={col}>
      <Back store={store} />
      <div className="eyebrow">Paso 3 de 4 · Tu plan</div>
      <h2 style={{ fontSize: 24, fontWeight: 500, margin: '8px 0 16px', letterSpacing: '-0.01em', textWrap: 'pretty' }}>{fmt0(income)} repartidos en {d.folderCount} carpetas</h2>
      <div className="stack-bar" style={{ height: 10, borderRadius: 5, marginBottom: 8 }}>
        {d.groupRows.map(g => <div key={g.id} style={{ width: g.w, background: g.color }} />)}
      </div>
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        {d.groupRows.map(g => (
          <div key={g.id} style={{ padding: '9px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: g.color }} />
              <span style={{ fontSize: 14, fontWeight: 500, flex: 1 }}>{g.label}</span>
              <span style={{ fontSize: 13, color: 'var(--color-neutral-400)' }}>{g.pctL}</span>
              <span className="tnum" style={{ fontSize: 14, width: 72, textAlign: 'right' }}>{g.amtL}</span>
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--color-neutral-500)', paddingLeft: 16, lineHeight: 1.5 }}>{g.names || 'Sin aporte'}</div>
          </div>
        ))}
        <div style={{ marginTop: 10, padding: '12px 14px', borderRadius: 12, border: '1px solid var(--color-accent-800)' }}>
          <div style={{ fontSize: 13, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <Icon name="ph ph-sparkle" style={{ color: 'var(--color-accent-300)' }} />Por qué este plan
          </div>
          {basis.map(x => <div key={x} style={{ fontSize: 12.5, lineHeight: 1.45, color: 'var(--color-neutral-300)', padding: '4px 0' }}>{x}</div>)}
        </div>
      </div>
      <button className="btn btn-primary btn-block btn-cta" style={{ marginTop: 14 }} onClick={store.nextOnb}>Crear mis carpetas</button>
    </div>
  );
}

function ConnectStep({ store }: { store: Store }) {
  return (
    <div style={col}>
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        <Back store={store} />
        <div className="eyebrow">Paso 4 de 4</div>
        <h2 style={{ fontSize: 26, fontWeight: 500, margin: '8px 0 6px', letterSpacing: '-0.01em' }}>Guarda en tu Drive</h2>
        <p style={{ fontSize: 14, color: 'var(--color-neutral-400)', margin: '0 0 16px', lineHeight: 1.5 }}>
          Conecta el Apps Script de tu cuenta de Google: guarda tus datos en la carpeta "Finanzas Perú", activa el asesor con Gemini y recibe los pagos de Apple Pay. Si ya usabas la app, recuperamos tus datos.
        </p>
        <ConnectForm store={store} compact />
      </div>
      <button className="btn btn-primary btn-block btn-cta" style={{ marginTop: 14 }} onClick={store.finishOnb}>{store.s.conn ? 'Ir a mis finanzas' : 'Ahora no · ir a mis finanzas'}</button>
    </div>
  );
}
