import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DEFAULT_GOALS, DEFAULT_PRIOS, FM, FOLDER_IDS, isFolderId,
  type Budgets, type Card, type FolderId, type Goal, type GoalId, type PayRef, type PrioId, type Tx,
} from '../domain/data';
import { fmt, fmt0, parseAmount } from '../domain/format';
import type { Strategy } from '../domain/debts';
import { minPayments } from '../domain/cards';
import { applyMoves, buildBudgets, guessFolder, learnedFolder, planChange, planIncome, sanitizeMoves, txsOfMonth, type Take } from '../domain/plan';
import { monthKey } from '../domain/dates';
import { buildGeminiRequest, type ChatTurn, type GeminiResponse } from '../domain/advisor';
import {
  BackendError, call, loadConnection, saveConnection,
  type Connection, type LoadResponse, type PingResponse, type SaveResponse,
} from '../sync/backend';
import { byDateDesc, inboxToTxs, mergeRemote } from '../sync/merge';
import { PERSISTED_KEYS, isPersisted, pickPersisted, type ChatMsg, type Persisted } from './persisted';

export type { ChatMsg } from './persisted';
export type Tab = 'home' | 'folders' | 'debts' | 'metrics' | 'advisor';
export type Sheet = 'recat' | 'connect' | 'add' | 'card' | 'goal' | 'settings' | null;
export type SyncStatus = 'off' | 'idle' | 'syncing' | 'offline' | 'error';

export interface SyncMeta { rev: number | null; dirty: boolean; lastSync: number | null }

export interface State extends Persisted {
  step: number; analyzing: boolean;
  tab: Tab; folderId: FolderId | null; sheet: Sheet; rcId: string | null; cardId: string | null; goalId: GoalId | null;
  addAmt: string; addName: string; addPay: PayRef;
  toast: string; toastIcon: string; adjustNote: string; draft: string; thinking: boolean;
  conn: Connection | null; sync: SyncStatus; syncError: string;
  meta: SyncMeta;
}

const STORAGE_KEY = 'finanzas-peru:v2';
const META_KEY = 'finanzas-peru:v2:sync';
const SAVE_DELAY = 2000;

function freshPersisted(): Persisted {
  const prios = DEFAULT_PRIOS;
  return {
    v: 2, phase: 'onb', profile: { name: '' }, income: '', prios,
    budgets: buildBudgets(2600, { ...prios, deuda: false }), txs: [], cards: [], goals: DEFAULT_GOALS.map(g => ({ ...g })),
    strat: 'avalanche', messages: [],
  };
}

function readLocal(): { data: Persisted; meta: SyncMeta } {
  const meta: SyncMeta = { rev: null, dirty: false, lastSync: null };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const m = localStorage.getItem(META_KEY);
    const data = raw ? JSON.parse(raw) : null;
    return { data: isPersisted(data) ? data : freshPersisted(), meta: m ? { ...meta, ...JSON.parse(m) } : meta };
  } catch {
    return { data: freshPersisted(), meta };
  }
}

function initialState(reset: boolean): State {
  if (reset) { try { localStorage.removeItem(STORAGE_KEY); localStorage.removeItem(META_KEY); } catch { /* */ } }
  const { data, meta } = readLocal();
  const conn = loadConnection();
  return {
    ...data, step: 0, analyzing: false,
    tab: 'home', folderId: null, sheet: null, rcId: null, cardId: null, goalId: null,
    addAmt: '', addName: '', addPay: 'cash', toast: '', toastIcon: 'ph-fill ph-check-circle', adjustNote: '', draft: '', thinking: false,
    conn, sync: conn ? 'idle' : 'off', syncError: '', meta,
  };
}

const welcome = (name: string, b: Budgets): ChatMsg => ({
  kind: 'text', role: 'assistant',
  text: `Hola ${name.split(' ')[0] || ''}. Tu plan de ${fmt0(planIncome(b))} ya está en carpetas. Pregúntame cómo vas este mes, qué tarjeta pagar primero o cómo llegar a tus metas.`.replace('Hola .', 'Hola.'),
});

/** Lo gastado este mes por carpeta (piso para no recortar por debajo). */
export function spentMap(txs: Tx[]): Partial<Record<FolderId, number>> {
  const out: Partial<Record<FolderId, number>> = {};
  txsOfMonth(txs, monthKey(new Date())).forEach(t => { if (t.f) out[t.f] = (out[t.f] || 0) + t.amt; });
  return out;
}

export const parseIncome = (s: string) => Math.max(0, parseFloat(String(s).replace(/[^0-9.]/g, '')) || 0);

export interface StoreOptions { reset: boolean }

export function useFinanceStore(opts: StoreOptions) {
  const [s, setS] = useState<State>(() => initialState(opts.reset));
  const ref = useRef(s);
  ref.current = s;
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const syncing = useRef(false);
  const pendingAck = useRef<string[]>([]);

  /** Cambios de datos persistidos marcan el estado como "pendiente de guardar en Drive". */
  const set = useCallback((p: Partial<State> | ((st: State) => Partial<State>)) => {
    setS(st => {
      const patch = typeof p === 'function' ? p(st) : p;
      const touches = PERSISTED_KEYS.some(k => k in patch);
      return { ...st, ...patch, ...(touches && !('meta' in patch) ? { meta: { ...st.meta, dirty: true } } : {}) };
    });
  }, []);

  const flash = useCallback((msg: string, icon = 'ph-fill ph-check-circle') => {
    clearTimeout(toastTimer.current);
    set({ toast: msg, toastIcon: icon });
    toastTimer.current = setTimeout(() => set({ toast: '' }), 3200);
  }, [set]);

  // ─── Copia local (funciona sin señal) ───
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(pickPersisted(s)));
      localStorage.setItem(META_KEY, JSON.stringify(s.meta));
    } catch { /* almacenamiento lleno o bloqueado */ }
  }, [s.phase, s.profile, s.income, s.prios, s.budgets, s.txs, s.cards, s.goals, s.strat, s.messages, s.meta]); // eslint-disable-line react-hooks/exhaustive-deps

  const fail = useCallback((e: unknown) => {
    const err = e instanceof BackendError ? e : new BackendError(String(e), 'server');
    set({ sync: err.kind === 'network' || err.kind === 'timeout' ? 'offline' : 'error', syncError: err.message });
    return err;
  }, [set]);

  /** Guarda en Drive. Si otro dispositivo guardó antes, combina y reintenta una vez. */
  const push = useCallback(async (attempt = 0): Promise<void> => {
    const st = ref.current;
    if (!st.conn || syncing.current || st.phase === 'onb' || (!st.meta.dirty && !pendingAck.current.length)) return;
    syncing.current = true;
    set({ sync: 'syncing' });
    const snapshot = pickPersisted(st);
    const ack = pendingAck.current.slice();
    try {
      const res = await call<SaveResponse>(st.conn, 'save', { baseRev: st.meta.rev, state: snapshot, ackInbox: ack, sheetRows: sheetRows(snapshot) });
      syncing.current = false;
      if (res.conflict && isPersisted(res.state)) {
        const merged = mergeRemote(res.state, pickPersisted(ref.current));
        setS(x => ({ ...x, ...merged, meta: { ...x.meta, rev: res.rev, dirty: true } }));
        if (attempt < 1) setTimeout(() => void push(attempt + 1), 50);
        return;
      }
      pendingAck.current = pendingAck.current.filter(id => !ack.includes(id));
      // Si hubo cambios mientras se guardaba, queda pendiente otro guardado.
      const changed = JSON.stringify(pickPersisted(ref.current)) !== JSON.stringify(snapshot);
      setS(x => ({ ...x, sync: 'idle', syncError: '', meta: { rev: res.rev, dirty: changed, lastSync: Date.now() } }));
    } catch (e) {
      syncing.current = false;
      fail(e);
    }
  }, [fail, set]);

  /** Trae de Drive: versión más nueva + pagos de Apple Pay pendientes. */
  const pull = useCallback(async (connOverride?: Connection): Promise<boolean> => {
    const conn = connOverride ?? ref.current.conn;
    if (!conn || syncing.current) return false;
    syncing.current = true;
    set({ sync: 'syncing' });
    try {
      const res = await call<LoadResponse>(conn, 'load');
      syncing.current = false;
      const cur = ref.current;
      let next: Persisted = pickPersisted(cur);
      let dirty = cur.meta.dirty;
      let restored = false;
      if (isPersisted(res.state) && res.rev !== cur.meta.rev) {
        if (cur.phase === 'onb' && res.state.phase === 'app') { next = res.state; restored = true; dirty = false; }
        else if (dirty) next = mergeRemote(res.state, next);
        else next = res.state;
      } else if (!isPersisted(res.state)) dirty = true; // Drive vacío: subir lo local
      const fresh = inboxToTxs(res.inbox || [], next.cards, next.txs);
      if (fresh.length) { next = { ...next, txs: [...fresh, ...next.txs].sort(byDateDesc) }; dirty = true; }
      pendingAck.current = Array.from(new Set([...pendingAck.current, ...(res.inbox || []).map(i => i.id)]));
      setS(x => ({ ...x, ...next, sync: 'idle', syncError: '', meta: { rev: res.rev, dirty, lastSync: Date.now() } }));
      if (restored) flash('Recuperé tus datos desde Drive', 'ph ph-cloud-check');
      else if (fresh.length) {
        const t = fresh[0], via = t.source === 'siri' ? 'Siri' : 'Apple Pay';
        flash(fresh.length > 1 ? `${fresh.length} gastos nuevos (${via})` : t.pending ? `${via} · ${t.name}: falta el monto` : `${via} · ${t.name} ${fmt(t.amt)} → ${t.f ? FM[t.f].name : 'Por revisar'}`, t.source === 'siri' ? 'ph ph-microphone' : 'ph ph-apple-logo');
      }
      if (dirty || pendingAck.current.length) setTimeout(() => void push(), 50);
      return restored;
    } catch (e) {
      syncing.current = false;
      fail(e);
      return false;
    }
  }, [fail, flash, push, set]);

  // Al abrir, al volver a la app y al recuperar señal: traer de Drive.
  useEffect(() => {
    void pull();
    const onVis = () => { if (document.visibilityState === 'visible') void pull(); };
    const onOnline = () => void pull();
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('online', onOnline);
    return () => { document.removeEventListener('visibilitychange', onVis); window.removeEventListener('online', onOnline); };
  }, [pull]);

  // Guardado diferido tras cada cambio.
  useEffect(() => {
    if (!s.conn || !s.meta.dirty) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => void push(), SAVE_DELAY);
    return () => clearTimeout(saveTimer.current);
  }, [s.conn, s.meta, s.txs, s.budgets, s.cards, s.goals, s.messages, s.profile, s.strat, s.phase, push]);

  useEffect(() => () => { clearTimeout(toastTimer.current); clearTimeout(saveTimer.current); }, []);

  const inc = () => parseIncome(ref.current.income);
  const planFor = (st: State, income: number) =>
    buildBudgets(income, { ...st.prios, deuda: st.cards.some(c => c.kind === 'credit' && c.bal > 0) }, minPayments(st.cards));

  const actions = {
    set, flash, pull, push,
    // ─── Conexión con el Apps Script ───
    connect: async (c: Connection): Promise<PingResponse> => {
      const res = await call<PingResponse>(c, 'ping');
      saveConnection(c);
      set({ conn: c, sync: 'idle', syncError: '', meta: { ...ref.current.meta, rev: null, dirty: true } });
      await pull(c);
      return res;
    },
    disconnect: () => { saveConnection(null); set({ conn: null, sync: 'off', syncError: '' }); },
    // ─── Creación del plan ───
    setName: (name: string) => set(st => ({ profile: { ...st.profile, name: name.slice(0, 40) } })),
    setIncome: (v: string) => set({ income: v.replace(/[^0-9]/g, '').slice(0, 7) }),
    togglePrio: (id: PrioId) => set(st => ({ prios: { ...st.prios, [id]: !st.prios[id] } })),
    nextOnb: () => {
      const st = ref.current;
      if (st.step === 1) {
        if (!st.profile.name.trim()) { flash('Escribe tu nombre', 'ph ph-warning'); return; }
        if (inc() < 500) { flash('Escribe tu sueldo neto mensual', 'ph ph-warning'); return; }
      }
      if (st.step === 2) {
        set({ step: 3, analyzing: true, budgets: planFor(st, inc()) });
        setTimeout(() => set({ analyzing: false }), 1200);
        return;
      }
      set({ step: st.step + 1 });
    },
    backOnb: () => set(st => ({ step: Math.max(0, st.step - 1) })),
    finishOnb: () => {
      const st = ref.current;
      set({ phase: 'app', tab: 'home', messages: st.messages.length ? st.messages : [welcome(st.profile.name, st.budgets)] });
      flash(st.conn ? 'Plan activo · se guarda en tu Drive' : 'Plan activo · conecta tu Drive en Ajustes cuando quieras');
    },
    /** Rehace el plan con el sueldo actual (pierde los ajustes manuales de carpetas). */
    rebuildPlan: (incomeInput?: string) => {
      const st = ref.current, income = parseIncome(incomeInput ?? st.income);
      set({ income: String(income), budgets: planFor(st, income) });
      flash(`Plan rehecho con ${fmt0(income)}`);
    },
    // ─── Navegación ───
    goTab: (tab: Tab) => set({ tab, folderId: null }),
    openFolder: (id: FolderId) => set({ tab: 'folders', folderId: id, adjustNote: '' }),
    closeFolder: () => set({ folderId: null }),
    openSheet: (sheet: Exclude<Sheet, null>) => set(sheet === 'add' ? { sheet, addAmt: '', addName: '', addPay: 'cash' } : { sheet }),
    closeSheet: () => set({ sheet: null }),
    openRecat: (id: string) => set({ sheet: 'recat', rcId: id }),
    openCard: (id: string | null) => set({ sheet: 'card', cardId: id }),
    openGoal: (id: GoalId) => set({ sheet: 'goal', goalId: id }),
    // ─── Carpetas ───
    /**
     * Cambia el presupuesto de una carpeta manteniendo el total.
     * Si sube, sale de `takes` (y lo que falte, de Libre); si baja, la diferencia va a `to`.
     */
    setBudget: (id: FolderId, amount: number, takes: Take[] = [], to: FolderId = 'libre'): boolean => {
      const st = ref.current;
      const spent = spentMap(st.txs);
      const nb = planChange(st.budgets, id, amount, takes, spent, minPayments(st.cards), to);
      if (!nb) { flash(amount < st.budgets[id] ? 'No puede quedar por debajo de lo ya gastado o del mínimo de tus tarjetas' : 'Falta cubrir la diferencia', 'ph ph-warning'); return false; }
      const parts = FOLDER_IDS.filter(x => x !== id && nb[x] !== st.budgets[x]).map(x => `${nb[x] < st.budgets[x] ? '−' : '+'}${fmt0(Math.abs(nb[x] - st.budgets[x]))} ${FM[x].name}`);
      set({ budgets: nb, adjustNote: parts.length ? parts.join(' · ') + ' · sigue en base cero' : '' });
      flash(`${FM[id].name} ${fmt0(nb[id])}`);
      return true;
    },
    recategorize: (folder: FolderId) => {
      const st = ref.current, tx = st.txs.find(t => t.id === st.rcId);
      if (!tx) return;
      set(x => ({ txs: x.txs.map(t => (t.id === tx.id ? { ...t, f: folder, why: `Lo moviste a ${FM[folder].name}. Aprendido para la próxima.` } : t)), sheet: null }));
      flash(`${tx.name} → ${FM[folder].name}. Lo recordaré.`);
    },
    removeTx: (id: string) => set(x => ({ txs: x.txs.filter(t => t.id !== id) })),
    /** Corrige el monto (o completa uno que llegó sin monto por el Atajo). */
    setTxAmount: (id: string, raw: string) => {
      const amt = parseAmount(raw);
      if (!(amt > 0)) { flash('Escribe un monto válido', 'ph ph-warning'); return; }
      set(x => ({ txs: x.txs.map(t => (t.id === id ? { ...t, amt, pending: undefined, why: t.why.replace(' sin monto: escríbelo abajo.', '.') } : t)) }));
      flash(`Monto guardado: ${fmt(amt)}`);
    },
    deleteTx: (id: string) => { set(x => ({ txs: x.txs.filter(t => t.id !== id), sheet: null })); flash('Movimiento eliminado'); },
    // ─── Registrar gasto ───
    setAddAmt: (v: string) => set({ addAmt: v.replace(/[^0-9.,]/g, '').slice(0, 10) }),
    setAddName: (v: string) => set({ addName: v.slice(0, 80) }),
    setAddPay: (p: PayRef) => set({ addPay: p }),
    saveAdd: () => {
      const st = ref.current, amt = parseAmount(st.addAmt), name = st.addName.trim();
      if (!amt || !name) { flash('Falta el monto o el lugar', 'ph ph-warning'); return; }
      const f = learnedFolder(name, st.txs) || guessFolder(name).id || 'libre';
      const t: Tx = { id: 'm' + Date.now().toString(36), name, amt, f, pay: st.addPay, date: new Date().toISOString(), why: 'Registrado a mano. Puedes cambiar la carpeta.', source: 'manual' };
      set(x => ({ txs: [t, ...x.txs].sort(byDateDesc), sheet: null }));
      flash(`${fmt(amt)} → ${FM[f].name}`);
    },
    // ─── Tarjetas ───
    saveCard: (c: Card) => {
      set(x => ({ cards: x.cards.some(y => y.id === c.id) ? x.cards.map(y => (y.id === c.id ? c : y)) : [...x.cards, c], sheet: null }));
      flash(`${c.name} guardada`);
    },
    deleteCard: (id: string) => { set(x => ({ cards: x.cards.filter(c => c.id !== id), sheet: null })); flash('Tarjeta eliminada'); },
    // ─── Metas ───
    saveGoal: (g: Goal) => { set(x => ({ goals: x.goals.map(y => (y.id === g.id ? g : y)), sheet: null })); flash(`${g.name} actualizada`); },
    // ─── Deudas ───
    setStrat: (strat: Strategy) => set({ strat }),
    // ─── Asesor ───
    setDraft: (draft: string) => set({ draft }),
    applyPlan: (id: string) => {
      const st = ref.current, m = st.messages.find(x => x.kind === 'plan' && x.id === id);
      if (!m || m.kind !== 'plan' || m.applied) return;
      const moves = sanitizeMoves(m.moves, st.budgets);
      set(x => ({ budgets: applyMoves(x.budgets, moves), messages: x.messages.map(y => (y.kind === 'plan' && y.id === id ? { ...y, applied: true } : y)) }));
      flash('Plan actualizado · sigue en base cero');
    },
    ask: async (raw: string) => {
      const text = (raw || '').trim(), st = ref.current;
      if (!text || st.thinking) return;
      const messages: ChatMsg[] = [...st.messages, { kind: 'text', role: 'user', text }];
      if (!st.conn) {
        set({ messages: [...messages, { kind: 'text', role: 'assistant', text: 'Para responderte necesito que conectes tu Apps Script (Ajustes → Drive y asesor). Ahí vive tu clave de Gemini.' }], draft: '', tab: 'advisor', folderId: null, sheet: null });
        return;
      }
      set({ messages, draft: '', thinking: true, tab: 'advisor', folderId: null, sheet: null });
      const turns: ChatTurn[] = messages.flatMap(m => (m.kind === 'text' ? [{ role: m.role, text: m.text }] : []));
      try {
        const req = buildGeminiRequest({ name: st.profile.name, budgets: st.budgets, txs: st.txs, cards: st.cards, goals: st.goals }, turns);
        const out = await call<GeminiResponse & { ok: true }>(st.conn, 'ask', req as unknown as Record<string, unknown>, 60000);
        const plans: ChatMsg[] = (out.calls || []).flatMap((c, i) => {
          const moves = sanitizeMoves(c.movimientos, ref.current.budgets);
          return moves.length ? [{ kind: 'plan' as const, id: `p${Date.now()}-${i}`, resumen: String(c.resumen || ''), moves, applied: false }] : [];
        });
        const reply = (out.text || '').replace(/\*\*/g, '').trim() || (plans.length ? 'Listo, revisa la propuesta.' : 'No tengo una respuesta para eso.');
        set(x => ({ messages: [...x.messages, ...plans, { kind: 'text', role: 'assistant', text: reply }], thinking: false }));
      } catch (e) {
        const msg = e instanceof BackendError && (e.kind === 'network' || e.kind === 'timeout') ? 'No tengo conexión en este momento. Intenta de nuevo cuando tengas señal.'
          : e instanceof BackendError ? e.message : 'No pude responder. Intenta de nuevo.';
        set(x => ({ messages: [...x.messages, { kind: 'text', role: 'assistant', text: msg }], thinking: false }));
      }
    },
    // ─── Datos ───
    wipeLocal: () => {
      try { localStorage.removeItem(STORAGE_KEY); localStorage.removeItem(META_KEY); } catch { /* */ }
      saveConnection(null);
      setS(initialState(true));
    },
  };

  return { s, ...actions };
}

/** Filas para la hoja "Movimientos" en Drive. */
function sheetRows(p: Persisted): (string | number)[][] {
  const cardName = (pay: string) => pay === 'cash' ? 'Efectivo' : pay === 'yape' ? 'Yape' : pay === 'applepay' ? 'Apple Pay' : p.cards.find(c => c.id === pay)?.name || 'Tarjeta';
  return p.txs.map(t => [t.date, t.name, t.amt, t.f && isFolderId(t.f) ? FM[t.f].name : 'Por revisar', cardName(t.pay), t.source === 'applepay' ? 'Apple Pay (Atajo)' : 'Manual']);
}

export type Store = ReturnType<typeof useFinanceStore>;
