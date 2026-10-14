import { DEFAULT_FOLDERS, type Budgets, type Card, type Folder, type Goal, type Income, type Prios, type Profile, type Tx } from '../domain/data';
import { monthKey } from '../domain/dates';
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
  /** Tus carpetas (nombre, ícono, grupo). */
  folders: Folder[];
  /** Plan base: con este empieza cada mes. `budgets` es el plan del mes en curso. */
  template: Budgets;
  incomes: Income[];
  /** Mes al que corresponde `budgets` ("2026-10"). */
  monthKey: string;
}

export const PERSISTED_KEYS = ['phase', 'profile', 'income', 'prios', 'budgets', 'txs', 'cards', 'goals', 'strat', 'messages', 'folders', 'template', 'incomes', 'monthKey'] as const satisfies readonly (keyof Persisted)[];

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

/** Completa datos guardados por versiones anteriores de la app (sin carpetas propias, plan base ni ingresos). */
export function migrate(p: Persisted): Persisted {
  const folders = Array.isArray(p.folders) && p.folders.length
    ? p.folders
    : DEFAULT_FOLDERS.map(f => ({ ...f }));
  const fixed = folders.map(f => (f.id === 'deudas' && f.name === 'Pago de tarjetas' ? { ...f, name: 'Pago de deudas' } : f));
  const budgets = { ...p.budgets };
  fixed.forEach(f => { if (typeof budgets[f.id] !== 'number') budgets[f.id] = 0; });
  return {
    ...p, folders: fixed, budgets,
    template: p.template && typeof p.template === 'object' ? { ...budgets, ...p.template } : { ...budgets },
    incomes: Array.isArray(p.incomes) ? p.incomes : [],
    monthKey: typeof p.monthKey === 'string' ? p.monthKey : monthKey(new Date()),
  };
}
