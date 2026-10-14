import { FM, FOLDERS, GROUPS, type FolderId, type Tx } from '../domain/data';
import { monthCtx, whenLabel } from '../domain/dates';
import { fmt, fmt0, pct } from '../domain/format';
import { MAX_MONTHS, simulate } from '../domain/debts';
import { currentDebts, payIcon, payInfo, viaApplePay } from '../domain/cards';
import { HOT_MARGIN, folderView, planIncome, txsOfMonth, type FolderView } from '../domain/plan';
import { monthAt } from '../domain/dates';
import { parseIncome, type State } from './store';

/** Carpetas de gasto variable que alimentan "Puedes gastar hoy". */
export const FLEX_IDS: FolderId[] = ['mercado', 'transporte', 'restaurantes', 'ocio', 'libre'];

export interface TxView {
  id: string; name: string; amtL: string; sub: string; srcIcon: string; icon: string; folderName: string; tagColor: string;
}

export const endL = (m: number) => (m >= MAX_MONTHS ? 'Más de 20 años' : monthAt(m));

export interface GroupRow { id: string; label: string; color: string; amt: number; amtL: string; pctL: string; w: string; names: string; items: FolderView[] }

export function derive(s: State, now = new Date()) {
  const m = monthCtx(now);
  const income = s.phase === 'onb' ? parseIncome(s.income) : planIncome(s.budgets);
  const monthTxs = txsOfMonth(s.txs, m.key);
  const debts = currentDebts(s.cards, s.txs, now);
  const vctx = { monthPct: m.pct, firstDue: debts.slice().sort((a, b) => b.tcea - a.tcea)[0]?.due ?? null };
  const views = FOLDERS.map(f => folderView(f, s.budgets, monthTxs, vctx));
  const VM = Object.fromEntries(views.map(v => [v.id, v])) as Record<FolderId, FolderView>;
  const flex = views.filter(v => FLEX_IDS.includes(v.id));
  const flexLeft = flex.reduce((a, v) => a + Math.max(0, v.left), 0);
  const spent = views.filter(v => v.flow).reduce((a, v) => a + v.spent, 0);
  const saved = views.filter(v => !v.flow).reduce((a, v) => a + v.budget, 0);
  const hot = views.filter(v => v.flow && v.id !== 'vivienda' && v.spent > 0 && v.r > m.pct + HOT_MARGIN).sort((a, b) => b.r - a.r)[0];

  const groupRows: GroupRow[] = GROUPS.map(g => {
    const items = views.filter(v => v.grp === g.id), amt = items.reduce((a, v) => a + v.budget, 0);
    return {
      id: g.id, label: g.label, color: g.color, amt, amtL: fmt0(amt),
      pctL: income ? Math.round((amt / income) * 100) + '%' : '0%', w: pct(amt, income),
      names: items.filter(v => v.budget > 0).map(v => v.name + ' ' + fmt0(v.budget)).join(' · '),
      items: items.filter(v => v.budget > 0 || v.grp === 'aho'),
    };
  });

  const debtTotal = debts.reduce((a, d) => a + d.bal, 0);
  const sims = {
    avalanche: simulate(debts, s.budgets.deudas, 'avalanche'),
    snowball: simulate(debts, s.budgets.deudas, 'snowball'),
    min: simulate(debts, s.budgets.deudas, 'min'),
  };
  const creditTxs = monthTxs.filter(t => payInfo(t.pay, s.cards).credit);
  const creditMonth = creditTxs.reduce((a, t) => a + t.amt, 0);
  const folderCount = FOLDERS.filter(f => s.budgets[f.id] > 0).length;
  const lastApplePay = s.txs.find(t => t.source === 'applepay');

  const txView = (t: Tx): TxView => {
    const f = t.f ? FM[t.f] : null, p = payInfo(t.pay, s.cards);
    return {
      id: t.id, name: t.name, amtL: '−' + fmt(t.amt),
      sub: (viaApplePay(t) ? 'Apple Pay · ' : '') + (p.card || !viaApplePay(t) ? p.short + ' · ' : '') + whenLabel(t.date, now),
      srcIcon: payIcon(t), icon: f ? 'ph ph-' + f.icon : 'ph ph-question',
      folderName: f ? f.name : 'Por revisar', tagColor: f ? 'var(--color-neutral-500)' : 'var(--color-accent-300)',
    };
  };

  return {
    m, income, monthTxs, views, VM, flex, flexLeft, spent, saved, hot, groupRows, debts, debtTotal, sims,
    creditTxs, creditMonth, folderCount, lastApplePay, txView,
    debtFreeL: debts.length ? 'Libre en ' + endL(sims.avalanche.months) : 'Sin deudas',
  };
}

export type Derived = ReturnType<typeof derive>;
