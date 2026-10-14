import type { Card, Debt, PayRef, Tx } from './data';
import { nextDueLabel } from './dates';

export interface PayInfo { label: string; short: string; ap: boolean; credit: boolean; card: Card | null }

export function payInfo(pay: PayRef, cards: Card[]): PayInfo {
  if (pay === 'cash') return { label: 'Efectivo', short: 'Efectivo', ap: false, credit: false, card: null };
  if (pay === 'yape') return { label: 'Yape', short: 'Yape', ap: false, credit: false, card: null };
  const card = cards.find(c => c.id === pay) || null;
  if (!card) return { label: 'Apple Pay', short: 'Apple Pay', ap: true, credit: false, card: null };
  const kind = card.kind === 'credit' ? 'Crédito' : 'Débito';
  return { label: `${card.name} · ${kind}`, short: card.name, ap: card.applePay, credit: card.kind === 'credit', card };
}

/** ¿Se pagó con Apple Pay? Solo lo sabemos con certeza si llegó por el Atajo. */
export const viaApplePay = (t: Pick<Tx, 'pay' | 'source'>) => t.source === 'applepay' || t.pay === 'applepay';

/** Ícono del medio de pago (Apple Pay, Yape, efectivo o tarjeta). */
export const payIcon = (t: Pick<Tx, 'pay' | 'source'>) =>
  viaApplePay(t) ? 'ph ph-apple-logo' : t.pay === 'yape' ? 'ph ph-device-mobile' : t.pay === 'cash' ? 'ph ph-money' : 'ph ph-credit-card';

/** Medios de pago para registrar un gasto a mano. */
export const payChoices = (cards: Card[]): { id: PayRef; label: string; icon: string }[] => [
  { id: 'cash', label: 'Efectivo', icon: 'ph ph-money' },
  { id: 'yape', label: 'Yape', icon: 'ph ph-device-mobile' },
  ...cards.map(c => ({ id: c.id, label: c.name, icon: 'ph ph-credit-card' })),
];

/**
 * Elige la tarjeta de un pago que llegó por el Atajo: por nombre o últimos 4 dígitos;
 * si no coincide, la primera tarjeta con Apple Pay; si no hay, "applepay".
 */
export function matchCard(raw: string, cards: Card[]): PayRef {
  const s = (raw || '').toLowerCase().trim();
  if (s) {
    const digits = s.match(/\d{4}/)?.[0];
    const hit = cards.find(c => (digits && c.name.includes(digits)) || s.includes(c.name.toLowerCase()) || c.name.toLowerCase().includes(s));
    if (hit) return hit.id;
  }
  return cards.find(c => c.applePay)?.id || 'applepay';
}

/** Deudas = tarjetas de crédito: saldo informado + lo cargado después de esa fecha. */
export function currentDebts(cards: Card[], txs: Tx[], now = new Date()): Debt[] {
  return cards.filter(c => c.kind === 'credit').map(c => {
    const since = new Date(c.balDate || 0).getTime();
    const charges = txs.filter(t => t.pay === c.id && new Date(t.date).getTime() > since).reduce((a, t) => a + t.amt, 0);
    return { id: c.id, name: c.name, bal: Math.round((c.bal + charges) * 100) / 100, limit: c.limit, tcea: c.tcea, min: c.min, due: nextDueLabel(c.dueDay, now), cuotas: c.cuotas };
  }).filter(d => d.bal > 0.5);
}

export const minPayments = (cards: Card[]) => cards.filter(c => c.kind === 'credit' && c.bal > 0).reduce((a, c) => a + c.min, 0);

export const newCardId = () => 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

export const emptyCard = (): Card => ({
  id: newCardId(), name: '', kind: 'credit', applePay: true, limit: 0, bal: 0, balDate: new Date().toISOString(), tcea: 0, min: 0, dueDay: 5, cuotas: '',
});
