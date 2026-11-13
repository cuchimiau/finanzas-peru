import { fmt, fmt0, pct } from '../domain/format';
import { Icon, pressable } from '../components/common';
import { syncLabel } from '../components/ConnectForm';
import { Metrics } from './Metrics';
import type { Derived } from '../state/selectors';
import type { Store } from '../state/store';

const cap = (x: string) => x[0].toUpperCase() + x.slice(1);

export function Home({ store, d }: { store: Store; d: Derived }) {
  const { s } = store, m = d.m, mo = d.money;
  return (
    <div className="rise" style={{ padding: '8px 20px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 40 }}>
          <span style={{ fontSize: 15, fontWeight: 600 }}>{m.name} de {m.now.getFullYear()}</span>
          <button className="btn btn-icon btn-secondary" aria-label="Asesor" onClick={() => store.goTab('advisor')} style={{ width: 38, height: 38, borderRadius: 19, fontSize: 18, color: 'var(--color-accent-300)' }}><Icon name="ph-fill ph-sparkle" /></button>
        </div>
        <div className="page-title" style={{ marginTop: 4 }}>Analítica</div>
        <div style={{ fontSize: 13, color: 'var(--color-neutral-500)', marginTop: 4 }}>Hola{s.profile.name ? ', ' + s.profile.name.split(' ')[0] : ''} · {m.todayL}</div>
        <button type="button" className="link-btn" onClick={() => (s.conn ? void store.pull() : store.goTab('settings'))} style={{ fontSize: 12, color: 'var(--color-neutral-500)', display: 'flex', alignItems: 'center', gap: 5, marginTop: 4 }}>
          <Icon name="ph-fill ph-circle" style={{ fontSize: 7, color: s.conn && s.sync !== 'error' ? (s.sync === 'offline' ? 'var(--color-over)' : 'var(--color-positive)') : 'var(--color-neutral-600)' }} />
          {syncLabel(s)}
        </button>
      </div>

      {mo.known ? (
        <div className="surface" style={{ padding: '16px 16px 14px' }}>
          <div style={{ fontSize: 13, color: 'var(--color-neutral-500)' }}>{mo.todayLeft >= 0 ? 'Te queda para hoy' : 'Hoy te pasaste'}</div>
          <div className="tnum" style={{ fontSize: 48, fontWeight: 600, letterSpacing: '-0.03em', lineHeight: 1.05, marginTop: 4, color: mo.todayLeft < 0 ? 'var(--color-negative)' : undefined }}>
            {mo.todayLeft < 0 && <Icon name="ph ph-warning-circle" style={{ fontSize: 34, marginRight: 6, verticalAlign: 'middle' }} />}{fmt(Math.abs(mo.todayLeft))}
          </div>
          <div style={{ fontSize: 13, color: 'var(--color-neutral-500)', marginTop: 6, lineHeight: 1.45 }}>
            {mo.todaySpent > 0
              ? (mo.todayLeft >= 0 ? `De ${fmt(mo.perDay)} para hoy · gastaste ${fmt(mo.todaySpent)}` : `Gastaste ${fmt(mo.todaySpent)} de ${fmt(mo.perDay)}. Desde mañana: ${fmt(mo.nextPerDay)} por día`)
              : `Tienes ${fmt(mo.perDay)} por día`}
            <br />
            {mo.salaryPending && mo.payday && mo.payday > m.now.getDate()
              ? `${fmt0(mo.free)} disponibles hasta tu sueldo del ${mo.payday} · ${mo.days === 1 ? 'último día' : `${mo.days} días`}`
              : `${fmt0(Math.min(mo.free, d.flexLeft))} para gastar · ${m.daysLeft === 1 ? 'último día del mes' : `${m.daysLeft} días para fin de mes`}`}
            {mo.reservedTotal > 0 && <><br /><button type="button" className="link-btn" onClick={() => store.openSheet('close')} style={{ fontSize: 13, color: 'var(--color-neutral-400)', textAlign: 'left' }}>Ya separé {fmt0(mo.reservedTotal)} para {mo.reserved.map(r => r.name).join(', ')} · cambiar ›</button></>}
          </div>
        </div>
      ) : (
        <div className="accent-card" style={{ padding: 16 }}>
          <div style={{ fontSize: 17, fontWeight: 500 }}>¿Cuánto dinero tienes hoy?</div>
          <div style={{ fontSize: 13, color: 'var(--color-neutral-300)', lineHeight: 1.45, marginTop: 4 }}>Para calcular cuánto puedes gastar por día uso tu dinero real, no supongo que ya te pagaron.</div>
          <button type="button" className="btn btn-primary btn-block" onClick={() => store.openSheet('close')} style={{ height: 42, borderRadius: 11, marginTop: 10 }}>Escribir mi dinero de hoy</button>
        </div>
      )}

      {mo.known && (
        <div className="surface" style={{ padding: 14 }}>
          <div {...pressable(() => store.openSheet('close'))}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 10 }}>
              <span style={{ color: 'var(--color-neutral-400)' }}>{cap(m.name)} · tienes <b className="tnum" style={{ color: 'var(--color-text)' }}>{fmt0(mo.real)}</b></span>
              <span style={{ color: 'var(--color-accent-300)' }}>{m.pctL} del mes</span>
            </div>
            <div className="stack-bar" style={{ height: 8, borderRadius: 4, background: 'var(--color-neutral-900)' }}>
              <div style={{ width: pct(mo.spent, mo.total), background: 'var(--color-neutral-300)' }} />
              <div style={{ width: pct(Math.max(0, mo.real), mo.total), background: 'var(--color-accent)' }} />
            </div>
            <div style={{ display: 'flex', gap: 16, marginTop: 10, fontSize: 12, color: 'var(--color-neutral-400)', flexWrap: 'wrap' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span className="dot" style={{ background: 'var(--color-neutral-300)' }} />Gastado {fmt0(mo.spent)}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span className="dot" style={{ background: 'var(--color-accent)' }} />Te queda {fmt0(mo.real)}</span>
              <span>de {fmt0(mo.total)}{mo.salaryIn ? ' (con sueldo)' : ''}{mo.extraIn ? ` · extra ${fmt0(mo.extraIn)}` : ''}</span>
            </div>
          </div>
          {mo.salaryPending && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12, paddingTop: 12, borderTop: '0.5px solid var(--color-divider)' }}>
              <Icon name="ph ph-hourglass-medium" style={{ fontSize: 18, color: 'var(--color-neutral-400)' }} />
              <div className="row-main">
                <div className="row-title" style={{ fontSize: 13.5 }}>Sueldo pendiente{d.salary ? ` · ${fmt0(d.salary)}` : ''}</div>
                <div className="row-sub">{mo.payday ? `Lo esperas el ${mo.payday}. No lo cuento hasta que llegue.` : 'No lo cuento hasta que llegue.'}</div>
              </div>
              <button type="button" className="btn btn-secondary" onClick={() => store.openSheet('paid')} style={{ height: 32, borderRadius: 9, padding: '0 11px', fontSize: 13 }}>Ya me pagaron</button>
            </div>
          )}
        </div>
      )}

      <Metrics store={store} d={d} embedded />
    </div>
  );
}
