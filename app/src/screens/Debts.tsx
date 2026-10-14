import { fmt, fmt0, pct } from '../domain/format';
import { payOrder, MAX_MONTHS, type Strategy } from '../domain/debts';
import { Icon, Segmented, Track, TxRow, pressable } from '../components/common';
import { endL, type Derived } from '../state/selectors';
import type { Store } from '../state/store';

const STRATS: [Strategy, string][] = [['avalanche', 'Avalancha'], ['snowball', 'Bola de nieve'], ['min', 'Solo mínimo']];

export function Debts({ store, d }: { store: Store; d: Derived }) {
  const { s } = store;
  const pay = s.budgets.deudas;
  const cur = d.sims[s.strat];
  const order = payOrder(d.debts, s.strat);
  const savedVsMin = d.sims.min.interest - d.sims.avalanche.interest;
  const note = s.strat === 'avalanche' ? `Pagas primero la deuda más cara. Ahorras ${fmt0(savedVsMin)} en intereses frente a pagar solo el mínimo.`
    : s.strat === 'snowball' ? `Pagas primero la deuda más chica para ganar impulso. Cuesta ${fmt0(Math.max(0, d.sims.snowball.interest - d.sims.avalanche.interest))} más que avalancha.`
      : 'Solo el mínimo: la deuda casi no baja porque los intereses se comen el pago.';
  const othersMin = order.slice(1).reduce((a, x) => a + x.min, 0);
  const minTotal = d.debts.reduce((a, x) => a + x.min, 0);
  const debitCards = s.cards.filter(c => c.kind === 'debit' || !d.debts.some(x => x.id === c.id));

  return (
    <div className="rise" style={{ padding: '8px 20px 28px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div className="page-title">Deudas</div>
          <div style={{ fontSize: 13, color: 'var(--color-neutral-500)', marginTop: 2 }}>Tarjetas, cuotas y lo que cargas a crédito</div>
        </div>
        <button className="btn btn-secondary" onClick={() => store.openCard(null)} style={{ height: 34, borderRadius: 10, gap: 5, fontSize: 13 }}><Icon name="ph ph-plus" />Tarjeta</button>
      </div>

      {d.debts.length === 0 ? (
        <div className="surface" style={{ fontSize: 13.5, lineHeight: 1.5, color: 'var(--color-neutral-300)' }}>
          No tienes deudas de tarjeta registradas. Agrega tus tarjetas de crédito con su saldo, TCEA, pago mínimo y día de pago para ver cuándo quedas libre y cuánto pagas en intereses.
        </div>
      ) : (
        <>
          <div>
            <div style={{ fontSize: 13, color: 'var(--color-neutral-400)' }}>Debes en total</div>
            <div className="tnum" style={{ fontSize: 46, fontWeight: 500, letterSpacing: '-0.03em', lineHeight: 1.05, marginTop: 4 }}>{fmt0(d.debtTotal)}</div>
            <div style={{ fontSize: 13, color: 'var(--color-neutral-500)', marginTop: 6 }}>{d.debtFreeL} pagando {fmt0(pay)}/mes</div>
            {pay < minTotal && <div role="alert" style={{ fontSize: 12.5, color: 'var(--color-accent-300)', marginTop: 6 }}>Tu carpeta de tarjetas ({fmt0(pay)}) no cubre los mínimos ({fmt0(minTotal)}). Súbela en Carpetas.</div>}
          </div>

          <Segmented label="Estrategia de pago" value={s.strat} options={STRATS} onChange={store.setStrat} />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div className="tile"><div style={{ fontSize: 12, color: 'var(--color-neutral-400)' }}>Libre de deudas</div><div style={{ fontSize: 20, fontWeight: 500, marginTop: 2 }}>{endL(cur.months)}</div></div>
            <div className="tile"><div style={{ fontSize: 12, color: 'var(--color-neutral-400)' }}>Intereses a pagar</div><div className="tnum" style={{ fontSize: 20, fontWeight: 500, marginTop: 2 }}>{cur.months >= MAX_MONTHS ? 'Sin fin' : fmt0(cur.interest)}</div></div>
          </div>
          <div style={{ fontSize: 12.5, lineHeight: 1.45, color: 'var(--color-neutral-400)', marginTop: -4 }}>{note}</div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {order.map((debt, i) => {
              const payL = s.strat === 'min' ? fmt0(debt.min) : i === 0 ? fmt0(Math.max(debt.min, pay - othersMin)) : fmt0(debt.min);
              return (
                <div key={debt.id} {...pressable(() => store.openCard(debt.id), 'surface')}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ width: 22, height: 22, borderRadius: 6, border: '1px solid var(--color-accent-700)', color: 'var(--color-accent-300)', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{i + 1}</span>
                    <div className="row-main">
                      <div style={{ fontSize: 15, fontWeight: 500 }}>{debt.name}</div>
                      <div className="row-sub">TCEA {Math.round(debt.tcea * 100)}% · paga antes del {debt.due}</div>
                    </div>
                    <div className="row-end">
                      <div className="tnum" style={{ fontSize: 17, fontWeight: 500 }}>{fmt0(debt.bal)}</div>
                      {debt.limit > 0 && <div style={{ fontSize: 11.5, color: 'var(--color-neutral-500)' }}>de {fmt0(debt.limit)}</div>}
                    </div>
                  </div>
                  <Track w={pct(debt.bal, debt.limit || debt.bal)} color={debt.limit && debt.bal / debt.limit > 0.4 ? 'var(--color-accent-400)' : 'var(--color-neutral-300)'} height={4} style={{ margin: '12px 0 10px' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: 'var(--color-neutral-400)' }}>
                    <span>Mínimo {fmt0(debt.min)} · tu pago {payL}</span>
                    <span>Libre en {endL(cur.done[debt.id] || MAX_MONTHS)}</span>
                  </div>
                  {debt.cuotas && (
                    <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--color-divider)', fontSize: 12.5, color: 'var(--color-neutral-300)', display: 'flex', gap: 8, alignItems: 'center' }}>
                      <Icon name="ph ph-calendar-dots" style={{ color: 'var(--color-neutral-500)' }} /><span style={{ flex: 1 }}>{debt.cuotas}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {debitCards.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {debitCards.map(c => (
            <button key={c.id} className="chip" style={{ height: 34, fontSize: 13 }} onClick={() => store.openCard(c.id)}>
              <Icon name={c.applePay ? 'ph ph-apple-logo' : 'ph ph-credit-card'} />{c.name}{c.kind === 'credit' ? ' · sin deuda' : ''}
            </button>
          ))}
        </div>
      )}

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', margin: '6px 0 2px' }}>
          <span className="section-title">Gastos con crédito este mes</span>
          <span className="tnum" style={{ fontSize: 14 }}>{fmt(d.creditMonth)}</span>
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--color-neutral-500)', lineHeight: 1.45, marginBottom: 4 }}>Págalos completos antes del cierre para que no generen intereses.</div>
        {d.creditTxs.map(t => <TxRow key={t.id} t={d.txView(t)} variant="credit" onOpen={() => store.openRecat(t.id)} />)}
        {d.creditTxs.length === 0 && <div style={{ fontSize: 13, color: 'var(--color-neutral-500)', padding: '8px 0' }}>Nada cargado a crédito este mes.</div>}
      </div>

      {d.debts.length > 0 && (
        <button className="btn btn-primary btn-block" onClick={() => store.ask('¿Qué tarjeta pago primero y cómo salgo más rápido de mis deudas?')} style={{ height: 44, borderRadius: 12, gap: 6 }}>
          <Icon name="ph ph-sparkle" />¿Cómo salgo más rápido?
        </button>
      )}
    </div>
  );
}
