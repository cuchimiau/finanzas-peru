import type { Card, Tx } from '../domain/data';
import { matchCard } from '../domain/cards';
import { parseAmount } from '../domain/format';
import { guessFolder, learnedFolder } from '../domain/plan';
import type { Persisted } from '../state/persisted';
import type { InboxItem } from './backend';

export const byDateDesc = (a: Tx, b: Tx) => b.date.localeCompare(a.date);

/** Convierte los pagos que dejó el Atajo de Apple Pay en movimientos (sin duplicar). */
export function inboxToTxs(inbox: InboxItem[], cards: Card[], existing: Tx[]): Tx[] {
  const seen = new Set(existing.map(t => t.id));
  const out: Tx[] = [];
  for (const it of inbox) {
    const id = 'ap-' + it.id;
    const amt = parseAmount(it.amount);
    if (seen.has(id) || amt <= 0) continue;
    seen.add(id);
    const name = (it.merchant || '').trim().slice(0, 80) || 'Pago con Apple Pay';
    const learned = learnedFolder(name, existing);
    const g = guessFolder(name);
    const date = Number.isNaN(new Date(it.at).getTime()) ? new Date().toISOString() : new Date(it.at).toISOString();
    out.push({
      id, name, amt, date, pay: matchCard(it.card || '', cards), source: 'applepay',
      f: learned || g.id || 'libre',
      why: learned ? 'Lo pusiste aquí la última vez. Llegó por Apple Pay.'
        : g.confident ? 'Llegó por Apple Pay. Carpeta por el tipo de comercio.'
          : 'Llegó por Apple Pay. No reconocí el comercio y lo puse en Libre: tócalo para cambiarlo.',
    });
  }
  return out;
}

/**
 * Conflicto (otro dispositivo guardó antes): gana la versión de Drive,
 * pero no se pierde ningún movimiento registrado en este teléfono.
 */
export function mergeRemote(remote: Persisted, local: Persisted): Persisted {
  const ids = new Set(remote.txs.map(t => t.id));
  const txs = [...remote.txs, ...local.txs.filter(t => !ids.has(t.id))].sort(byDateDesc);
  const messages = local.messages.length > remote.messages.length ? local.messages : remote.messages;
  return { ...remote, txs, messages };
}
