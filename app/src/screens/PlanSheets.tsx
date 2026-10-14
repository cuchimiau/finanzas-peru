import { useState } from 'react';
import { FM, FOLDERS, GROUPS, LOCKED_FOLDERS, folderName, type Budgets, type Folder, type GroupId } from '../domain/data';
import { fmt, fmt0 } from '../domain/format';
import { MONTH_LONG } from '../domain/dates';
import { goalViews, sumBudgets, txsOfMonth } from '../domain/plan';
import { nextMonthPlan, restOfMonth, type NextMonthPlan } from '../domain/optimize';
import type { Derived } from '../state/selectors';
import { minPayments } from '../domain/cards';
import { Field, Icon, Segmented, inputStyle } from '../components/common';
import { parseIncome, spentMap, type Store } from '../state/store';

const ICONS = [
  'house', 'shopping-cart', 'bus', 'car', 'gas-pump', 'lightning', 'wifi-high', 'phone', 'first-aid', 'heart',
  'fork-knife', 'coffee', 'ticket', 'television-simple', 'game-controller', 't-shirt', 'barbell', 'graduation-cap',
  'book-open', 'baby', 'paw-print', 'gift', 'airplane-tilt', 'mountains', 'piggy-bank', 'lifebuoy', 'trend-up',
  'credit-card', 'hand-heart', 'briefcase', 'wrench', 'sparkle',
];

const GROUP_OPTS: [GroupId, string][] = [['nec', 'Necesidad'], ['des', 'Deseo'], ['aho', 'Ahorro']];

/** Crear, renombrar, cambiar ícono/grupo o borrar una carpeta. */
export function FolderForm({ store }: { store: Store }) {
  const { s } = store;
  const existing = s.editFolderId ? FM[s.editFolderId] : null;
  const [name, setName] = useState(existing?.name ?? '');
  const [icon, setIcon] = useState(existing?.icon ?? 'sparkle');
  const [grp, setGrp] = useState<GroupId>(existing?.grp ?? 'des');
  const [err, setErr] = useState('');
  const locked = !!existing && LOCKED_FOLDERS.includes(existing.id);
  const fixedGroup = !!existing && (existing.grp === 'deu' || locked);

  const save = () => {
    const n = name.trim().slice(0, 28);
    if (!n) { setErr('Ponle un nombre, por ejemplo "Gimnasio" o "Mascota".'); return; }
    if (FOLDERS.some(f => f.name.toLowerCase() === n.toLowerCase() && f.id !== existing?.id)) { setErr('Ya tienes una carpeta con ese nombre.'); return; }
    const f: Folder = existing ? { ...existing, name: n, icon, grp: fixedGroup ? existing.grp : grp } : { id: 'u' + Date.now().toString(36), name: n, icon, grp, base: 0 };
    store.saveFolder(f);
  };

  return (
    <form onSubmit={e => { e.preventDefault(); save(); }} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 20, fontWeight: 500 }}>{existing ? 'Editar carpeta' : 'Nueva carpeta'}</div>
      <Field label="Nombre"><input className="input" style={inputStyle} value={name} onChange={e => setName(e.target.value)} placeholder="Gimnasio, Mascota, Universidad…" autoFocus={!existing} /></Field>
      {!fixedGroup && (
        <div>
          <div style={{ fontSize: 12, color: 'var(--color-neutral-400)', marginBottom: 5 }}>Tipo</div>
          <Segmented label="Tipo de carpeta" value={grp} options={GROUP_OPTS} onChange={setGrp} />
          <div className="row-sub" style={{ marginTop: 5 }}>
            {grp === 'nec' ? 'Gastos que no puedes evitar: nunca se recortan para cubrir deseos.' : grp === 'des' ? 'Gastos que eliges: se usan primero cuando falta dinero en otra carpeta.' : 'Se aparta el día de pago, antes de gastar.'}
          </div>
        </div>
      )}
      <div>
        <div style={{ fontSize: 12, color: 'var(--color-neutral-400)', marginBottom: 6 }}>Ícono</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 6 }}>
          {ICONS.map(i => (
            <button type="button" key={i} aria-label={i} aria-pressed={icon === i} onClick={() => setIcon(i)}
              className={'option' + (icon === i ? ' on' : '')} style={{ height: 38, padding: 0, justifyContent: 'center', fontSize: 18 }}>
              <Icon name={'ph ph-' + i} />
            </button>
          ))}
        </div>
      </div>
      {err && <div role="alert" style={{ fontSize: 12.5, color: 'var(--color-accent-300)' }}>{err}</div>}
      <div style={{ display: 'flex', gap: 8 }}>
        {existing && !locked && (
          <button type="button" className="btn btn-secondary" style={{ flex: 1, height: 46, borderRadius: 12 }}
            onClick={() => { if (confirm(`¿Borrar "${existing.name}"? Su presupuesto (${fmt0(s.budgets[existing.id] || 0)}) pasa a Libre y sus movimientos quedan por revisar.`)) store.deleteFolder(existing.id); }}>
            <Icon name="ph ph-trash" />Borrar
          </button>
        )}
        <button type="submit" className="btn btn-primary" style={{ flex: 2, height: 46, borderRadius: 12 }}>{existing ? 'Guardar' : 'Crear carpeta'}</button>
      </div>
      {locked && <div className="row-sub">La app necesita esta carpeta: puedes renombrarla y cambiar su ícono, pero no borrarla.</div>}
    </form>
  );
}

/** Todos los montos del plan en una sola lista. */
export function PlanEditor({ store }: { store: Store }) {
  const { s } = store;
  const [vals, setVals] = useState<Record<string, string>>(() => Object.fromEntries(FOLDERS.map(f => [f.id, String(s.budgets[f.id] || 0)])));
  const [asTemplate, setAsTemplate] = useState(true);
  const salary = parseIncome(s.income);
  const extra = s.incomes.filter(i => i.date.slice(0, 7) === s.monthKey).reduce((a, i) => a + i.amt, 0);
  const total = Object.values(s.budgets).reduce((a, v) => a + v, 0);
  const sum = FOLDERS.reduce((a, f) => a + (Number(vals[f.id]) || 0), 0);
  const left = total - sum;
  const spent = spentMap(s.txs);
  const minDebt = minPayments(s.cards);
  const under = FOLDERS.filter(f => (Number(vals[f.id]) || 0) < Math.floor(spent[f.id] || 0));
  const debtLow = (Number(vals.deudas) || 0) < minDebt;
  const ok = left >= 0 && !under.length && !debtLow;

  const save = () => {
    const b: Budgets = Object.fromEntries(FOLDERS.map(f => [f.id, Math.max(0, Math.round(Number(vals[f.id]) || 0))]));
    b.libre += left; // lo sin asignar va a Libre (base cero)
    store.savePlan(b, asTemplate);
  };

  return (
    <form onSubmit={e => { e.preventDefault(); if (ok) save(); }}>
      <div style={{ fontSize: 20, fontWeight: 500 }}>Editar plan</div>
      <div style={{ position: 'sticky', top: -10, zIndex: 2, background: 'var(--color-surface)', padding: '10px 0 8px', margin: '0 0 4px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
          <span className="muted">Sueldo {fmt0(salary)}{extra ? ` + extra ${fmt0(extra)}` : ''}</span>
          <span className="tnum">Asignado {fmt0(sum)} de {fmt0(total)}</span>
        </div>
        <div className="tnum" role="status" style={{ fontSize: 15, fontWeight: 500, marginTop: 4, color: left < 0 ? 'var(--color-accent-300)' : 'var(--color-text)' }}>
          {left < 0 ? `Te pasas por ${fmt0(-left)}: baja alguna carpeta` : left > 0 ? `Sin asignar ${fmt0(left)} · irá a Libre` : 'Todo asignado ✓'}
        </div>
      </div>
      {GROUPS.map(g => {
        const items = FOLDERS.filter(f => f.grp === g.id);
        if (!items.length) return null;
        return (
          <div key={g.id} style={{ marginTop: 10 }}>
            <div style={{ fontSize: 12, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--color-neutral-500)', margin: '6px 0' }}>{g.label}</div>
            {items.map(f => {
              const v = Number(vals[f.id]) || 0, sp = Math.floor(spent[f.id] || 0);
              const low = v < sp || (f.id === 'deudas' && v < minDebt);
              return (
                <label key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0' }}>
                  <div className="ibox" style={{ width: 32, height: 32, fontSize: 16 }}><Icon name={'ph ph-' + f.icon} /></div>
                  <div className="row-main">
                    <div style={{ fontSize: 14 }}>{f.name}</div>
                    {(sp > 0 || f.id === 'deudas' && minDebt > 0) && <div className="row-sub" style={{ color: low ? 'var(--color-accent-300)' : undefined }}>{f.id === 'deudas' && minDebt ? `mínimos ${fmt0(minDebt)}` : `gastado ${fmt0(sp)}`}</div>}
                  </div>
                  <span className="muted" style={{ fontSize: 13 }}>S/</span>
                  <input className="input" inputMode="numeric" aria-label={`Presupuesto de ${f.name}`} value={vals[f.id]}
                    onChange={e => setVals(x => ({ ...x, [f.id]: e.target.value.replace(/[^0-9]/g, '').slice(0, 6) }))}
                    onFocus={e => e.target.select()}
                    style={{ width: 92, height: 38, borderRadius: 9, fontSize: 15, textAlign: 'right', borderColor: low ? 'var(--color-accent)' : undefined }} />
                </label>
              );
            })}
          </div>
        );
      })}
      <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13.5, marginTop: 14, cursor: 'pointer' }}>
        <input type="checkbox" checked={asTemplate} onChange={e => setAsTemplate(e.target.checked)} style={{ width: 20, height: 20, accentColor: 'var(--color-accent)' }} />
        Usar también como plan base de los próximos meses
      </label>
      {(under.length > 0 || debtLow) && (
        <div role="alert" style={{ fontSize: 12.5, color: 'var(--color-accent-300)', marginTop: 8 }}>
          {debtLow ? `Pago de deudas no puede bajar de los mínimos (${fmt0(minDebt)}). ` : ''}{under.length ? `No puedes poner menos de lo ya gastado en: ${under.map(f => f.name).join(', ')}.` : ''}
        </div>
      )}
      <button type="submit" className="btn btn-primary btn-block" disabled={!ok} style={{ height: 46, borderRadius: 12, marginTop: 12 }}>Guardar plan</button>
    </form>
  );
}

function useOptimizeData(store: Store, d: Derived) {
  const { s } = store;
  const ef = goalViews(s.budgets, s.goals, d.m.now).find(g => g.id === 'emergencia');
  const gap = ef ? Math.max(0, ef.target - ef.saved) : 0;
  return { gap, minDebt: minPayments(s.cards), salary: parseIncome(s.income) };
}

/** Optimizar: el resto de este mes y el plan del próximo. */
export function OptimizeSheet({ store, d }: { store: Store; d: Derived }) {
  const { s } = store;
  const [tab, setTab] = useState<'rest' | 'next'>('rest');
  const { gap, minDebt, salary } = useOptimizeData(store, d);
  const rest = restOfMonth(s.budgets, d.monthTxs, d.m.pct, d.m.daysLeft, d.debts, gap);
  const next = nextMonthPlan(s.template, d.monthTxs, d.m.pct, salary, minDebt, d.debts, gap);
  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 500, marginBottom: 10 }}>Optimizar</div>
      <Segmented label="Periodo" value={tab} options={[['rest', 'Resto de este mes'], ['next', 'Próximo mes']]} onChange={setTab} />
      {tab === 'rest' ? (
        <div style={{ marginTop: 14 }}>
          <div className="tile">
            <div style={{ fontSize: 12, color: 'var(--color-neutral-400)' }}>Quedan {d.m.daysLeft} {d.m.daysLeft === 1 ? 'día' : 'días'} · puedes gastar en total</div>
            <div className="tnum" style={{ fontSize: 26, fontWeight: 500 }}>{fmt(rest.perDay)} <span style={{ fontSize: 14, color: 'var(--color-neutral-400)' }}>por día</span></div>
          </div>
          {rest.risks.length > 0 && (
            <div className="hint-card" style={{ marginTop: 10, fontSize: 13, lineHeight: 1.5 }}>
              <div style={{ fontWeight: 500, marginBottom: 4 }}>⚠️ A este ritmo te vas a pasar en:</div>
              {rest.risks.map(r => <div key={r.id}>{folderName(r.id)}: ~{fmt0(r.projected)} de {fmt0(r.budget)} (ve más despacio: {fmt(Math.max(0, r.left) / d.m.daysLeft)}/día)</div>)}
            </div>
          )}
          <div className="section-title" style={{ fontSize: 14, margin: '14px 0 6px' }}>Por carpeta, hasta fin de mes</div>
          {rest.rows.filter(r => r.budget > 0 || r.spent > 0).map(r => (
            <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '5px 0', borderBottom: '1px solid var(--color-divider)' }}>
              <span>{folderName(r.id)}</span>
              <span className="tnum" style={{ color: r.left < 0 ? 'var(--color-accent-300)' : undefined }}>{r.left < 0 ? `excedido ${fmt0(-r.left)}` : FM[r.id]?.grp === 'des' || r.id === 'mercado' || r.id === 'transporte' ? `${fmt0(r.left)} · ${fmt(r.perDay)}/día` : r.left > 0 ? `por pagar ${fmt0(r.left)}` : 'pagado ✓'}</span>
            </div>
          ))}
          <div className="accent-card" style={{ marginTop: 14, background: 'linear-gradient(165deg, var(--color-accent-900), transparent)' }}>
            <div className="eyebrow">Plan de ahorro para fin de mes</div>
            {rest.canSave > 0 ? (
              <>
                <div style={{ fontSize: 14, lineHeight: 1.45, margin: '6px 0 8px' }}>Puedes ahorrar <b>{fmt0(rest.canSave)}</b> de lo que no vas a necesitar en tus deseos y mandarlo a {rest.target.why}. Tus necesidades no se tocan.</div>
                {rest.moves.map(m => (
                  <div key={m.de} style={{ display: 'flex', gap: 8, fontSize: 13, padding: '6px 0', borderTop: '1px solid var(--color-divider)' }}>
                    <span style={{ color: 'var(--color-neutral-300)' }}>{folderName(m.de)}</span><Icon name="ph ph-arrow-right" style={{ color: 'var(--color-neutral-500)' }} />
                    <span style={{ flex: 1 }}>{folderName(rest.target.id)}</span><span className="tnum" style={{ color: 'var(--color-accent-300)' }}>{fmt0(m.monto)}</span>
                  </div>
                ))}
                <button className="btn btn-primary btn-block" onClick={() => store.applyRest(rest.moves, rest.target.id)} style={{ height: 42, borderRadius: 11, marginTop: 10 }}>Aplicar · ahorrar {fmt0(rest.canSave)}</button>
              </>
            ) : <div style={{ fontSize: 13.5, lineHeight: 1.45, marginTop: 6 }}>Este mes no queda margen en tus deseos. Lo mejor es no pasarte en las carpetas marcadas arriba.</div>}
            <button className="btn btn-ghost btn-block" onClick={() => store.ask('Optimiza mi fin de mes: ¿cuánto puedo ahorrar y dónde recorto sin tocar necesidades?')} style={{ height: 38, gap: 6 }}><Icon name="ph ph-sparkle" />Preguntar al asesor</button>
          </div>
        </div>
      ) : (
        <NextMonthView store={store} plan={next} base={s.template} actionLabel="Usar como mi plan base" onApply={() => store.setTemplate(next.budgets)} />
      )}
    </div>
  );
}

function NextMonthView({ plan, base, actionLabel, onApply, secondary }: { store: Store; plan: NextMonthPlan; base: Budgets; actionLabel: string; onApply: () => void; secondary?: React.ReactNode }) {
  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ fontSize: 13.5, lineHeight: 1.5, color: 'var(--color-neutral-300)' }}>Con lo que realmente gastas, así quedaría tu plan del próximo mes (total {fmt0(sumBudgets(plan.budgets))}):</div>
      {plan.notes.map(n => <div key={n} className="hint-card" style={{ marginTop: 8, fontSize: 12.5, lineHeight: 1.45 }}>{n}</div>)}
      <div style={{ marginTop: 10 }}>
        {FOLDERS.filter(f => (plan.budgets[f.id] || 0) > 0 || (base[f.id] || 0) > 0).map(f => {
          const from = base[f.id] || 0, to = plan.budgets[f.id] || 0;
          return (
            <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '5px 0', borderBottom: '1px solid var(--color-divider)' }}>
              <span>{f.name}</span>
              <span className="tnum">{from !== to ? <><span className="muted">{fmt0(from)} → </span><b style={{ color: 'var(--color-accent-300)' }}>{fmt0(to)}</b></> : fmt0(to)}</span>
            </div>
          );
        })}
      </div>
      <button className="btn btn-primary btn-block" onClick={onApply} style={{ height: 44, borderRadius: 12, marginTop: 12 }}>{actionLabel}</button>
      {secondary}
    </div>
  );
}

/** Cierre de mes: resumen del mes que terminó y plan para empezar el nuevo. */
export function CloseSheet({ store, d }: { store: Store; d: Derived }) {
  const { s } = store;
  const { gap, minDebt, salary } = useOptimizeData(store, d);
  const prevTxs = txsOfMonth(s.txs, s.monthKey);
  const spent = prevTxs.reduce((a, t) => a + t.amt, 0);
  const saved = FOLDERS.filter(f => f.grp === 'aho' || f.grp === 'deu').reduce((a, f) => a + (s.budgets[f.id] || 0), 0);
  const over = FOLDERS.filter(f => f.grp === 'nec' || f.grp === 'des').map(f => ({ f, sp: prevTxs.filter(t => t.f === f.id).reduce((a, t) => a + t.amt, 0), b: s.budgets[f.id] || 0 })).filter(x => x.sp > x.b + 0.5);
  const plan = nextMonthPlan(s.template, prevTxs, 1, salary, minDebt, d.debts, gap);
  const label = `${MONTH_LONG[Number(s.monthKey.slice(5, 7)) - 1]} ${s.monthKey.slice(0, 4)}`;
  return (
    <div>
      <div className="eyebrow">Cierre de mes</div>
      <div style={{ fontSize: 22, fontWeight: 500, margin: '4px 0 10px' }}>Así te fue en {label}</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div className="tile"><div className="row-sub">Gastaste</div><div className="tnum" style={{ fontSize: 20, fontWeight: 500 }}>{fmt0(spent)}</div></div>
        <div className="tile"><div className="row-sub">Ahorro y deudas</div><div className="tnum" style={{ fontSize: 20, fontWeight: 500 }}>{fmt0(saved)}</div></div>
      </div>
      {over.length > 0 && <div className="hint-card" style={{ marginTop: 10, fontSize: 12.5, lineHeight: 1.5 }}>Te pasaste en: {over.map(x => `${x.f.name} (${fmt0(x.sp)} de ${fmt0(x.b)})`).join(', ')}.</div>}
      <NextMonthView store={store} plan={plan} base={s.template} actionLabel="Empezar el mes con este plan" onApply={() => store.startMonth(plan.budgets)}
        secondary={<button className="btn btn-ghost btn-block" onClick={() => store.startMonth(s.template)} style={{ height: 40, marginTop: 4 }}>Empezar con mi plan base de siempre</button>} />
    </div>
  );
}
