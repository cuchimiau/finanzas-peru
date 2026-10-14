import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@phosphor-icons/web/regular';
import '@phosphor-icons/web/fill';
import './styles/nocturne.css';
import './styles/app.css';
import { App } from './App';

// ?reset=1 → borra lo guardado en este teléfono (Drive no se toca).
const q = new URLSearchParams(location.search);
if (q.has('reset')) history.replaceState(null, '', location.pathname);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App reset={q.get('reset') === '1'} />
  </StrictMode>,
);

// App instalable: guarda los archivos para abrir sin señal.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => { navigator.serviceWorker.register(import.meta.env.BASE_URL + 'sw.js').catch(() => {}); });
}
