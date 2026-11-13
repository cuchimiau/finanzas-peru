import { useState } from 'react';
import { FM, FOLDERS, folderName } from '../domain/data';
import { fmt0 } from '../domain/format';
import { monthKey, monthKeyOf } from '../domain/dates';
import { Icon, Segmented, pressable } from './common';
import type { Derived } from '../state/selectors';
import type { Store } from '../state/store';

/** Mueve un mes ("2026-11") o un año hacia atrás o adelante. */
export const shiftMonth = (k: string, months: number) => { const d = new Date(Number(k.slice(0, 4)), Number(k.slice(5, 7)) - 1 + months, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };

/** Colores de la dona (de Incomes, aclarados para que se lean sobre el fondo oscuro). Orden fijo por carpeta. */
const SERIES = ['#5382e5', '#a24bb0', '#34ccab', '#f8d03c', '#dd245a', '#96d56e'];
const OTHER = '#8e8d93';
/** Sobre estos tonos claros el ícono va oscuro para que se lea. */
const LIGHT = ['#34ccab', '#f8d03c', '#96d56e', OTHER];
const LETTERS = ['E', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
export const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const cap = (x: string) => x[0].toUpperCase() + x.slice(1);

interface Seg { id: string; name: string; icon: string; amt: number; color: string }

/**
 * Primera métrica de Analítica (estilo Incomes): Gastos | Ingresos, Saldo y crecimiento del mes,
 * barras de los 12 meses del año (toca una para verla) y la dona por carpeta.
 */
export function MonthSummary({ store, d }: { store: Store; d: Derived }) {
  const { s } = store, now = d.m.now, cur = monthKey(now);
  const { period, folders } = s.an;
  const sel = s.an.month > cur ? cur : s.an.month;
  const yearView = period === 'año';
  const year = Number(sel.slice(0, 4));
  const [kind, setKind] = useState<'gastos' | 'ingresos'>('gastos');
  const keys = LETTERS.map((_, i) => `${year}-${String(i + 1).padStart(2, '0')}`);
  const mi = Number(sel.slice(5, 7)) - 1;
  const inF = (f: string | null | undefined) => !folders || (!!f && folders.includes(f));
  const inPeriod = (k: string) => (yearView ? k.slice(0, 4) === String(year) : k === sel);

  // Gastos = todos los movimientos. Ingresos = sueldo recibido (este mes) + ingresos extra registrados. Con filtro: solo esas carpetas.
  const spentIn = (match: (k: string) => boolean) => s.txs.filter(t => t.amt > 0 && inF(t.f) && match(monthKeyOf(t.date))).reduce((a, t) => a + t.amt, 0);
  const incomeIn = (match: (k: string) => boolean) => s.incomes.filter(i => inF(i.f) && match(monthKeyOf(i.date))).reduce((a, i) => a + i.amt, 0) + (!folders && match(cur) ? d.money.salaryIn : 0);
  const val = (match: (k: string) => boolean) => (kind === 'gastos' ? spentIn(match) : incomeIn(match));
  const series = keys.map(k => val(x => x === k));
  const max = Math.max(...series, 1);
  const total = val(inPeriod);
  // Promedio: por día en un mes (hasta hoy si es el mes actual); por mes en un año (hasta este mes si es el año actual).
  const avgDiv = yearView ? (year === now.getFullYear() ? now.getMonth() + 1 : 12) : (sel === cur ? now.getDate() : new Date(year, mi + 1, 0).getDate());
  const growth = incomeIn(inPeriod) - spentIn(inPeriod);
  const periodL = yearView ? String(year) : MONTHS[mi];

  // Dona: por carpeta (gastos) o por carpeta a la que sumó (ingresos).
  const by: Record<string, number> = {};
  if (kind === 'gastos') s.txs.filter(t => t.amt > 0 && inF(t.f) && inPeriod(monthKeyOf(t.date))).forEach(t => { const k = t.f ?? ''; by[k] = (by[k] || 0) + t.amt; });
  else {
    s.incomes.filter(i => inF(i.f) && inPeriod(monthKeyOf(i.date))).forEach(i => { by[i.f] = (by[i.f] || 0) + i.amt; });
    if (!folders && inPeriod(cur) && d.money.salaryIn) by.__sueldo = d.money.salaryIn;
  }
  const order = (id: string) => { const i = FOLDERS.findIndex(f => f.id === id); return i < 0 ? 999 : i; };
  const rows = Object.entries(by).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  const big = rows.slice(0, SERIES.length).map(([id]) => id).sort((a, b) => order(a) - order(b));
  const segs: Seg[] = big.map((id, i) => ({ id, name: id === '__sueldo' ? 'Sueldo' : id ? folderName(id) : 'Sin carpeta', icon: id === '__sueldo' ? 'briefcase' : FM[id]?.icon || 'question', amt: by[id], color: SERIES[i] }));
  const rest = rows.filter(([id]) => !big.includes(id));
  if (rest.length) segs.push({ id: '__otras', name: `Otras (${rest.length})`, icon: 'dots-three', amt: rest.reduce((a, [, v]) => a + v, 0), color: OTHER });
  const list = segs.slice().sort((a, b) => b.amt - a.amt);
  const sum = list.reduce((a, x) => a + x.amt, 0) || 1;

  // Dona en SVG: un arco por carpeta con una separación pequeña.
  const R = 78, W = 26, C = 2 * Math.PI * R, GAP = segs.length > 1 ? 2 : 0;
  let acc = 0;
  const arcs = segs.map(x => { const len = (x.amt / sum) * C; const a = { ...x, dash: `${Math.max(0, len - GAP)} ${C}`, off: -acc }; acc += len; return a; });
  const word = kind === 'gastos' ? 'Gastos' : 'Ingresos';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <Segmented label="Ver" value={kind} options={[['gastos', 'Gastos'], ['ingresos', 'Ingresos']]} onChange={setKind} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div className="tile">
          <div className="sum-label">{sel === cur || yearView ? 'Saldo' : 'Saldo hoy'}</div>
          <div className="sum-big tnum">{d.money.known ? fmt0(d.money.real) : '—'}</div>
          {!d.money.known && <div className="sum-note">Escribe tu dinero de hoy</div>}
        </div>
        <div className="tile">
          <div className="sum-label">Crecimiento en {periodL}</div>
          <div className="sum-big tnum" style={{ color: growth >= 0 ? 'var(--color-positive)' : 'var(--color-negative)' }}>{growth < 0 ? '−' : ''}{fmt0(Math.abs(growth))}</div>
        </div>
      </div>

      <div className="surface" style={{ padding: '14px 14px 10px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div><div className="sum-label">{word} en {cap(periodL)}</div><div className="sum-big tnum">{fmt0(total)}</div></div>
          <div><div className="sum-label">{yearView ? 'Promedio mensual' : 'Promedio diario'}</div><div className="sum-big tnum">{fmt0(total / Math.max(1, avgDiv))}</div></div>
        </div>
        <div className="sum-bars" role="group" aria-label={`${word} por mes de ${year}`}>
          {keys.map((k, i) => (
            <button type="button" key={k} aria-pressed={!yearView && k === sel} aria-label={`${cap(MONTHS[i])}: ${fmt0(series[i])}`} onClick={() => store.setAn({ month: k, period: 'mes' })} disabled={k > cur}>
              <span className="sum-bar" style={{ height: series[i] ? `${Math.max(6, (series[i] / max) * 100)}%` : 5, background: (yearView ? series[i] > 0 : k === sel) ? 'var(--color-accent)' : series[i] ? 'var(--color-neutral-700)' : 'var(--color-neutral-800)' }} />
              <span className="sum-letter" style={{ color: !yearView && k === sel ? 'var(--color-text)' : undefined }}>{LETTERS[i]}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="surface" style={{ padding: 14 }}>
        {list.length ? (
          <>
            <svg viewBox="0 0 200 200" width="100%" style={{ maxWidth: 230, display: 'block', margin: '0 auto 6px' }} role="img"
              aria-label={`${word} de ${periodL} por carpeta: ` + list.map(x => `${x.name} ${fmt0(x.amt)}`).join(', ')}>
              <circle cx="100" cy="100" r={R} fill="none" stroke="var(--color-surface-2)" strokeWidth={W} />
              {arcs.map(a => <circle key={a.id} cx="100" cy="100" r={R} fill="none" stroke={a.color} strokeWidth={W} strokeDasharray={a.dash} strokeDashoffset={a.off} transform="rotate(-90 100 100)" />)}
              <text x="100" y="96" textAnchor="middle" fill="var(--color-text)" style={{ font: '600 21px var(--font-heading)' }}>{fmt0(sum)}</text>
              <text x="100" y="117" textAnchor="middle" fill="var(--color-neutral-500)" style={{ font: '400 12px var(--font-body)' }}>{kind === 'gastos' ? 'gastado' : 'ingresó'}</text>
            </svg>
            {list.map(x => {
              const p = Math.round((x.amt / sum) * 100);
              const open = kind === 'gastos' && x.id && !x.id.startsWith('__') ? pressable(() => store.openFolder(x.id)) : {};
              return (
                <div key={x.id} {...open} className={'sum-row ' + ((open as { className?: string }).className || '')}>
                  <span className="sum-icon" style={{ background: x.color, color: LIGHT.includes(x.color) ? '#141414' : '#fff' }}><Icon name={'ph-fill ph-' + x.icon} /></span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <span className="sum-name">{x.name}</span><span className="tnum" style={{ fontWeight: 500 }}>{fmt0(x.amt)}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 5 }}>
                      <span className="sum-track"><span style={{ width: p + '%', background: x.color }} /></span>
                      <span className="tnum sum-pct">{p}%</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </>
        ) : (
          <div className="row-sub" style={{ padding: '8px 0' }}>{kind === 'gastos' ? `Aún no hay gastos en ${periodL}.` : `No registraste ingresos en ${periodL}. Agrégalos con + › Ingreso.`}</div>
        )}
      </div>
    </div>
  );
}
