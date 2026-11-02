import { FOLDERS, folderName } from '../domain/data';
import { fmt0 } from '../domain/format';
import { pressable } from './common';

/** Tonos categóricos validados para el fondo oscuro (orden fijo; el 6.º es "Otras"). */
const SERIES = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181'];
const OTHER = '#9085e9';
const MAX = 5, MIN_SHARE = 0.03;

interface Seg { id: string; name: string; amt: number; color: string }

/**
 * Lo que tienes vs lo que gastaste: una barra = todo lo que entró este mes;
 * cada segmento es una carpeta con gasto y el tramo vacío es lo que te queda.
 */
export function MoneyChart({ total, byFolder, onOpen, note }: { total: number; byFolder: Record<string, number>; onOpen: (id: string) => void; note?: string }) {
  const spent = Object.values(byFolder).reduce((a, v) => a + v, 0);
  const left = total - spent;
  const scale = Math.max(total, spent) || 1;
  const rows = Object.entries(byFolder).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  const big = rows.filter(([, v]) => v / scale >= MIN_SHARE).slice(0, MAX).map(([id]) => id);
  // Color por el orden de la carpeta en tu lista (no por su puesto en el ranking): no salta de color al cambiar montos.
  const order = (id: string) => { const i = FOLDERS.findIndex(f => f.id === id); return i < 0 ? 999 : i; };
  const shown = big.slice().sort((a, b) => order(a) - order(b));
  const segs: Seg[] = shown.map((id, i) => ({ id, name: id ? folderName(id) : 'Sin carpeta', amt: byFolder[id], color: SERIES[i] }));
  const rest = rows.filter(([id]) => !shown.includes(id));
  if (rest.length) segs.push({ id: '__otras', name: rest.length === 1 ? (rest[0][0] ? folderName(rest[0][0]) : 'Sin carpeta') : `Otras (${rest.length})`, amt: rest.reduce((a, [, v]) => a + v, 0), color: OTHER });
  const legend = segs.slice().sort((a, b) => b.amt - a.amt);
  const label = `Tienes ${fmt0(total)}. Gastaste ${fmt0(spent)}: ` + legend.map(x => `${x.name} ${fmt0(x.amt)}`).join(', ') + `. Te queda ${fmt0(left)}.`;

  return (
    <div className="surface">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 500 }}>Lo que tienes y lo que gastaste</span>
        <span className="muted" style={{ fontSize: 12 }}>este mes</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, margin: '10px 0 12px' }}>
        {[['Tienes', total], ['Gastaste', spent], ['Te queda', left]].map(([l, v]) => (
          <div key={l as string}>
            <div style={{ fontSize: 11.5, color: 'var(--color-neutral-400)' }}>{l}</div>
            <div className="tnum" style={{ fontSize: 18, fontWeight: 500, color: l === 'Te queda' && (v as number) < 0 ? 'var(--color-accent-300)' : 'var(--color-text)' }}>{fmt0(v as number)}</div>
          </div>
        ))}
      </div>
      <div role="img" aria-label={label} style={{ display: 'flex', gap: 2, height: 14, borderRadius: 4, background: 'var(--color-neutral-900)', overflow: 'hidden', boxShadow: 'inset 0 0 0 1px var(--color-neutral-800)' }}>
        {segs.map(x => <div key={x.id} title={`${x.name}: ${fmt0(x.amt)}`} style={{ width: `${(x.amt / scale) * 100}%`, minWidth: 3, background: x.color }} />)}
      </div>
      <div style={{ marginTop: 10 }}>
        {legend.map(x => (
          <div key={x.id} {...(x.id !== '__otras' && x.id ? pressable(() => onOpen(x.id)) : {})} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, padding: '6px 0', borderTop: '1px solid var(--color-divider)' }}>
            <span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: 3, background: x.color, flex: 'none' }} />
            <span style={{ flex: 1, color: 'var(--color-neutral-300)' }}>{x.name}</span>
            <span className="tnum">{fmt0(x.amt)}</span>
            <span className="tnum muted" style={{ width: 38, textAlign: 'right' }}>{Math.round((x.amt / scale) * 100)}%</span>
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, padding: '6px 0', borderTop: '1px solid var(--color-divider)' }}>
          <span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: 3, background: 'var(--color-neutral-900)', boxShadow: 'inset 0 0 0 1px var(--color-neutral-600)', flex: 'none' }} />
          <span style={{ flex: 1, color: 'var(--color-neutral-300)' }}>Te queda</span>
          <span className="tnum">{fmt0(left)}</span>
          <span className="tnum muted" style={{ width: 38, textAlign: 'right' }}>{Math.max(0, Math.round((left / scale) * 100))}%</span>
        </div>
        {legend.length === 0 && <div className="row-sub" style={{ paddingTop: 6 }}>Aún no hay gastos desde que empezaste.</div>}
      </div>
      {note && <div style={{ fontSize: 11.5, color: 'var(--color-neutral-500)', marginTop: 8, lineHeight: 1.45 }}>{note}</div>}
    </div>
  );
}
