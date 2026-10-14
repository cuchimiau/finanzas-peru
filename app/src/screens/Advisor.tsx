import { SUGGESTIONS, folderName } from '../domain/data';
import { fmt0 } from '../domain/format';
import { Icon, Spinner } from '../components/common';
import type { Store } from '../state/store';

export function Advisor({ store }: { store: Store }) {
  const { s } = store;
  return (
    <div style={{ padding: '4px 20px 12px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '4px 0 6px' }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, border: '1px solid var(--color-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-accent-300)', fontSize: 20, boxShadow: '0 0 20px var(--color-accent-800)' }}>
          <Icon name="ph ph-sparkle" />
        </div>
        <div>
          <div style={{ fontSize: 17, fontWeight: 500 }}>Tu asesor</div>
          <div className="row-sub">Gemini · conoce tus carpetas, deudas y metas</div>
        </div>
      </div>

      {!s.conn && (
        <button type="button" className="hint-card" onClick={() => store.openSheet('settings')} style={{ display: 'flex', gap: 10, fontSize: 13, lineHeight: 1.45, color: 'var(--color-neutral-300)', background: 'transparent', textAlign: 'left', cursor: 'pointer' }}>
          <Icon name="ph ph-plugs" style={{ fontSize: 17, color: 'var(--color-accent-300)', marginTop: 1 }} />
          <span>Para usar el asesor, conecta tu Apps Script en Ajustes: ahí vive tu clave de Gemini.</span>
        </button>
      )}
      {s.messages.length === 0 && s.conn && (
        <div style={{ fontSize: 13, color: 'var(--color-neutral-400)', lineHeight: 1.5 }}>Pregúntame cómo vas este mes, qué tarjeta pagar primero o cómo llegar a tus metas.</div>
      )}

      <div role="log" aria-live="polite" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {s.messages.map((m, i) => (
          <div key={m.kind === 'plan' ? m.id : i} style={{ display: 'flex', justifyContent: m.kind === 'text' && m.role === 'user' ? 'flex-end' : 'flex-start', animation: 'rise .3s ease' }}>
            {m.kind === 'text' ? (
              <div style={{
                maxWidth: '86%', padding: '10px 13px', fontSize: 14, lineHeight: 1.5, whiteSpace: 'pre-wrap',
                borderRadius: m.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                background: m.role === 'user' ? 'var(--color-accent-900)' : 'var(--color-surface)',
                border: '1px solid ' + (m.role === 'user' ? 'var(--color-accent-700)' : 'transparent'),
              }}>{m.text}</div>
            ) : (
              <div className="accent-card" style={{ width: '100%', background: 'linear-gradient(170deg, var(--color-accent-900), var(--color-surface))' }}>
                <div className="eyebrow">Propuesta de ajuste</div>
                <div style={{ fontSize: 14, lineHeight: 1.45, margin: '6px 0 10px' }}>{m.resumen}</div>
                {m.moves.map((mv, j) => (
                  <div key={j} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, padding: '7px 0', borderTop: '1px solid var(--color-divider)' }}>
                    <span style={{ color: 'var(--color-neutral-300)' }}>{folderName(mv.de)}</span>
                    <Icon name="ph ph-arrow-right" style={{ color: 'var(--color-neutral-500)' }} />
                    <span style={{ flex: 1 }}>{folderName(mv.a)}</span>
                    <span className="tnum" style={{ color: 'var(--color-accent-300)' }}>{fmt0(mv.monto)}</span>
                  </div>
                ))}
                <button className="btn btn-primary btn-block" onClick={() => store.applyPlan(m.id)} disabled={m.applied} style={{ height: 42, borderRadius: 11, marginTop: 10 }}>
                  {m.applied ? 'Aplicado' : 'Aplicar a mis carpetas'}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
      {s.thinking && (
        <div role="status" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--color-neutral-500)' }}>
          <Spinner size={16} color="var(--color-accent-300)" />Revisando tus carpetas…
        </div>
      )}
    </div>
  );
}

export function Composer({ store }: { store: Store }) {
  const { s } = store;
  return (
    <div style={{ padding: '8px 16px 10px', display: 'flex', flexDirection: 'column', gap: 8, borderTop: '1px solid var(--color-divider)' }}>
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto' }}>
        {SUGGESTIONS.map(l => <button key={l} className="sug-chip" disabled={s.thinking} onClick={() => store.ask(l)}>{l}</button>)}
      </div>
      <form style={{ display: 'flex', gap: 8, alignItems: 'center' }} onSubmit={e => { e.preventDefault(); store.ask(s.draft); }}>
        <input type="text" className="input" placeholder="Pregúntale a tu asesor…" aria-label="Mensaje para tu asesor" value={s.draft} maxLength={2000}
          onChange={e => store.setDraft(e.target.value)} style={{ flex: 1, minWidth: 0, height: 42, borderRadius: 21, padding: '0 16px', fontSize: 14 }} />
        <button type="submit" className="btn btn-icon btn-primary" aria-label="Enviar" disabled={s.thinking} style={{ width: 42, height: 42, borderRadius: 21, fontSize: 18 }}>
          <Icon name="ph ph-paper-plane-right" />
        </button>
      </form>
    </div>
  );
}
