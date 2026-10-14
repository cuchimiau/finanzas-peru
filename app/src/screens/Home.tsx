import { fmt, fmt0, pct } from '../domain/format';
import { FolderRow, Icon, SectionHeader, TxRow, pressable } from '../components/common';
import { syncLabel } from '../components/ConnectForm';
import type { Derived } from '../state/selectors';
import type { Store } from '../state/store';

const cap = (x: string) => x[0].toUpperCase() + x.slice(1);

export function Home({ store, d }: { store: Store; d: Derived }) {
  const { s } = store, m = d.m;
  const hotPct = d.hot ? Math.round(d.hot.r * 100) : 0;
  const askHot = () => d.hot && store.ask(`${d.hot.name} va al ${hotPct}% y apenas llevo ${m.pctL} del mes. Propón un ajuste sin tocar mi ahorro ni el pago de tarjetas.`);
  const peek = d.flex.slice().sort((a, b) => b.r - a.r).slice(0, 4);
  const recent = s.txs.slice(0, 5);
  return (
    <div className="rise" style={{ padding: '8px 20px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 13, color: 'var(--color-neutral-500)' }}>{m.todayL}</div>
          <div style={{ fontSize: 20, fontWeight: 500, marginTop: 2 }}>Hola{s.profile.name ? ', ' + s.profile.name.split(' ')[0] : ''}</div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="btn btn-icon btn-ghost" aria-label="Ajustes" onClick={() => store.openSheet('settings')} style={{ width: 40, height: 40, borderRadius: 12, fontSize: 19 }}><Icon name="ph ph-gear-six" /></button>
          <button className="btn btn-icon btn-ghost" aria-label="Cómo leemos tus gastos" onClick={() => store.openSheet('connect')} style={{ width: 40, height: 40, borderRadius: 12, fontSize: 19 }}><Icon name="ph ph-plugs-connected" /></button>
          <button className="btn btn-icon btn-primary" aria-label="Registrar gasto" onClick={() => store.openSheet('add')} style={{ width: 40, height: 40, borderRadius: 12, fontSize: 19 }}><Icon name="ph ph-plus" /></button>
        </div>
      </div>

      <div>
        <div style={{ fontSize: 13, color: 'var(--color-neutral-400)' }}>Puedes gastar hoy</div>
        <div className="tnum" style={{ fontSize: 52, fontWeight: 500, letterSpacing: '-0.03em', lineHeight: 1.05, marginTop: 4 }}>{fmt(d.flexLeft / m.daysLeft)}</div>
        <div style={{ fontSize: 13, color: 'var(--color-neutral-500)', marginTop: 6 }}>{fmt0(d.flexLeft)} libres en tus carpetas de gasto · {m.daysLeft === 1 ? 'último día del mes' : `${m.daysLeft} días para fin de mes`}</div>
      </div>

      <div style={{ padding: 14, borderRadius: 14, background: 'var(--color-surface)', boxShadow: 'var(--shadow-sm)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 10 }}>
          <span style={{ color: 'var(--color-neutral-400)' }}>{cap(m.name)} · sueldo {fmt0(d.income)}</span>
          <span style={{ color: 'var(--color-accent-300)' }}>{m.pctL} del mes</span>
        </div>
        <div className="stack-bar" style={{ height: 8, borderRadius: 4, background: 'var(--color-neutral-900)' }}>
          <div style={{ width: pct(d.spent, d.income), background: 'var(--color-neutral-300)' }} />
          <div style={{ width: pct(d.saved, d.income), background: 'var(--color-accent)' }} />
        </div>
        <div style={{ display: 'flex', gap: 16, marginTop: 10, fontSize: 12, color: 'var(--color-neutral-400)' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span className="dot" style={{ background: 'var(--color-neutral-300)' }} />Gastado {fmt0(d.spent)}</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span className="dot" style={{ background: 'var(--color-accent)' }} />Ahorro y deudas {fmt0(d.saved)}</span>
        </div>
      </div>

      {s.txs.some(t => t.pending) && (
        <div className="accent-card" style={{ padding: '12px 14px' }}>
          <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}><Icon name="ph ph-pencil-simple-line" style={{ color: 'var(--color-accent-300)' }} />Completa el monto</div>
          {s.txs.filter(t => t.pending).slice(0, 5).map(t => (
            <button key={t.id} type="button" className="link-btn" onClick={() => store.openRecat(t.id)} style={{ display: 'flex', justifyContent: 'space-between', width: '100%', padding: '6px 0', fontSize: 13.5, color: 'var(--color-text)' }}>
              <span>{t.name}</span><span style={{ color: 'var(--color-accent-300)' }}>Escribir monto ›</span>
            </button>
          ))}
        </div>
      )}

      {d.hot && (
        <div {...pressable(askHot)} style={{ padding: 14, borderRadius: 14, border: '1px solid var(--color-accent-700)', background: 'linear-gradient(160deg, var(--color-accent-900), transparent)', display: 'flex', gap: 12 }}>
          <Icon name="ph ph-sparkle" style={{ fontSize: 20, color: 'var(--color-accent-300)', marginTop: 1 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>{d.hot.name} va al {hotPct}% con {m.pctL} del mes</div>
            <div style={{ fontSize: 13, lineHeight: 1.45, color: 'var(--color-neutral-300)' }}>Pídele a tu asesor un ajuste que no toque tu ahorro.</div>
            <div style={{ fontSize: 13, color: 'var(--color-accent-300)', marginTop: 8, display: 'flex', alignItems: 'center', gap: 4 }}>Pedir propuesta <Icon name="ph ph-arrow-right" /></div>
          </div>
        </div>
      )}

      {(d.debts.length > 0 || s.cards.some(c => c.kind === 'credit')) && (
        <div {...pressable(() => store.goTab('debts'))} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 14, background: 'var(--color-surface)' }}>
          <Icon name="ph ph-credit-card" style={{ fontSize: 20, color: 'var(--color-neutral-300)' }} />
          <div className="row-main">
            <div className="row-title">{d.debts.length ? `Deuda ${fmt0(d.debtTotal)}` : 'Sin deuda en tarjetas'}</div>
            <div className="row-sub">{d.debtFreeL} · {fmt(d.creditMonth)} cargados a crédito este mes</div>
          </div>
          <Icon name="ph ph-caret-right" style={{ color: 'var(--color-neutral-600)' }} />
        </div>
      )}

      <div>
        <SectionHeader title="Carpetas de gasto" right={<button className="link-btn" onClick={() => store.goTab('folders')}>Ver las {d.folderCount}</button>} />
        {peek.map(f => <FolderRow key={f.id} f={f} onOpen={() => store.openFolder(f.id)} />)}
      </div>

      <div>
        <SectionHeader title="Últimos movimientos" right={
          <button className="link-btn" onClick={() => (s.conn ? void store.pull() : store.openSheet('settings'))} style={{ fontSize: 12, color: 'var(--color-neutral-500)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Icon name="ph-fill ph-circle" style={{ fontSize: 7, color: s.conn && s.sync !== 'error' ? 'var(--color-accent)' : 'var(--color-neutral-600)' }} />
            {syncLabel(s)}
          </button>
        } />
        {recent.map(t => <TxRow key={t.id} t={d.txView(t)} variant="recent" onOpen={() => store.openRecat(t.id)} />)}
        {recent.length === 0 && (
          <div style={{ fontSize: 13, color: 'var(--color-neutral-500)', padding: '10px 0', lineHeight: 1.5 }}>
            Aún no hay movimientos. Registra uno con <Icon name="ph ph-plus" /> o paga con Apple Pay si ya configuraste el Atajo.
          </div>
        )}
      </div>
    </div>
  );
}
