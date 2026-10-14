import type { KeyboardEvent, ReactNode } from 'react';
import type { FolderView } from '../domain/plan';
import type { TxView } from '../state/selectors';

/** Props para que un div clicable también funcione con teclado. */
export const pressable = (onActivate: () => void, cls = '') => ({
  role: 'button' as const,
  tabIndex: 0,
  className: ('clickable ' + cls).trim(),
  onClick: onActivate,
  onKeyDown: (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onActivate(); } },
});

export const Icon = ({ name, style }: { name: string; style?: React.CSSProperties }) => <i className={name} style={style} aria-hidden="true" />;

export const Spinner = ({ size, color }: { size: number; color?: string }) => (
  <i className="ph ph-circle-notch spin" style={{ fontSize: size, color }} aria-hidden="true" />
);

export const Track = ({ w, color, height = 3, bg = 'var(--color-neutral-900)', style }: { w: string; color: string; height?: number; bg?: string; style?: React.CSSProperties }) => (
  <div className="track" style={{ height, borderRadius: Math.max(2, Math.floor(height / 2)), background: bg, ...style }}>
    <div style={{ width: w, background: color }} />
  </div>
);

export function FolderRow({ f, onOpen, divider }: { f: FolderView; onOpen: () => void; divider?: boolean }) {
  return (
    <div {...pressable(onOpen)} style={{ padding: '10px 0', borderBottom: divider ? '1px solid var(--color-divider)' : undefined }}>
      <div className="row">
        <div className="ibox"><Icon name={f.icon} /></div>
        <div className="row-main">
          <div className="row-title">{f.name}</div>
          <div className="row-sub tnum">{f.ofL}</div>
        </div>
        <div className="row-end">
          <div className="tnum" style={{ fontSize: 15, fontWeight: 500, color: f.leftColor }}>{f.leftL}</div>
          <div style={{ fontSize: 11.5, color: 'var(--color-neutral-500)' }}>{f.leftLabel}</div>
        </div>
      </div>
      <Track w={f.barW} color={f.barColor} style={{ margin: '8px 0 0 48px' }} />
    </div>
  );
}

/** Movimiento. `variant` replica las tres presentaciones del diseño. */
export function TxRow({ t, onOpen, variant }: { t: TxView; onOpen: () => void; variant: 'recent' | 'folder' | 'credit' }) {
  const box = variant === 'credit' ? <div className="ibox" style={{ fontSize: 17 }}><Icon name={t.icon} /></div>
    : <div className="ibox lg"><Icon name={variant === 'folder' ? t.srcIcon : t.icon} /></div>;
  return (
    <div {...pressable(onOpen)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: variant === 'credit' ? '1px solid var(--color-divider)' : undefined }}>
      {box}
      <div className="row-main">
        <div className="row-title">{t.name}</div>
        {variant === 'folder' ? <div className="row-sub">{t.sub}</div>
          : <div className="row-sub with-icon"><Icon name={t.srcIcon} />{t.sub}</div>}
      </div>
      {variant === 'recent' ? (
        <div className="row-end">
          <div className="tnum" style={{ fontSize: 14 }}>{t.amtL}</div>
          <div style={{ fontSize: 11.5, color: t.tagColor }}>{t.folderName}</div>
        </div>
      ) : <div className="tnum" style={{ fontSize: 14 }}>{t.amtL}</div>}
    </div>
  );
}

export interface SourceBtn { label: string; icon: string; on?: boolean; busy?: boolean; disabled?: boolean; onClick?: () => void }

export function SourceCard({ icon, name, sub, how, btn, ground }: { icon: string; name: string; sub: string; how: string; btn: SourceBtn; ground: string }) {
  return (
    <div style={{ padding: '10px 12px', borderRadius: 12, background: ground }}>
      <div className="row">
        <div className="ibox dark"><Icon name={icon} /></div>
        <div className="row-main"><div className="row-title">{name}</div><div className="row-sub">{sub}</div></div>
        <button className={'pill-toggle' + (btn.on ? ' on' : btn.busy ? ' busy' : '')} onClick={btn.onClick} disabled={btn.disabled} aria-pressed={btn.on}>
          <Icon name={btn.icon} />{btn.label}
        </button>
      </div>
      <div style={{ fontSize: 12, lineHeight: 1.45, color: 'var(--color-neutral-400)', margin: '8px 0 0 48px' }}>{how}</div>
    </div>
  );
}

/** Campo de formulario con etiqueta, en el estilo de las hojas. */
export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label style={{ display: 'block' }}>
      <span style={{ display: 'block', fontSize: 12, color: 'var(--color-neutral-400)', marginBottom: 5 }}>{label}</span>
      {children}
      {hint && <span style={{ display: 'block', fontSize: 11.5, color: 'var(--color-neutral-500)', marginTop: 4, lineHeight: 1.4 }}>{hint}</span>}
    </label>
  );
}

export const inputStyle: React.CSSProperties = { width: '100%', boxSizing: 'border-box', height: 44, borderRadius: 11, fontSize: 15 };

/** Selector de dos o tres opciones (Débito / Crédito, etc.). */
export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: [T, string][]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="seg" style={{ display: 'flex' }} role="radiogroup" aria-label={label}>
      {options.map(([id, l]) => (
        <button type="button" key={id} role="radio" aria-checked={value === id} className={'seg-btn' + (value === id ? ' on' : '')} onClick={() => onChange(id)}>{l}</button>
      ))}
    </div>
  );
}

export const SectionHeader = ({ title, right }: { title: string; right?: ReactNode }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
    <span className="section-title">{title}</span>{right}
  </div>
);

export const SparkleButton = ({ label, onClick, style }: { label: string; onClick: () => void; style?: React.CSSProperties }) => (
  <button className="btn btn-primary" onClick={onClick} style={{ height: 38, borderRadius: 10, gap: 6, ...style }}>
    <Icon name="ph ph-sparkle" />{label}
  </button>
);
