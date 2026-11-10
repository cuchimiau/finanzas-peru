import { fmt, fmt0, pct } from '../domain/format';
import { Icon, SectionHeader, TxRow, pressable } from '../components/common';
import { syncLabel } from '../components/ConnectForm';
import type { Derived } from '../state/selectors';
import type { Store } from '../state/store';

const cap = (x: string) => x[0].toUpperCase() + x.slice(1);

export function Home({ store, d }: { store: Store; d: Derived }) {
  const { s } = store, m = d.m, mo = d.money;
  const hotPct = d.hot ? Math.round(d.hot.r * 100) : 0;
  const askHot = () => d.hot && store.ask(`${d.hot.name} va al ${hotPct}% y apenas llevo ${m.pctL} del mes. Propón un ajuste sin tocar mi ahorro ni el pago de tarjetas.`);
  // Dos sectores: todo lo de hoy y los últimos de días anteriores.
  const isToday = (iso: string) => { const a = new Date(iso), n = m.now; return a.getFullYear() === n.getFullYear() && a.getMonth() === n.getMonth() && a.getDate() === n.getDate(); };
  const today = s.txs.filter(t => isToday(t.date));
  const before = s.txs.filter(t => !isToday(t.date)).slice(0, Math.max(5, 10 - today.length));
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

      {mo.known ? (
        <div>
          <div style={{ fontSize: 13, color: 'var(--color-neutral-400)' }}>{mo.todayLeft >= 0 ? 'Te queda para hoy' : 'Hoy te pasaste'}</div>
          <div className="tnum" style={{ fontSize: 52, fontWeight: 500, letterSpacing: '-0.03em', lineHeight: 1.05, marginTop: 4, color: mo.todayLeft < 0 ? 'var(--color-accent-300)' : undefined }}>
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
        <div {...pressable(() => store.openSheet('close'))} style={{ padding: 14, borderRadius: 14, background: 'var(--color-surface)', boxShadow: 'var(--shadow-sm)' }}>
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
      )}

      {mo.known && mo.salaryPending && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 14, border: '1px dashed var(--color-neutral-700)' }}>
          <Icon name="ph ph-hourglass-medium" style={{ fontSize: 20, color: 'var(--color-neutral-300)' }} />
          <div className="row-main">
            <div className="row-title">Sueldo pendiente{d.salary ? ` · ${fmt0(d.salary)}` : ''}</div>
            <div className="row-sub">{mo.payday ? `Lo esperas el ${mo.payday}. No lo cuento hasta que llegue.` : 'No lo cuento hasta que llegue.'}</div>
          </div>
          <button type="button" className="btn btn-secondary" onClick={() => store.openSheet('paid')} style={{ height: 34, borderRadius: 9, padding: '0 12px', fontSize: 13 }}>Ya me pagaron</button>
        </div>
      )}

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

      {s.txs.some(t => t.needsFolder) && (
        <div className="accent-card" style={{ padding: '12px 14px' }}>
          <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}><Icon name="ph ph-folder-simple-plus" style={{ color: 'var(--color-accent-300)' }} />Elige la carpeta</div>
          {s.txs.filter(t => t.needsFolder).slice(0, 5).map(t => (
            <button key={t.id} type="button" className="link-btn" onClick={() => store.openRecat(t.id)} style={{ display: 'flex', justifyContent: 'space-between', width: '100%', padding: '6px 0', fontSize: 13.5, color: 'var(--color-text)' }}>
              <span>{t.name} {fmt(t.amt)}</span><span style={{ color: 'var(--color-accent-300)' }}>Elegir ›</span>
            </button>
          ))}
        </div>
      )}

      {s.txs.some(t => t.dup) && (
        <div className="accent-card" style={{ padding: '12px 14px' }}>
          <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 2, display: 'flex', alignItems: 'center', gap: 6 }}><Icon name="ph ph-copy" style={{ color: 'var(--color-accent-300)' }} />¿Duplicado?</div>
          <div style={{ fontSize: 12.5, color: 'var(--color-neutral-400)', marginBottom: 4 }}>Mismo monto y casi a la misma hora que otro gasto.</div>
          {s.txs.filter(t => t.dup).slice(0, 5).map(t => (
            <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', fontSize: 13.5 }}>
              <span className="row-main">{t.name} {fmt(t.amt)} <span style={{ color: 'var(--color-neutral-500)' }}>≈ {t.dup}</span></span>
              <button type="button" className="link-btn" onClick={() => { store.removeTx(t.id); store.flash('Duplicado borrado'); }} style={{ color: 'var(--color-accent-300)' }}>Borrar</button>
              <button type="button" className="link-btn" onClick={() => store.keepTx(t.id)} style={{ color: 'var(--color-neutral-400)' }}>Mantener</button>
            </div>
          ))}
        </div>
      )}

      <div {...pressable(() => store.openSheet('optimize'))} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 14, border: '1px solid var(--color-accent-800)' }}>
        <Icon name="ph ph-magic-wand" style={{ fontSize: 20, color: 'var(--color-accent-300)' }} />
        <div className="row-main">
          <div className="row-title">Optimiza tu mes</div>
          <div className="row-sub">Plan de ahorro para lo que queda del mes y tu plan del próximo</div>
        </div>
        <Icon name="ph ph-caret-right" style={{ color: 'var(--color-neutral-600)' }} />
      </div>

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

      {(d.debts.length > 0 || s.cards.some(c => c.kind !== 'debit')) && (
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
        <SectionHeader title="Últimos movimientos" right={
          <button className="link-btn" onClick={() => (s.conn ? void store.pull() : store.openSheet('settings'))} style={{ fontSize: 12, color: 'var(--color-neutral-500)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Icon name="ph-fill ph-circle" style={{ fontSize: 7, color: s.conn && s.sync !== 'error' ? 'var(--color-accent)' : 'var(--color-neutral-600)' }} />
            {syncLabel(s)}
          </button>
        } />
        {s.txs.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--color-neutral-500)', padding: '10px 0', lineHeight: 1.5 }}>
            Aún no hay movimientos. Registra uno con <Icon name="ph ph-plus" /> o paga con Apple Pay si ya configuraste el Atajo.
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: 'var(--color-neutral-400)', margin: '4px 0 2px' }}>
              <span style={{ fontWeight: 500 }}>Hoy</span>{today.length > 0 && <span className="tnum">−{fmt(today.reduce((a, t) => a + t.amt, 0))}</span>}
            </div>
            {today.map(t => <TxRow key={t.id} t={d.txView(t)} variant="recent" onOpen={() => store.openRecat(t.id)} />)}
            {today.length === 0 && <div className="row-sub" style={{ padding: '6px 0 4px' }}>Aún no registraste nada hoy.</div>}
            {before.length > 0 && (
              <>
                <div style={{ fontSize: 12.5, color: 'var(--color-neutral-400)', fontWeight: 500, margin: '14px 0 2px' }}>Días anteriores</div>
                {before.map(t => <TxRow key={t.id} t={d.txView(t)} variant="recent" onOpen={() => store.openRecat(t.id)} />)}
              </>
            )}
            <button type="button" className="btn btn-secondary btn-block" onClick={() => store.openSheet('alltx')} style={{ height: 42, borderRadius: 12, marginTop: 10, gap: 6 }}>
              <Icon name="ph ph-list-bullets" />Ver todos los movimientos ({s.txs.length})
            </button>
          </>
        )}
      </div>
    </div>
  );
}
