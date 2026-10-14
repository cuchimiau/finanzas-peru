import type { Budgets, Card, Goal, Prios, Profile, Tx } from '../domain/data';
import type { Strategy } from '../domain/debts';
import type { Move } from '../domain/plan';

export type ChatMsg =
  | { kind: 'text'; role: 'user' | 'assistant'; text: string }
  | { kind: 'plan'; id: string; resumen: string; moves: Move[]; applied: boolean };

/** Todo lo que se guarda en el teléfono y en Drive (datos.json). */
export interface Persisted {
  v: 2;
  phase: 'onb' | 'app';
  profile: Profile;
  income: string;
  prios: Prios;
  budgets: Budgets;
  txs: Tx[];
  cards: Card[];
  goals: Goal[];
  strat: Strategy;
  messages: ChatMsg[];
}

export const PERSISTED_KEYS = ['phase', 'profile', 'income', 'prios', 'budgets', 'txs', 'cards', 'goals', 'strat', 'messages'] as const satisfies readonly (keyof Persisted)[];

export const pickPersisted = (s: Persisted): Persisted => {
  const out = { v: 2 } as Persisted;
  for (const k of PERSISTED_KEYS) (out as unknown as Record<string, unknown>)[k] = s[k];
  return out;
};

/** Revisa que un estado que viene de Drive tenga la forma esperada antes de usarlo. */
export function isPersisted(x: unknown): x is Persisted {
  if (!x || typeof x !== 'object') return false;
  const o = x as Record<string, unknown>;
  return o.v === 2 && (o.phase === 'onb' || o.phase === 'app') && !!o.budgets && typeof o.budgets === 'object'
    && Array.isArray(o.txs) && Array.isArray(o.cards) && Array.isArray(o.goals) && Array.isArray(o.messages);
}
