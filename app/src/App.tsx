import { useEffect, useMemo, useRef } from 'react';
import { Icon } from './components/common';
import { derive } from './state/selectors';
import { useFinanceStore, type StoreOptions, type Tab } from './state/store';
import { Onboarding } from './screens/Onboarding';
import { Home } from './screens/Home';
import { Folders } from './screens/Folders';
import { Debts } from './screens/Debts';
import { Metrics } from './screens/Metrics';
import { Advisor, Composer } from './screens/Advisor';
import { SheetHost } from './screens/Sheets';

const TABS: [Tab, string, string][] = [
  ['home', 'Inicio', 'house'], ['folders', 'Carpetas', 'folders'], ['debts', 'Deudas', 'credit-card'],
  ['metrics', 'Métricas', 'chart-bar'], ['advisor', 'Asesor', 'sparkle'],
];

export function App(props: StoreOptions) {
  const store = useFinanceStore(props);
  const { s } = store;
  const d = useMemo(() => derive(s), [s]);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Al cambiar de pestaña o carpeta, vuelve arriba.
  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = 0; }, [s.tab, s.folderId]);
  // En el asesor, baja al último mensaje.
  useEffect(() => {
    const el = scrollRef.current;
    if (el && s.tab === 'advisor') { const t = setTimeout(() => { el.scrollTop = el.scrollHeight; }, 30); return () => clearTimeout(t); }
  }, [s.tab, s.messages.length, s.thinking]);

  return (
    <div className="stage">
      <div className="device">
        <div className="screen">
          <div className="statusbar" aria-hidden="true">
            <span>9:41</span>
            <div className="island" />
            <div className="icons"><Icon name="ph-fill ph-cell-signal-full" /><Icon name="ph ph-wifi-high" /><Icon name="ph-fill ph-battery-full" /></div>
          </div>

          {s.phase === 'onb' ? <Onboarding store={store} d={d} /> : (
            <>
              <main ref={scrollRef} style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', position: 'relative' }}>
                {s.tab === 'home' && <Home store={store} d={d} />}
                {s.tab === 'folders' && <Folders store={store} d={d} />}
                {s.tab === 'debts' && <Debts store={store} d={d} />}
                {s.tab === 'metrics' && <Metrics store={store} d={d} />}
                {s.tab === 'advisor' && <Advisor store={store} />}
              </main>
              {s.tab === 'advisor' && <Composer store={store} />}
              <nav className="tabbar" aria-label="Secciones">
                {TABS.map(([id, label, icon]) => (
                  <button key={id} className={'tab' + (s.tab === id ? ' on' : '')} aria-current={s.tab === id ? 'page' : undefined} onClick={() => store.goTab(id)}>
                    <Icon name={(s.tab === id ? 'ph-fill ph-' : 'ph ph-') + icon} />{label}
                  </button>
                ))}
              </nav>
            </>
          )}

          <SheetHost store={store} d={d} />

          {s.toast && (
            <div className="toast-wrap" role="status" style={{ position: 'absolute', left: 20, right: 20, zIndex: 30, padding: '12px 14px', borderRadius: 12, background: 'var(--color-neutral-900)', boxShadow: 'var(--shadow-md)', fontSize: 13, display: 'flex', gap: 8, alignItems: 'center', animation: 'rise .25s ease' }}>
              <Icon name={s.toastIcon} style={{ color: 'var(--color-accent-300)', fontSize: 17 }} /><span style={{ flex: 1 }}>{s.toast}</span>
            </div>
          )}

          <div className="home-indicator" aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}
