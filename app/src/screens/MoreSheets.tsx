import { useState } from 'react';
import type { Tx } from '../domain/data';
import { fmt, fmt0, parseAmount } from '../domain/format';
import { debtPayChoices } from '../domain/cards';
import { Field, Icon, TxRow, inputStyle } from '../components/common';
import type { Derived } from '../state/selectors';
import type { Store } from '../state/store';

const todayInput = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const money = (v: string) => v.replace(/[^0-9.,]/g, '').slice(0, 10);

/** Registrar el pago de una o más deudas: cada una con su monto, todas desde el mismo medio de pago. */
export function PayDebtSheet({ store, d }: { store: Store; d: Derived }) {
  const { s } = store;
  const choices = debtPayChoices(s.cards);
  const [amts, setAmts] = useState<Record<string, string>>(() => (d.debts.length === 1 ? { [d.debts[0].id]: String(Math.min(d.debts[0].min, d.debts[0].bal) || '') } : {}));
  const [pay, setPay] = useState(choices.find(c => s.cards.some(x => x.id === c.id))?.id ?? 'cash');
  const [day, setDay] = useState(todayInput());
  const picked = d.debts.filter(x => x.id in amts);
  const total = picked.reduce((a, x) => a + parseAmount(amts[x.id]), 0);
  const toggle = (id: string, def: number) => setAmts(a => { const n = { ...a }; if (id in n) delete n[id]; else n[id] = def ? String(def) : ''; return n; });

  if (!d.debts.length) return <div className="row-sub">No tienes deudas con saldo. Agrégalas en Deudas › Deuda o tarjeta.</div>;
  return (
    <form onSubmit={e => { e.preventDefault(); store.payDebts(picked.map(x => ({ id: x.id, amt: parseAmount(amts[x.id]) })), pay, day); }} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <div style={{ fontSize: 20, fontWeight: 500 }}>Registrar pago de deudas</div>
        <div className="row-sub" style={{ marginTop: 4 }}>Marca una o varias y escribe cuánto pagaste. El saldo de cada una baja y el pago queda en "Pago de deudas".</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {d.debts.map(x => {
          const on = x.id in amts, min = Math.min(x.min, x.bal);
          return (
            <div key={x.id} className="surface" style={{ padding: 12, border: on ? '1px solid var(--color-accent-700)' : undefined }}>
              <button type="button" role="checkbox" aria-checked={on} aria-label={`Pagar ${x.name}`} onClick={() => toggle(x.id, min)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', background: 'none', border: 0, padding: 0, color: 'inherit', textAlign: 'left', cursor: 'pointer' }}>
                <span className={'option ghost' + (on ? ' on' : '')} style={{ width: 26, height: 26, padding: 0, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>{on ? '✓' : ''}</span>
                <span className="row-main">
                  <span style={{ display: 'block', fontSize: 14.5, fontWeight: 500 }}>{x.name}</span>
                  <span className="row-sub">Debes {fmt(x.bal)} · {x.kind === 'loan' ? 'cuota' : 'mínimo'} {fmt0(x.min)} · vence el {x.due}</span>
                </span>
              </button>
              {on && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                  <span className="row-sub">S/</span>
                  <input className="input tnum" inputMode="decimal" aria-label={`Monto pagado a ${x.name}`} value={amts[x.id]} onChange={e => setAmts(a => ({ ...a, [x.id]: money(e.target.value) }))}
                    style={{ width: 100, height: 38, borderRadius: 9, fontSize: 15, textAlign: 'right' }} />
                  {min > 0 && <button type="button" className="chip" style={{ height: 32, fontSize: 12.5 }} onClick={() => setAmts(a => ({ ...a, [x.id]: String(min) }))}>{x.kind === 'loan' ? 'Cuota' : 'Mínimo'} {fmt0(min)}</button>}
                  <button type="button" className="chip" style={{ height: 32, fontSize: 12.5 }} onClick={() => setAmts(a => ({ ...a, [x.id]: String(x.bal) }))}>Todo {fmt0(x.bal)}</button>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div>
        <div style={{ fontSize: 12, color: 'var(--color-neutral-400)', marginBottom: 6 }}>¿Desde dónde pagaste?</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }} role="radiogroup" aria-label="Pagado desde">
          {choices.map(c => (
            <button type="button" key={c.id} role="radio" aria-checked={pay === c.id} className={'option ghost' + (pay === c.id ? ' on' : '')} style={{ padding: '7px 11px', borderRadius: 10, fontSize: 13, gap: 5 }} onClick={() => setPay(c.id)}>
              <Icon name={c.icon} />{c.label}
            </button>
          ))}
        </div>
      </div>
      <Field label="Fecha del pago"><input className="input" type="date" style={inputStyle} value={day} max={todayInput()} onChange={e => setDay(e.target.value || todayInput())} aria-label="Fecha del pago" /></Field>
      <button type="submit" className="btn btn-primary btn-block" disabled={!picked.length || !(total > 0)} style={{ height: 46, borderRadius: 12 }}>
        {picked.length > 1 ? `Registrar ${picked.length} pagos · ${fmt(total)}` : `Registrar pago${total > 0 ? ' · ' + fmt(total) : ''}`}
      </button>
    </form>
  );
}

const dayKey = (iso: string) => { const d = new Date(iso); return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; };
function dayTitle(iso: string, now = new Date()) {
  const d = new Date(iso);
  const y = new Date(now); y.setDate(now.getDate() - 1);
  if (dayKey(iso) === dayKey(now.toISOString())) return 'Hoy';
  if (dayKey(iso) === dayKey(y.toISOString())) return 'Ayer';
  const l = d.toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long', ...(d.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}) });
  return l.charAt(0).toUpperCase() + l.slice(1);
}

/** Agrupa movimientos por día (ya vienen del más nuevo al más viejo). */
export function groupByDay(txs: Tx[]): { key: string; title: string; total: number; items: Tx[] }[] {
  const out: { key: string; title: string; total: number; items: Tx[] }[] = [];
  for (const t of txs) {
    const k = dayKey(t.date);
    let g = out[out.length - 1];
    if (!g || g.key !== k) { g = { key: k, title: dayTitle(t.date), total: 0, items: [] }; out.push(g); }
    g.items.push(t); g.total += t.amt;
  }
  return out;
}

/** Todos los movimientos, ordenados por fecha y agrupados por día, con búsqueda. */
function TxList({ store, d, screen }: { store: Store; d: Derived; screen?: boolean }) {
  const { s } = store;
  const [q, setQ] = useState('');
  const norm = (x: string) => x.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const list = q.trim() ? s.txs.filter(t => norm(t.name + ' ' + d.txView(t).folderName).includes(norm(q.trim()))) : s.txs;
  const groups = groupByDay(list);
  return (
    <div>
      {screen ? <div className="page-title">Transacciones</div> : <div style={{ fontSize: 20, fontWeight: 500 }}>Todos los movimientos</div>}
      <div className="row-sub" style={{ marginTop: 2 }}>{s.txs.length} registrados · del más reciente al más antiguo</div>
      <div style={{ position: 'relative', marginTop: 10 }}>
        <Icon name="ph ph-magnifying-glass" style={{ position: 'absolute', left: 12, top: 13, color: 'var(--color-neutral-500)', fontSize: 16 }} />
        <input className="input" style={{ ...inputStyle, paddingLeft: 34 }} value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar por lugar o carpeta" aria-label="Buscar movimientos" />
      </div>
      {groups.map(g => (
        <div key={g.key} style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--color-neutral-500)', margin: '0 4px 6px' }}>
            <span>{g.title}</span><span className="tnum">−{fmt(g.total)}</span>
          </div>
          <div className={screen ? 'surface' : ''} style={screen ? { padding: '2px 14px' } : undefined}>
            {g.items.map(t => <TxRow key={t.id} t={d.txView(t)} variant="recent" onOpen={() => store.openRecat(t.id)} />)}
          </div>
        </div>
      ))}
      {!groups.length && <div className="row-sub" style={{ marginTop: 14 }}>{q ? 'Nada coincide con tu búsqueda.' : 'Aún no hay movimientos. Regístralos con el botón + de abajo.'}</div>}
    </div>
  );
}

export const AllTxSheet = ({ store, d }: { store: Store; d: Derived }) => <TxList store={store} d={d} />;

/** Pestaña Lista (estilo Incomes): todos tus movimientos en tarjetas por día. */
export const ListScreen = ({ store, d }: { store: Store; d: Derived }) => (
  <div className="rise" style={{ padding: '8px 16px 24px' }}><TxList store={store} d={d} screen /></div>
);
