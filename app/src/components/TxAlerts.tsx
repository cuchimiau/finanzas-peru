import { fmt } from '../domain/format';
import { Icon } from './common';
import type { Store } from '../state/store';

/** Cuántos movimientos piden algo (monto, carpeta o posible duplicado): se muestra en la pestaña Lista. */
export const txAlertCount = (store: Store) => store.s.txs.filter(t => t.pending || t.needsFolder || t.dup).length;

/** Avisos de movimientos por completar (arriba de la Lista). */
export function TxAlerts({ store }: { store: Store }) {
  const { s } = store;
  if (!txAlertCount(store)) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
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
    </div>
  );
}
