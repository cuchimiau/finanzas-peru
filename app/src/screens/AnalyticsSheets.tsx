import { useState } from 'react';
import { FOLDERS, type FolderId } from '../domain/data';
import { parseAmount } from '../domain/format';
import { monthKey, monthKeyOf } from '../domain/dates';
import { buildCsv, csvName } from '../domain/exportCsv';
import { Field, Icon, Segmented, inputStyle } from '../components/common';
import type { Store } from '../state/store';

/** Agregar o editar una suscripción (dentro de la carpeta Suscripciones). */
export function SubForm({ store }: { store: Store }) {
  const { s } = store;
  const existing = s.subs.find(x => x.id === s.subId);
  const [name, setName] = useState(existing?.name ?? '');
  const [amt, setAmt] = useState(existing ? String(existing.amt) : '');
  const [day, setDay] = useState(existing?.day ? String(existing.day) : '');
  const [err, setErr] = useState('');
  const save = () => {
    const n = name.trim().slice(0, 30), a = parseAmount(amt), dd = Math.round(Number(day));
    if (!n) { setErr('Escribe el nombre, por ejemplo "Netflix" o "Spotify".'); return; }
    if (!(a > 0)) { setErr('Escribe cuánto pagas al mes.'); return; }
    if (day && !(dd >= 1 && dd <= 31)) { setErr('El día de cobro va de 1 a 31.'); return; }
    if (s.subs.some(x => x.name.toLowerCase() === n.toLowerCase() && x.id !== existing?.id)) { setErr('Ya tienes una suscripción con ese nombre.'); return; }
    store.saveSub({ id: existing?.id ?? 's' + Date.now().toString(36), name: n, amt: a, ...(dd ? { day: dd } : {}) });
  };
  return (
    <form onSubmit={e => { e.preventDefault(); save(); }} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 20, fontWeight: 500 }}>{existing ? 'Editar suscripción' : 'Nueva suscripción'}</div>
      <Field label="Nombre"><input className="input" style={inputStyle} value={name} onChange={e => { setName(e.target.value); setErr(''); }} placeholder="Netflix, Spotify, iCloud, ChatGPT…" aria-label="Nombre de la suscripción" autoFocus={!existing} /></Field>
      <Field label="Monto mensual (S/)"><input className="input tnum" style={inputStyle} inputMode="decimal" value={amt} onChange={e => { setAmt(e.target.value.replace(/[^0-9.,]/g, '')); setErr(''); }} placeholder="Ej. 44.90" aria-label="Monto mensual" /></Field>
      <Field label="Día de cobro (opcional)" hint="Para recordarte cuándo llega."><input className="input tnum" style={inputStyle} inputMode="numeric" value={day} onChange={e => { setDay(e.target.value.replace(/\D/g, '').slice(0, 2)); setErr(''); }} placeholder="Ej. 12" aria-label="Día de cobro" /></Field>
      {err && <div role="alert" style={{ fontSize: 13, color: 'var(--color-negative)' }}>{err}</div>}
      <button type="submit" className="btn btn-primary btn-block" style={{ height: 46, borderRadius: 12 }}>Guardar</button>
      {existing && <button type="button" className="btn btn-ghost btn-block" style={{ height: 40, color: 'var(--color-negative)' }} onClick={() => store.deleteSub(existing.id)}>Borrar suscripción</button>}
    </form>
  );
}

/** Filtrar Analítica (estilo Incomes): periodo (mes o año) y carpetas. */
export function FilterSheet({ store }: { store: Store }) {
  const { s } = store;
  const [period, setPeriod] = useState(s.an.period);
  const [sel, setSel] = useState<FolderId[] | null>(s.an.folders);
  const all = sel === null;
  const toggle = (id: FolderId) => setSel(cur => {
    const base = cur ?? FOLDERS.map(f => f.id);
    const next = base.includes(id) ? base.filter(x => x !== id) : [...base, id];
    return next.length === FOLDERS.length ? null : next;
  });
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ fontSize: 20, fontWeight: 500 }}>Filtrar</div>
      <div>
        <div className="eyebrow" style={{ marginBottom: 6 }}>Periodo</div>
        <Segmented label="Periodo" value={period} options={[['mes', 'Mes'], ['año', 'Año']]} onChange={setPeriod} />
      </div>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
          <span className="eyebrow">Carpetas</span>
          <button type="button" className="link-btn" style={{ fontSize: 13 }} onClick={() => setSel(all ? [] : null)}>{all ? 'Quitar todas' : 'Todas'}</button>
        </div>
        <div className="group">
          {FOLDERS.map(f => {
            const on = all || sel!.includes(f.id);
            return (
              <button type="button" key={f.id} role="checkbox" aria-checked={on} className="group-row" onClick={() => toggle(f.id)}>
                <span className="gicon" style={{ background: 'var(--color-surface-2)', color: 'var(--color-neutral-200)' }}><Icon name={'ph ph-' + f.icon} /></span>
                {f.name}
                <span className="gend"><Icon name={on ? 'ph-fill ph-check-circle' : 'ph ph-circle'} style={{ fontSize: 20, color: on ? 'var(--color-accent)' : 'var(--color-neutral-600)' }} /></span>
              </button>
            );
          })}
        </div>
      </div>
      <button type="button" className="btn btn-primary btn-block" style={{ height: 46, borderRadius: 12 }} disabled={sel !== null && sel.length === 0}
        onClick={() => { store.setAn({ period, folders: sel }); store.closeSheet(); }}>Aplicar</button>
    </div>
  );
}

/** Exportar a Excel (.csv): este mes o todo; en el iPhone abre Compartir (Guardar en Archivos, WhatsApp, Excel…). */
export function ExportSheet({ store }: { store: Store }) {
  const { s } = store;
  const cur = monthKey(new Date());
  const [range, setRange] = useState<'mes' | 'todo'>('mes');
  const [busy, setBusy] = useState(false);
  const month = range === 'mes' ? cur : null;
  const count = s.txs.filter(t => t.amt > 0 && (!month || monthKeyOf(t.date) === month)).length + s.incomes.filter(i => !month || monthKeyOf(i.date) === month).length;
  const run = async () => {
    setBusy(true);
    const name = csvName(month), csv = buildCsv(s.txs, s.incomes, s.subs, month);
    try {
      const file = new File([csv], name, { type: 'text/csv' });
      const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
      if (nav.canShare?.({ files: [file] }) && /iPhone|iPad|Android/i.test(navigator.userAgent)) {
        await nav.share({ files: [file], title: name });
      } else {
        const url = URL.createObjectURL(file), a = document.createElement('a');
        a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
      }
      store.flash(`${count} movimientos exportados`, 'ph ph-microsoft-excel-logo');
      store.closeSheet();
    } catch (e) {
      if ((e as Error)?.name !== 'AbortError') store.flash('No se pudo exportar. Inténtalo de nuevo.', 'ph ph-warning');
    } finally { setBusy(false); }
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ fontSize: 20, fontWeight: 500 }}>Exportar a Excel</div>
      <div className="row-sub" style={{ lineHeight: 1.45 }}>Un archivo .csv con fecha, hora, tipo, descripción, carpeta, monto (gastos en negativo, ingresos en positivo), origen y suscripción. Ábrelo con Excel, Numbers o Google Sheets.</div>
      <Segmented label="Qué exportar" value={range} options={[['mes', 'Este mes'], ['todo', 'Todo']]} onChange={setRange} />
      <button type="button" className="btn btn-primary btn-block" style={{ height: 46, borderRadius: 12, gap: 8 }} disabled={busy || !count} onClick={run}>
        <Icon name="ph ph-export" />{count ? `Exportar ${count} movimientos` : 'No hay movimientos en este periodo'}
      </button>
    </div>
  );
}
