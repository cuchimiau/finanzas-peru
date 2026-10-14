import type { Card, Tx } from '../domain/data';
import { matchCard } from '../domain/cards';
import { parseAmount } from '../domain/format';
import { guessFolder, learnedFolder } from '../domain/plan';
import type { Persisted } from '../state/persisted';
import type { InboxItem } from './backend';

export const byDateDesc = (a: Tx, b: Tx) => b.date.localeCompare(a.date);

const NUM = String.raw`(\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)`;

/**
 * Entiende una frase dictada a Siri: "25 soles en Tambo con BBVA", "s/ 12.50 Inkafarma",
 * "gasté 40 en taxi", "25 con 50 en Wong" (= 25.50). Devuelve monto (0 si no hay), comercio y tarjeta.
 */
export function parseSpoken(raw: string, cards: Card[]): { amt: number; merchant: string; card: string } {
  let s = ` ${raw.toLowerCase().replace(/\s+/g, ' ').trim()} `;
  // Tarjeta: "con <nombre de tarjeta>" (si coincide con una de las tuyas) o "con yape/efectivo".
  let card = '';
  for (const c of cards) {
    const n = c.name.toLowerCase();
    const first = n.split(' ')[0];
    const hit = [n, first].find(x => x.length >= 3 && s.includes(' con ' + x));
    if (hit) { card = c.name; s = s.replace(' con ' + hit, ' '); break; }
  }
  if (!card) { const m = s.match(/ con (yape|plin|efectivo|cash)\b/); if (m) { card = m[1]; s = s.replace(m[0], ' '); } }
  // Monto: "25 con 50" → 25.50; si no, el primer número.
  let amt = 0;
  const conM = s.match(new RegExp(String.raw`(\d+) con (\d{1,2})\b`));
  if (conM) { amt = Number(conM[1]) + Number(conM[2].padEnd(2, '0')) / 100; s = s.replace(conM[0], ' '); }
  else {
    const m = s.match(new RegExp(String.raw`(?:s/\.?\s*)?` + NUM + String.raw`\s*(?:soles|sol|lucas|s/)?`));
    if (m) { amt = parseAmount(m[1]); s = s.replace(m[0], ' '); }
  }
  const STOP = new Set(['gasté', 'gaste', 'pagué', 'pague', 'compré', 'compre', 'pago', 'gasto', 'de', 'en', 'por', 'el', 'la', 'los', 'las', 'un', 'una', 'sol', 'soles', 's/', 'y']);
  const merchant = s.replace(/[.,;:!¡?¿]/g, ' ').split(' ').filter(w => w && !STOP.has(w)).join(' ');
  return { amt, merchant: merchant ? merchant.replace(/(^|\s)\S/g, x => x.toUpperCase()) : '', card };
}

/** Convierte lo que dejó el Atajo (Siri o Wallet) en movimientos, sin duplicar. Sin monto → pendiente. */
export function inboxToTxs(inbox: InboxItem[], cards: Card[], existing: Tx[]): Tx[] {
  const seen = new Set(existing.map(t => t.id));
  const out: Tx[] = [];
  for (const it of inbox) {
    const id = 'ap-' + it.id;
    if (seen.has(id)) continue;
    const spoken = it.text ? parseSpoken(it.text, cards) : null;
    const amt = spoken ? spoken.amt : parseAmount(it.amount);
    const rawName = (spoken ? spoken.merchant : (it.merchant || '')).trim().slice(0, 80);
    if (!rawName && amt <= 0) continue;
    seen.add(id);
    const source: Tx['source'] = spoken ? 'siri' : 'applepay';
    const name = rawName || (spoken ? 'Gasto por Siri' : 'Pago con Apple Pay');
    const cardRaw = spoken ? spoken.card : it.card || '';
    const pay = cardRaw === 'yape' || cardRaw === 'plin' ? 'yape' : cardRaw === 'efectivo' || cardRaw === 'cash' ? 'cash'
      : spoken && !cardRaw ? 'cash' : matchCard(cardRaw, cards);
    const learned = learnedFolder(name, existing);
    const g = guessFolder(name);
    const date = Number.isNaN(new Date(it.at).getTime()) ? new Date().toISOString() : new Date(it.at).toISOString();
    const via = spoken ? 'Registrado con Siri' : 'Llegó por Apple Pay';
    out.push({
      id, name, amt, date, pay, source, pending: amt <= 0 || undefined,
      f: learned || g.id || 'libre',
      why: (amt <= 0 ? `${via} sin monto: escríbelo abajo. ` : `${via}. `) + (learned ? 'Carpeta: la que usaste la última vez.'
        : g.confident ? 'Carpeta por el tipo de comercio.' : 'No reconocí el comercio y lo puse en Libre: tócalo para cambiarlo.'),
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
  const rIn = remote.incomes || [], lIn = local.incomes || [];
  const incIds = new Set(rIn.map(i => i.id));
  const incomes = [...rIn, ...lIn.filter(i => !incIds.has(i.id))];
  return { ...remote, txs, messages, incomes };
}
