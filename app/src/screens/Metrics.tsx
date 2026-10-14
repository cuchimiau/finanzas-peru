import { FOLDERS, INEI_BENCH, folderName, type Tx } from '../domain/data';
import { fmt0, pct } from '../domain/format';
import { lastMonthKeys, monthShort } from '../domain/dates';
import { payInfo, viaApplePay } from '../domain/cards';
import { essentials, goalViews, grossFromNet, isFlow, spendByMonth } from '../domain/plan';
import { Icon, SparkleButton, Track, pressable } from '../components/common';
import type { Derived } from '../state/selectors';
import type { Store } from '../state/store';

export function Metrics({ store, d }: { store: Store; d: Derived }) {
  const { s } = store, b = s.budgets, income = d.income;
  const dti = income ? Math.round((b.deudas / income) * 100) : 0;
  const limits = d.debts.reduce((a, x) => a + x.limit, 0);
  const ess = essentials(b);
  const goals = goalViews(b, s.goals, d.m.now);
  const ef = goals.find(g => g.id === 'emergencia');
  const use = limits ? Math.round((d.debtTotal / limits) * 100) : 0;
  const kpis = [
    { label: 'Tasa de ahorro', value: income ? Math.round(((b.emergencia + b.inversion + b.viaje) / income) * 100) + '%' : '0%', note: d.debts.length ? 'Meta 10% mientras pagas deudas' : 'Meta 20% del sueldo', hi: false },
    { label: 'Deuda / sueldo', value: dti + '%', note: dti > 20 ? 'Alto: bájalo de 20%' : 'Saludable', hi: dti > 20 },
    { label: 'Fondo de emergencia', value: (ess && ef ? ef.saved / ess : 0).toFixed(1) + ' meses', note: 'de 3 meses de esenciales', hi: false },
    { label: 'Uso de crédito', value: limits ? use + '%' : '—', note: limits ? 'Ideal por debajo de 30%' : 'Sin líneas registradas', hi: use > 30 },
  ];

  // Últimos 6 meses desde el primer movimiento registrado.
  const keys = lastMonthKeys(6, d.m.now);
  const first = s.txs.length ? s.txs[s.txs.length - 1].date.slice(0, 7) : d.m.key;
  const shown = keys.filter(k => k >= first);
  const byMonth = spendByMonth(s.txs, shown);
  const mv: [string, number][] = shown.map(k => [monthShort(k), Math.round(byMonth[k])]);
  const maxV = Math.max(income, ...mv.map(m => m[1])) * 1.12 || 1;

  const planSpend = FOLDERS.filter(isFlow).reduce((a, f) => a + b[f.id], 0) || 1;
  const bench = INEI_BENCH.map(x => {
    const you = (x.folders.reduce((a, id) => a + b[id], 0) / planSpend) * 100;
    return { ...x, youL: Math.round(you) + '%', refL: x.ref.toFixed(1).replace('.0', '') + '%', youW: Math.min(100, you * 2) + '%', refW: Math.min(99, x.ref * 2) + '%' };
  });

  const mixDef: [string, (t: Tx) => boolean, string][] = [
    ['Apple Pay', t => viaApplePay(t), 'var(--color-accent)'],
    ['Yape', t => t.pay === 'yape', 'var(--color-accent-700)'],
    ['Tarjeta', t => !viaApplePay(t) && !!payInfo(t.pay, s.cards).card, 'var(--color-neutral-300)'],
    ['Efectivo', t => t.pay === 'cash', 'var(--color-neutral-600)'],
  ];
  const totTx = d.monthTxs.reduce((a, t) => a + t.amt, 0) || 1;
  const payMix = mixDef.map(([label, fn, color]) => {
    const v = d.monthTxs.filter(fn).reduce((a, t) => a + t.amt, 0);
    return { label, color, w: pct(v, totTx), pctL: Math.round((v / totTx) * 100) + '%' };
  });

  const bruto = grossFromNet(income);
  const extras = [
    { name: 'CTS', sub: 'Mayo y noviembre · cuenta CTS', icon: 'ph ph-vault', amtL: '~' + fmt0(bruto * 0.58) },
    { name: 'Gratificación', sub: 'Julio y diciembre · sueldo + 9% de bonificación', icon: 'ph ph-gift', amtL: '~' + fmt0(bruto * 1.09) },
  ];

  return (
    <div className="rise" style={{ padding: '8px 20px 28px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="page-title">Métricas</div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {kpis.map(k => (
          <div key={k.label} className="tile">
            <div style={{ fontSize: 12, color: 'var(--color-neutral-400)' }}>{k.label}</div>
            <div className="tnum" style={{ fontSize: 24, fontWeight: 500, marginTop: 2 }}>{k.value}</div>
            <div style={{ fontSize: 11.5, color: k.hi ? 'var(--color-accent-300)' : 'var(--color-neutral-500)', marginTop: 2 }}>{k.note}</div>
          </div>
        ))}
      </div>

      <div className="surface">
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 12 }}>
          <span style={{ fontWeight: 500 }}>Gasto mensual</span><span className="muted">línea = sueldo</span>
        </div>
        <div style={{ height: 120, display: 'flex', alignItems: 'flex-end', gap: 10, position: 'relative' }} role="img"
          aria-label={'Gasto por mes: ' + mv.map(([l, v]) => `${l} ${fmt0(v)}`).join(', ') + `. Sueldo ${fmt0(income)}.`}>
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: pct(income, maxV), borderTop: '1px dashed var(--color-neutral-600)' }} />
          {mv.map(([l, v], i) => (
            <div key={l + i} style={{ flex: 1, maxWidth: 52, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', gap: 4, height: '100%' }}>
              <div className="tnum" style={{ fontSize: 10, color: 'var(--color-neutral-500)' }}>{v >= 1000 ? (v / 1000).toFixed(1) + 'k' : String(v)}</div>
              <div style={{ width: '100%', height: pct(v, maxV), minHeight: v ? 2 : 0, borderRadius: '5px 5px 2px 2px', background: i === mv.length - 1 ? 'var(--color-accent)' : v > income ? 'var(--color-accent-700)' : 'var(--color-neutral-700)' }} />
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 6 }} aria-hidden="true">
          {mv.map(([l], i) => <div key={l + i} style={{ flex: 1, maxWidth: 52, textAlign: 'center', fontSize: 11.5, color: 'var(--color-neutral-500)' }}>{l}</div>)}
        </div>
        {mv.length < 2 && <div style={{ fontSize: 11.5, color: 'var(--color-neutral-500)', marginTop: 8 }}>El historial crece mes a mes con tus movimientos.</div>}
      </div>

      <div className="surface">
        <div style={{ fontSize: 13, fontWeight: 500 }}>Tu plan vs. el hogar peruano promedio</div>
        <div style={{ fontSize: 11.5, color: 'var(--color-neutral-500)', margin: '2px 0 12px' }}>% de tu gasto del plan · referencia INEI 2024</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
          {bench.map(x => (
            <div key={x.label}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 5 }}>
                <span style={{ color: 'var(--color-neutral-300)' }}>{x.label}</span>
                <span className="tnum">{x.youL} <span className="muted">· Perú {x.refL}</span></span>
              </div>
              <div style={{ height: 4, borderRadius: 2, background: 'var(--color-neutral-900)', position: 'relative' }}>
                <div style={{ height: '100%', width: x.youW, borderRadius: 2, background: 'var(--color-accent)' }} />
                <div style={{ position: 'absolute', top: -3, left: x.refW, width: 2, height: 10, borderRadius: 1, background: 'var(--color-neutral-300)' }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="surface">
        <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 12 }}>¿Cómo pagas? <span className="muted" style={{ fontWeight: 400 }}>· este mes</span></div>
        <div className="stack-bar" style={{ height: 8, borderRadius: 4, background: 'var(--color-neutral-900)' }}>
          {payMix.map(p => <div key={p.label} style={{ width: p.w, background: p.color }} />)}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 12px', marginTop: 12 }}>
          {payMix.map(p => (
            <div key={p.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--color-neutral-300)' }}>
              <span className="dot" style={{ background: p.color }} /><span style={{ flex: 1 }}>{p.label}</span>
              <span className="tnum" style={{ color: 'var(--color-neutral-400)' }}>{p.pctL}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="surface">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span style={{ fontSize: 13, fontWeight: 500 }}>Ingresos del mes</span>
          <span className="tnum" style={{ fontSize: 14 }}>{fmt0(d.salary + d.extraIncome)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: 'var(--color-neutral-400)', padding: '8px 0 4px' }}><span>Sueldo</span><span className="tnum">{fmt0(d.salary)}</span></div>
        {d.monthIncomes.map(i => (
          <div key={i.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, padding: '6px 0', borderTop: '1px solid var(--color-divider)' }}>
            <Icon name="ph ph-arrow-circle-down" style={{ color: 'var(--color-accent-300)' }} />
            <span style={{ flex: 1 }}>{i.name} <span className="muted">→ {folderName(i.f)}</span></span>
            <span className="tnum">+{fmt0(i.amt)}</span>
            <button type="button" className="btn btn-ghost" aria-label={`Eliminar ingreso ${i.name}`} onClick={() => { if (confirm(`¿Eliminar el ingreso "${i.name}"?`)) store.deleteIncome(i.id); }} style={{ height: 28, padding: '0 6px', color: 'var(--color-neutral-500)' }}><Icon name="ph ph-x" /></button>
          </div>
        ))}
        <button type="button" className="link-btn" onClick={() => { store.openSheet('add'); store.setAdd({ addKind: 'ingreso' }); }} style={{ marginTop: 6, fontSize: 12.5 }}>+ Registrar ingreso extra</button>
      </div>

      <div className="section-title" style={{ marginTop: 8 }}>Metas</div>
      {goals.map(g => (
        <div key={g.id} {...pressable(() => store.openGoal(g.id), 'surface')}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Icon name={g.icon} style={{ fontSize: 20, color: 'var(--color-accent-300)' }} />
            <div style={{ flex: 1, fontSize: 15, fontWeight: 500 }}>{g.name}</div>
            <span style={{ fontSize: 12, color: 'var(--color-neutral-400)' }}>{g.monthly ? '+' + fmt0(g.monthly) + '/mes' : 'sin aporte'}</span>
            <Icon name="ph ph-pencil-simple" style={{ fontSize: 15, color: 'var(--color-neutral-600)' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 10 }}>
            <span className="tnum" style={{ fontSize: 24, fontWeight: 500 }}>{fmt0(g.saved)}</span>
            <span style={{ fontSize: 13, color: 'var(--color-neutral-500)' }}>de {fmt0(g.target)}</span>
          </div>
          <Track w={pct(g.saved, g.target)} color="var(--color-accent)" height={6} style={{ margin: '10px 0 8px' }} />
          <div style={{ fontSize: 12.5, color: 'var(--color-neutral-400)', lineHeight: 1.45 }}>{g.foot}</div>
          {!g.monthly && (
            <SparkleButton label="Pedir plan al asesor" style={{ marginTop: 12 }}
              onClick={() => store.ask(`Mi meta ${g.name} (llevo ${fmt0(g.saved)} de ${fmt0(g.target)}) no tiene aporte mensual. ¿Cómo la activo sin descuidar mis deudas?`)} />
          )}
        </div>
      ))}

      <div className="accent-card" style={{ background: 'linear-gradient(165deg, var(--color-accent-900), transparent)' }}>
        <div className="eyebrow">Ingresos extra que vienen</div>
        {extras.map(x => (
          <div key={x.name} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--color-divider)' }}>
            <Icon name={x.icon} style={{ fontSize: 18, color: 'var(--color-neutral-300)' }} />
            <div className="row-main"><div className="row-title">{x.name}</div><div className="row-sub">{x.sub}</div></div>
            <span className="tnum" style={{ fontSize: 14 }}>{x.amtL}</span>
          </div>
        ))}
        <div style={{ fontSize: 11.5, color: 'var(--color-neutral-500)', marginTop: 8 }}>Estimado desde tu sueldo neto; el monto real depende de tu sueldo bruto.</div>
        <SparkleButton label="Planear mi gratificación" style={{ marginTop: 12 }}
          onClick={() => store.ask(`Mi próxima gratificación será de ~${fmt0(bruto * 1.09)}. ¿Cómo la reparto entre deudas, emergencia y metas?`)} />
      </div>
    </div>
  );
}
