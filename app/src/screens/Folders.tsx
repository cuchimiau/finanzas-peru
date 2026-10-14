import { GM, type Card, type FolderId, type Tx } from '../domain/data';
import { fmt, fmt0 } from '../domain/format';
import { payInfo } from '../domain/cards';
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

const STEP = 10;

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

      <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderRadius: 14, background: 'var(--color-surface)' }}>
        <span style={{ fontSize: 14 }}>Presupuesto</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button className="btn btn-icon btn-secondary" aria-label={`Bajar S/ ${STEP}`} onClick={() => store.adjustBudget(-STEP)} style={{ width: 34, height: 34, borderRadius: 10 }}><Icon name="ph ph-minus" /></button>
          <span className="tnum" style={{ fontSize: 15, fontWeight: 500, minWidth: 72, textAlign: 'center' }} aria-live="polite">{fmt0(fo.budget)}</span>
          <button className="btn btn-icon btn-secondary" aria-label={`Subir S/ ${STEP}`} onClick={() => store.adjustBudget(STEP)} style={{ width: 34, height: 34, borderRadius: 10 }}><Icon name="ph ph-plus" /></button>
        </div>
      </div>
      <div className="row-sub" style={{ marginTop: 6, paddingLeft: 2 }}>{s.adjustNote || 'Al ajustar, la diferencia sale de Libre o vuelve a Libre.'}</div>

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
