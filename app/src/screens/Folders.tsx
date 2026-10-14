import { useState } from 'react';
import { FM, GM, type Card, type FolderId, type Tx } from '../domain/data';
import { fmt, fmt0 } from '../domain/format';
import { minPayments, payInfo } from '../domain/cards';
import { autoCover, suggestSources, type Take } from '../domain/plan';
import { spentMap } from '../state/store';
import { FolderRow, Icon, Track, TxRow } from '../components/common';
import type { Derived } from '../state/selectors';
import type { Store } from '../state/store';

export function Folders({ store, d }: { store: Store; d: Derived }) {
  return store.s.folderId ? <FolderDetail store={store} d={d} id={store.s.folderId} /> : <FolderList store={store} d={d} />;
}

function FolderList({ store, d }: { store: Store; d: Derived }) {
  return (
    <div className="rise" style={{ padding: '8px 20px 28px' }}>
      <div className="page-title">Carpetas</div>
      <div style={{ fontSize: 13, color: 'var(--color-neutral-500)', marginTop: 2 }}>{fmt0(d.income)} asignados · S/ 0 sin destino</div>
      {d.groupRows.map(g => (
        <div key={g.id} style={{ marginTop: 22 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--color-neutral-500)', marginBottom: 2 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span className="dot" style={{ background: g.color }} />{g.label}</span>
            <span className="tnum">{g.amtL}</span>
          </div>
          {g.items.map(f => <FolderRow key={f.id} f={f} divider onOpen={() => store.openFolder(f.id)} />)}
        </div>
      ))}
    </div>
  );
}

const TAXI = /uber|cabify|indrive|didi/i;

/** Consejo calculado con los movimientos reales del mes (nada inventado). */
function tipFor(id: FolderId, tx: Tx[], cards: Card[], d: Derived): string {
  const total = tx.reduce((a, t) => a + t.amt, 0);
  const v = d.VM[id];
  switch (id) {
    case 'restaurantes': {
      if (!tx.length) break;
      const credit = tx.filter(t => payInfo(t.pay, cards).credit).reduce((a, t) => a + t.amt, 0);
      const weekend = tx.filter(t => [0, 5, 6].includes(new Date(t.date).getDay())).reduce((a, t) => a + t.amt, 0);
      return `${Math.round((weekend / total) * 100)}% de lo que gastas aquí es de viernes a domingo y ${Math.round((credit / total) * 100)}% lo pagas con crédito.` + (credit > 0 ? ' Paga con débito para que no se vuelva deuda.' : '');
    }
    case 'suscripciones': {
      if (!tx.length) return 'Registra aquí tus servicios mensuales (Netflix, Spotify, iCloud…) para ver cuánto suman.';
      const names = Array.from(new Set(tx.map(t => t.name)));
      return `Este mes: ${names.slice(0, 4).join(', ')}${names.length > 4 ? '…' : ''} suman ${fmt(total)}. Revisa si usas todas; los planes compartidos suelen costar menos.`;
    }
    case 'transporte': {
      const taxi = tx.filter(t => TAXI.test(t.name));
      if (taxi.length) return `${taxi.length} ${taxi.length === 1 ? 'viaje' : 'viajes'} en taxi por app este mes (${fmt(taxi.reduce((a, t) => a + t.amt, 0))}). Es lo primero que conviene recortar si esta carpeta se aprieta.`;
      break;
    }
    case 'emergencia': return 'Este dinero va a una cuenta de ahorro aparte. No lo toques salvo emergencias reales.';
    case 'deudas': return d.debts.length ? `Con ${fmt0(v.budget)} al mes pagas primero ${d.debts.slice().sort((a, b) => b.tcea - a.tcea)[0].name}, la de mayor TCEA. Pagar solo el mínimo te tomaría mucho más.` : 'No tienes deudas de tarjeta registradas. Si te sobra aquí, pásalo a tu fondo de emergencia.';
    case 'viaje': return v.budget ? 'Se aparta cada mes hacia tu meta de viaje.' : 'Sin aporte todavía. Pídele a tu asesor un plan con tu gratificación.';
    case 'inversion': return 'Aporte mensual para tu meta de inversión. Súbelo cuando termines de pagar tus tarjetas.';
    case 'libre': return 'Libre es tu colchón de gasto sin culpa. Lo que liberas en otras carpetas llega aquí.';
  }
  if (!v.flow) return 'Va de acuerdo al plan.';
  if (!tx.length) return 'Aún no hay gastos aquí este mes.';
  return v.r > d.m.pct + 0.15 ? `Vas más rápido que el mes: ${Math.round(v.r * 100)}% gastado con ${d.m.pctL} recorrido.` : 'Vas a buen ritmo. Te aviso si cambia.';
}


function FolderDetail({ store, d, id }: { store: Store; d: Derived; id: FolderId }) {
  const { s } = store;
  const fo = d.VM[id];
  const monthTx = d.monthTxs.filter(t => t.f === id);
  const tx = s.txs.filter(t => t.f === id).slice(0, 30);
  return (
    <div style={{ padding: '4px 20px 28px', animation: 'rise .3s ease' }}>
      <button onClick={store.closeFolder} className="link-btn" style={{ fontSize: 15, display: 'flex', alignItems: 'center', gap: 4, padding: '6px 0', marginLeft: -4 }}>
        <Icon name="ph ph-caret-left" />Carpetas
      </button>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
        <div className="ibox xl"><Icon name={fo.icon} /></div>
        <div><div style={{ fontSize: 20, fontWeight: 500 }}>{fo.name}</div><div className="row-sub">{GM[fo.grp].label}</div></div>
      </div>
      <div className="tnum" style={{ fontSize: 44, fontWeight: 500, letterSpacing: '-0.02em', marginTop: 18, color: fo.leftColor }}>{fo.leftL}</div>
      <div style={{ fontSize: 13, color: 'var(--color-neutral-400)' }}>{fo.leftLabel} · {fo.ofL}</div>
      <Track w={fo.barW} color={fo.barColor} height={6} style={{ margin: '14px 0 6px' }} />
      <div className="row-sub">{fo.flow ? `Llevas ${Math.round(fo.r * 100)}% gastado con ${d.m.pctL} del mes recorrido.` : 'Se aparta al recibir tu sueldo, antes de gastar.'}</div>

      <div className="hint-card" style={{ marginTop: 16, display: 'flex', gap: 10, fontSize: 13, lineHeight: 1.45, color: 'var(--color-neutral-300)' }}>
        <Icon name="ph ph-sparkle" style={{ fontSize: 17, color: 'var(--color-accent-300)', marginTop: 1 }} />
        <span>{tipFor(id, monthTx, s.cards, d)}</span>
      </div>

      <BudgetEditor key={`${id}-${s.budgets[id]}`} store={store} id={id} />

      <div className="section-title" style={{ margin: '22px 0 4px' }}>Movimientos</div>
      {tx.map(t => <TxRow key={t.id} t={d.txView(t)} variant="folder" onOpen={() => store.openRecat(t.id)} />)}
      {tx.length === 0 && (
        <div style={{ fontSize: 13, color: 'var(--color-neutral-500)', padding: '8px 0' }}>
          {fo.flow ? 'Aún no hay movimientos este mes.' : 'Se aparta automáticamente el día de pago.'}
        </div>
      )}
    </div>
  );
}

/** Editor del presupuesto: monto exacto, pasos de 10/50 y de dónde sale (o a dónde va) la diferencia. */
function BudgetEditor({ store, id }: { store: Store; id: FolderId }) {
  const { s } = store;
  const cur = s.budgets[id];
  const [target, setTarget] = useState(cur);
  const [text, setText] = useState(String(cur));
  const [takes, setTakes] = useState<Take[]>([]);
  const [to, setTo] = useState<FolderId>('libre');
  const spent = spentMap(s.txs);
  const minDebt = minPayments(s.cards);
  const sources = suggestSources(s.budgets, spent, id, minDebt);
  const diff = target - cur;
  const taken = takes.reduce((a, t) => a + t.monto, 0);
  const libreAuto = id === 'libre' ? 0 : Math.max(0, Math.min(diff - taken, s.budgets.libre - (takes.find(t => t.de === 'libre')?.monto ?? 0)));
  const need = Math.max(0, diff - taken - libreAuto);
  const floor = Math.max(spent[id] || 0, id === 'deudas' ? minDebt : 0);

  const setAmt = (v: number) => { const n = Math.max(0, Math.round(v)); setTarget(n); setText(String(n)); setTakes([]); setTo('libre'); };
  const take = (de: FolderId, max: number) => {
    const m = Math.min(max - (takes.find(t => t.de === de)?.monto ?? 0), need);
    if (m <= 0) return;
    setTakes(ts => { const i = ts.findIndex(t => t.de === de); return i >= 0 ? ts.map((t, j) => (j === i ? { ...t, monto: t.monto + m } : t)) : [...ts, { de, monto: m }]; });
  };
  const auto = () => setTakes(autoCover(sources.filter(x => x.id !== 'libre').map(x => ({ ...x, available: x.available - (takes.find(t => t.de === x.id)?.monto ?? 0) })), need).reduce((acc, t) => {
    const i = acc.findIndex(a => a.de === t.de); if (i >= 0) acc[i] = { ...acc[i], monto: acc[i].monto + t.monto }; else acc.push(t); return acc;
  }, takes.slice()));
  const apply = () => { if (store.setBudget(id, target, takes, to)) { setTakes([]); setTo('libre'); } };
  const reset = () => setAmt(cur);

  const stepBtn = (delta: number, label: string) => (
    <button type="button" className="btn btn-secondary" onClick={() => setAmt(target + delta)} disabled={target + delta < 0} style={{ height: 32, borderRadius: 9, padding: '0 10px', fontSize: 13 }}>{label}</button>
  );

  return (
    <div style={{ marginTop: 14, padding: '12px 14px', borderRadius: 14, background: 'var(--color-surface)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <span style={{ fontSize: 14 }}>Presupuesto</span>
        <label className="amount-field" style={{ gap: 4, paddingBottom: 2, width: 130 }}>
          <span style={{ fontSize: 16, color: 'var(--color-neutral-500)' }}>S/</span>
          <span className="visually-hidden">Presupuesto de {FM[id].name}</span>
          <input type="text" inputMode="numeric" value={text} style={{ fontSize: 22, textAlign: 'right' }}
            onChange={e => { const v = e.target.value.replace(/[^0-9]/g, '').slice(0, 6); setText(v); setTarget(Number(v) || 0); setTakes([]); setTo('libre'); }} />
        </label>
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 10, justifyContent: 'flex-end' }}>
        {stepBtn(-50, '−50')}{stepBtn(-10, '−10')}{stepBtn(10, '+10')}{stepBtn(50, '+50')}
      </div>

      {diff !== 0 && target < floor && (
        <div role="alert" style={{ fontSize: 12.5, color: 'var(--color-accent-300)', marginTop: 10 }}>
          No puede bajar de {fmt0(floor)} ({id === 'deudas' ? 'los mínimos de tus tarjetas' : 'lo que ya gastaste este mes'}).
        </div>
      )}

      {diff > 0 && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--color-divider)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 13.5 }}>
            <span style={{ fontWeight: 500 }}>{need > 0 ? `Faltan ${fmt0(need)} · ¿de dónde lo saco?` : 'Cubierto ✓'}</span>
            {need > 0 && <button type="button" className="link-btn" onClick={auto}>Cubrir automáticamente</button>}
          </div>
          {libreAuto > 0 && <div className="row-sub" style={{ marginTop: 4 }}>{fmt0(libreAuto)} salen de Libre.</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
            {sources.filter(x => x.id !== 'libre' && (need > 0 || takes.some(t => t.de === x.id))).map(x => {
              const used = takes.find(t => t.de === x.id)?.monto ?? 0;
              const can = Math.min(x.available - used, need);
              return (
                <div key={x.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 10, background: 'var(--color-bg)' }}>
                  <div className="row-main">
                    <div style={{ fontSize: 13.5 }}>{FM[x.id].name}{x.warn && <span style={{ color: 'var(--color-accent-300)', fontSize: 11.5 }}> · cuidado</span>}</div>
                    <div className="row-sub">{used ? `Tomas ${fmt0(used)} · ` : ''}disponible {fmt0(x.available - used)}</div>
                  </div>
                  <button type="button" className="btn btn-secondary" disabled={can <= 0} onClick={() => take(x.id, x.available)} style={{ height: 32, borderRadius: 9, padding: '0 10px', fontSize: 12.5 }}>
                    {can > 0 ? `Tomar ${fmt0(can)}` : used ? 'Listo' : '—'}
                  </button>
                </div>
              );
            })}
            {sources.length === 0 && <div className="row-sub">No hay dinero disponible en otras carpetas este mes.</div>}
          </div>
          {takes.length > 0 && <button type="button" className="link-btn" onClick={() => setTakes([])} style={{ marginTop: 8, fontSize: 12.5 }}>Deshacer selección</button>}
        </div>
      )}

      {diff < 0 && target >= floor && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--color-divider)' }}>
          <div style={{ fontSize: 13.5, fontWeight: 500, marginBottom: 8 }}>Los {fmt0(-diff)} que liberas van a:</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {(['libre', 'emergencia', 'deudas', 'inversion', 'viaje', 'restaurantes', 'mercado'] as FolderId[]).filter(x => x !== id).map(x => (
              <button type="button" key={x} className={'chip' + (to === x ? ' on' : '')} aria-pressed={to === x} onClick={() => setTo(x)} style={{ height: 32, fontSize: 12.5, padding: '0 11px' }}>{FM[x].name}</button>
            ))}
          </div>
        </div>
      )}

      {diff !== 0 && (
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button type="button" className="btn btn-ghost" onClick={reset} style={{ flex: 1, height: 40, borderRadius: 10 }}>Cancelar</button>
          <button type="button" className="btn btn-primary" onClick={apply} disabled={target < floor || (diff > 0 && need > 0)} style={{ flex: 2, height: 40, borderRadius: 10 }}>
            Aplicar · {fmt0(target)}
          </button>
        </div>
      )}
      <div className="row-sub" style={{ marginTop: 8 }}>{diff === 0 ? (s.adjustNote || 'Escribe el monto o usa los botones. El total siempre es igual a tu sueldo.') : ''}</div>
    </div>
  );
}
