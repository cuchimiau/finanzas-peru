import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DEFAULT_FOLDERS, DEFAULT_GOALS, DEFAULT_PRIOS, FM, FOLDER_IDS, folderName, setFolders,
  LOCKED_FOLDERS, type Budgets, type Card, type Folder, type FolderId, type Goal, type GoalId, type Income, type PayRef, type PrioId, type Tx,
} from '../domain/data';
import { fmt, fmt0, parseAmount } from '../domain/format';
import type { Strategy } from '../domain/debts';
import { hasDebt, minPayments } from '../domain/cards';
import { applyMoves, buildBudgets, guessFolder, learnedFolder, planChange, planIncome, sanitizeMoves, txsOfMonth, type Take } from '../domain/plan';
import { monthKey, monthKeyOf } from '../domain/dates';
import { buildGeminiRequest, type ChatTurn, type GeminiResponse } from '../domain/advisor';
import {
  BackendError, call, loadConnection, saveConnection,
  type Connection, type LoadResponse, type PingResponse, type SaveResponse,
} from '../sync/backend';
import { byDateDesc, inboxToTxs, mergeRemote } from '../sync/merge';

const SOURCE_LABEL: Record<Tx['source'], string> = { manual: 'A mano', applepay: 'Apple Pay', siri: 'Siri', yape: 'Yape' };
const SHEET_SOURCE: Record<Tx['source'], string> = { manual: 'Manual', applepay: 'Apple Pay (Atajo)', siri: 'Siri (Atajo)', yape: 'Yape (constancia)' };
import { PERSISTED_KEYS, isPersisted, migrate, pickPersisted, type ChatMsg, type Persisted } from './persisted';

export type { ChatMsg } from './persisted';
export type Tab = 'home' | 'folders' | 'debts' | 'metrics' | 'advisor';
export type Sheet = 'recat' | 'connect' | 'add' | 'card' | 'goal' | 'settings' | 'folder' | 'plan' | 'optimize' | 'close' | null;
export type SyncStatus = 'off' | 'idle' | 'syncing' | 'offline' | 'error';

export interface SyncMeta { rev: number | null; dirty: boolean; lastSync: number | null }

export interface State extends Persisted {
  step: number; analyzing: boolean;
  tab: Tab; folderId: FolderId | null; sheet: Sheet; rcId: string | null; cardId: string | null; goalId: GoalId | null;
  addAmt: string; addName: string; addPay: PayRef;
  /** Registrar: gasto o ingreso, fecha ('' = hoy, 'YYYY-MM-DD') y carpeta elegida a mano. */
  addKind: 'gasto' | 'ingreso'; addDate: string; addF: FolderId | null; editFolderId: FolderId | null;
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
    strat: 'avalanche', messages: [], folders: DEFAULT_FOLDERS.map(f => ({ ...f })), template: {}, incomes: [], monthKey: monthKey(new Date()),
  };
}

function readLocal(): { data: Persisted; meta: SyncMeta } {
  const meta: SyncMeta = { rev: null, dirty: false, lastSync: null };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const m = localStorage.getItem(META_KEY);
    const data = raw ? JSON.parse(raw) : null;
    return { data: isPersisted(data) ? migrate(data) : migrate(freshPersisted()), meta: m ? { ...meta, ...JSON.parse(m) } : meta };
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
    addAmt: '', addName: '', addPay: 'cash', addKind: 'gasto', addDate: '', addF: null, editFolderId: null, toast: '', toastIcon: 'ph-fill ph-check-circle', adjustNote: '', draft: '', thinking: false,
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

/** '' → ahora; 'YYYY-MM-DD' → ese día al mediodía (hora local). */
export function dateFromInput(v: string): string {
  if (!v) return new Date().toISOString();
  const [y, m, d] = v.split('-').map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1, 12, 0);
  return Number.isNaN(dt.getTime()) || dt.getTime() > Date.now() ? new Date().toISOString() : dt.toISOString();
}

export const parseIncome = (s: string) => Math.max(0, parseFloat(String(s).replace(/[^0-9.]/g, '')) || 0);

export interface StoreOptions { reset: boolean }

export function useFinanceStore(opts: StoreOptions) {
  const [s, setS] = useState<State>(() => initialState(opts.reset));
  const ref = useRef(s);
  ref.current = s;
  // Las carpetas de la persona alimentan el registro que leen todos los módulos.
  setFolders(s.folders);
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
        const merged = mergeRemote(migrate(res.state), pickPersisted(ref.current));
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
        const remote = migrate(res.state);
        if (cur.phase === 'onb' && remote.phase === 'app') { next = remote; restored = true; dirty = false; }
        else if (dirty) next = mergeRemote(remote, next);
        else next = remote;
      } else if (!isPersisted(res.state)) dirty = true; // Drive vacío: subir lo local
      const fresh = inboxToTxs(res.inbox || [], next.cards, next.txs);
      if (fresh.length) { next = { ...next, txs: [...fresh, ...next.txs].sort(byDateDesc) }; dirty = true; }
      pendingAck.current = Array.from(new Set([...pendingAck.current, ...(res.inbox || []).map(i => i.id)]));
      setS(x => ({ ...x, ...next, sync: 'idle', syncError: '', meta: { rev: res.rev, dirty, lastSync: Date.now() } }));
      if (restored) flash('Recuperé tus datos desde Drive', 'ph ph-cloud-check');
      else if (fresh.length) {
        const t = fresh[0], via = SOURCE_LABEL[t.source];
        flash(fresh.length > 1 ? `${fresh.length} gastos nuevos (${[...new Set(fresh.map(x => SOURCE_LABEL[x.source]))].join(', ')})${fresh.some(x => x.dup) ? ' · revisa duplicados' : ''}` : t.dup ? `${via} · ${t.name}: ¿duplicado de ${t.dup}?` : t.pending ? `${via} · ${t.name}: falta el monto` : `${via} · ${t.name} ${fmt(t.amt)} → ${folderName(t.f)}`, t.source === 'siri' ? 'ph ph-microphone' : t.source === 'yape' ? 'ph ph-device-mobile' : 'ph ph-apple-logo');
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

  // Cambio de mes: muestra el cierre del mes anterior para empezar con un plan optimizado.
  useEffect(() => {
    if (s.phase === 'app' && s.monthKey !== monthKey(new Date()) && !s.sheet) set({ sheet: 'close' });
  }, [s.phase, s.monthKey, s.sheet, set]);

  const inc = () => parseIncome(ref.current.income);
  const planFor = (st: State, income: number) =>
    buildBudgets(income, { ...st.prios, deuda: hasDebt(st.cards) }, minPayments(st.cards));

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
        { const b = planFor(st, inc()); set({ step: 3, analyzing: true, budgets: b, template: { ...b } }); }
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
      { const b = planFor(st, income); set({ income: String(income), budgets: b, template: { ...b } }); }
      flash(`Plan rehecho con ${fmt0(income)}`);
    },
    // ─── Navegación ───
    goTab: (tab: Tab) => set({ tab, folderId: null }),
    openFolder: (id: FolderId) => set({ tab: 'folders', folderId: id, adjustNote: '' }),
    closeFolder: () => set({ folderId: null }),
    openSheet: (sheet: Exclude<Sheet, null>) => set(sheet === 'add' ? { sheet, addAmt: '', addName: '', addPay: 'cash', addKind: 'gasto', addDate: '', addF: null } : { sheet }),
    openFolderEdit: (id: FolderId | null) => set({ sheet: 'folder', editFolderId: id }),
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
    /** "No es duplicado": quita el aviso y lo deja como está. */
    keepTx: (id: string) => set(x => ({ txs: x.txs.map(t => (t.id === id ? { ...t, dup: undefined } : t)) })),
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
    setAdd: (p: Partial<Pick<State, 'addKind' | 'addDate' | 'addF'>>) => set(p),
    saveAdd: () => {
      const st = ref.current, amt = parseAmount(st.addAmt), name = st.addName.trim();
      const date = dateFromInput(st.addDate);
      if (st.addKind === 'ingreso') {
        if (!amt) { flash('Escribe el monto del ingreso', 'ph ph-warning'); return; }
        const f = st.addF && FM[st.addF] ? st.addF : 'libre';
        const inc: Income = { id: 'i' + Date.now().toString(36), name: name || 'Ingreso extra', amt, date, f };
        const thisMonth = monthKeyOf(date) === st.monthKey;
        set(x => ({ incomes: [inc, ...x.incomes], budgets: thisMonth ? { ...x.budgets, [f]: (x.budgets[f] || 0) + amt } : x.budgets, sheet: null }));
        flash(thisMonth ? `+${fmt(amt)} a ${folderName(f)} este mes` : `Ingreso de ${fmt(amt)} registrado`, 'ph ph-arrow-circle-down');
        return;
      }
      if (!amt || !name) { flash('Falta el monto o el lugar', 'ph ph-warning'); return; }
      const f = (st.addF && FM[st.addF] ? st.addF : null) || learnedFolder(name, st.txs) || guessFolder(name).id || 'libre';
      const t: Tx = { id: 'm' + Date.now().toString(36), name, amt, f, pay: st.addPay, date, why: 'Registrado a mano. Puedes cambiar la carpeta.', source: 'manual' };
      set(x => ({ txs: [t, ...x.txs].sort(byDateDesc), sheet: null }));
      flash(`${fmt(amt)} → ${folderName(f)}`);
    },
    deleteIncome: (id: string) => {
      const st = ref.current, inc = st.incomes.find(i => i.id === id);
      if (!inc) return;
      const thisMonth = monthKeyOf(inc.date) === st.monthKey;
      set(x => ({ incomes: x.incomes.filter(i => i.id !== id), budgets: thisMonth && x.budgets[inc.f] != null ? { ...x.budgets, [inc.f]: Math.max(0, x.budgets[inc.f] - inc.amt) } : x.budgets }));
      flash('Ingreso eliminado');
    },
    // ─── Carpetas propias ───
    saveFolder: (f: Folder) => {
      const st = ref.current, exists = st.folders.some(x => x.id === f.id);
      set(x => ({
        folders: exists ? x.folders.map(y => (y.id === f.id ? f : y)) : [...x.folders, f],
        budgets: exists ? x.budgets : { ...x.budgets, [f.id]: 0 },
        template: exists ? x.template : { ...x.template, [f.id]: 0 },
        sheet: null,
      }));
      flash(exists ? `${f.name} actualizada` : `Carpeta ${f.name} creada · asígnale un monto`);
      if (!exists) set({ tab: 'folders', folderId: f.id, adjustNote: '' });
    },
    deleteFolder: (id: FolderId) => {
      if (LOCKED_FOLDERS.includes(id)) { flash('Esta carpeta es necesaria: puedes renombrarla, no borrarla', 'ph ph-warning'); return; }
      const name = folderName(id);
      const drop = (b: Budgets) => { const nb: Budgets = { ...b, libre: (b.libre || 0) + (b[id] || 0) }; delete nb[id]; return nb; };
      set(x => ({
        folders: x.folders.filter(f => f.id !== id),
        budgets: drop(x.budgets), template: drop(x.template),
        txs: x.txs.map(t => (t.f === id ? { ...t, f: null, why: `La carpeta ${name} se borró: elige otra.` } : t)),
        goals: x.goals.filter(g => g.id !== id),
        sheet: null, folderId: null,
      }));
      flash(`${name} borrada · su dinero pasó a Libre`);
    },
    /** Optimizar: mueve lo que sobra de tus deseos a la deuda más cara / emergencia. */
    applyRest: (moves: Take[], to: FolderId) => {
      const st = ref.current;
      const b = applyMoves(st.budgets, moves.filter(m => m.de !== to).map(m => ({ de: m.de, a: to, monto: m.monto })));
      const total = moves.reduce((a, m) => a + m.monto, 0);
      set({ budgets: b, sheet: null });
      flash(`+${fmt0(total)} a ${folderName(to)} · sigue en base cero`, 'ph ph-magic-wand');
    },
    setTemplate: (b: Budgets) => { set({ template: { ...b } }); flash('Listo: será tu plan base desde el próximo mes'); },
    /** Empieza el mes nuevo con el plan propuesto o con tu plan base. */
    startMonth: (b: Budgets) => {
      set({ budgets: { ...b }, template: { ...b }, monthKey: monthKey(new Date()), sheet: null });
      flash('¡Mes nuevo, plan nuevo! Ya puedes registrar tus gastos.', 'ph ph-calendar-check');
    },
    /** Guarda el plan completo del mes (y opcionalmente como plan base para los próximos meses). */
    savePlan: (b: Budgets, asTemplate: boolean) => {
      set(x => ({ budgets: { ...b }, template: asTemplate ? { ...b } : x.template, sheet: null }));
      flash(asTemplate ? 'Plan guardado para este mes y los siguientes' : 'Plan de este mes guardado');
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
        const req = buildGeminiRequest({ name: st.profile.name, budgets: st.budgets, txs: st.txs, cards: st.cards, goals: st.goals, incomes: st.incomes, salary: parseIncome(st.income) }, turns);
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
  return p.txs.map(t => [t.date, t.name, t.amt, folderName(t.f), cardName(t.pay), SHEET_SOURCE[t.source]]);
}

export type Store = ReturnType<typeof useFinanceStore>;
