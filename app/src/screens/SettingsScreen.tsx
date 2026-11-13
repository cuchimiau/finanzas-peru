import { fmt0 } from '../domain/format';
import { Icon } from '../components/common';
import type { Derived } from '../state/selectors';
import type { Store } from '../state/store';
import { Settings } from './Sheets';

/** Fila de lista agrupada estilo Ajustes de iPhone: ícono de color, nombre, dato y ›. */
function Row({ icon, color, label, end, onClick }: { icon: string; color: string; label: string; end?: string; onClick: () => void }) {
  return (
    <button type="button" className="group-row" aria-label={'Abrir ' + label} onClick={onClick}>
      <span className="gicon" style={{ background: color }}><Icon name={'ph-fill ph-' + icon} /></span>
      <span>{label}</span>
      <span className="gend">{end}<Icon name="ph ph-caret-right" /></span>
    </button>
  );
}

/** Pestaña Ajustes (estilo Incomes): accesos agrupados + los ajustes de siempre (perfil, Drive, atajos). */
export function SettingsScreen({ store, d }: { store: Store; d: Derived }) {
  const { s } = store;
  return (
    <div className="rise" style={{ padding: '8px 16px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div className="page-title">Ajustes</div>
      <div className="group">
        <Row icon="credit-card" color="#396df0" label="Deudas" end={d.debts.length ? fmt0(d.debtTotal) : 'Sin deudas'} onClick={() => store.goTab('debts')} />
        <Row icon="sparkle" color="#943acc" label="Asesor" onClick={() => store.goTab('advisor')} />
        <Row icon="wallet" color="#62cb5e" label="Tu dinero del mes" end={d.money.known ? fmt0(d.money.real) : 'Escribir'} onClick={() => store.openSheet('close')} />
      </div>
      <div className="group">
        <Row icon="plugs-connected" color="#56a2cd" label="Cómo leemos tus gastos" onClick={() => store.openSheet('connect')} />
        <Row icon="cloud-check" color="#e48a33" label="Drive" end={s.conn ? 'Conectado' : 'Sin conectar'} onClick={() => document.getElementById('ajustes-drive')?.scrollIntoView({ behavior: 'smooth' })} />
      </div>
      <div><Settings store={store} embedded /></div>
    </div>
  );
}
