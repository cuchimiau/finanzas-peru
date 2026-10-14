// Asesor con Gemini. La app arma el prompt y el historial; el Apps Script solo agrega la clave y llama a la API.

import { FOLDERS, FOLDER_IDS, GM, type Budgets, type Card, type Goal, type Income, type Tx } from './data';
import { monthCtx } from './dates';
import { simulate } from './debts';
import { currentDebts } from './cards';
import { folderView, goalViews, planIncome, txsOfMonth } from './plan';

export const ADVISOR_TOOL_NAME = 'proponer_ajuste';

export interface ChatTurn { role: 'user' | 'assistant'; text: string }

export interface AdvisorContext { name: string; budgets: Budgets; txs: Tx[]; cards: Card[]; goals: Goal[]; incomes?: Income[]; salary?: number; now?: Date }

/** Pedido que viaja al Apps Script (acción "ask"). */
export interface GeminiRequest {
  system: string;
  contents: { role: 'user' | 'model'; parts: { text: string }[] }[];
  tools: { functionDeclarations: unknown[] }[];
}
/** Respuesta del Apps Script: texto final + argumentos de cada llamada a proponer_ajuste. */
export interface GeminiResponse { text: string; calls: { resumen?: string; movimientos?: unknown }[] }

/** Declaración de la función en el formato de Gemini (esquema OpenAPI), con tus carpetas actuales. */
export const advisorTool = () => ({
  name: ADVISOR_TOOL_NAME,
  description: 'Muestra a la usuaria una propuesta para mover soles entre carpetas de este mes, con botón Aplicar. El total no cambia.',
  parameters: {
    type: 'OBJECT',
    properties: {
      resumen: { type: 'STRING', description: 'Una frase: qué logra el ajuste' },
      movimientos: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            de: { type: 'STRING', format: 'enum', enum: FOLDER_IDS, description: 'Carpeta de donde sale el dinero' },
            a: { type: 'STRING', format: 'enum', enum: FOLDER_IDS, description: 'Carpeta que lo recibe' },
            monto: { type: 'NUMBER', description: 'Soles enteros' },
          },
          required: ['de', 'a', 'monto'],
        },
      },
    },
    required: ['resumen', 'movimientos'],
  },
});

export function buildSystemPrompt(ctx: AdvisorContext): string {
  const now = ctx.now ?? new Date();
  const m = monthCtx(now);
  const b = ctx.budgets, inc = planIncome(b);
  const monthTxs = txsOfMonth(ctx.txs, m.key);
  const debts = currentDebts(ctx.cards, ctx.txs, now);
  const vctx = { monthPct: m.pct, firstDue: debts[0]?.due ?? null };
  const folders = FOLDERS.map(f => {
    const v = folderView(f, b, monthTxs, vctx);
    return `${f.id} (${f.name}, ${GM[f.grp].label}): presupuesto S/ ${b[f.id]}` + (v.flow ? `, gastado S/ ${v.spent.toFixed(2)}` : '');
  }).join('\n');
  const goalsL = goalViews(b, ctx.goals, now).map(g => `${g.name}: S/ ${g.saved} de S/ ${Math.round(g.target)}, aporte S/ ${g.monthly}/mes`).join('\n');
  const debtsL = debts.length
    ? debts.map(d => `${d.name}: saldo S/ ${d.bal.toFixed(0)}, TCEA ${Math.round(d.tcea * 100)}%, mínimo S/ ${d.min}, vence ${d.due}` + (d.cuotas ? ` (${d.cuotas})` : '')).join('\n')
    : 'Sin deudas registradas.';
  const sim = debts.length ? simulate(debts, b.deudas, 'avalanche') : null;
  const uncategorized = monthTxs.filter(t => !t.f).map(t => `${t.name} S/ ${t.amt}`).join(', ') || 'ninguno';
  const firstName = ctx.name.trim().split(/\s+/)[0] || 'la usuaria';
  return `Eres el asesor financiero personal dentro de una app peruana de presupuesto por carpetas. Usuaria o usuario: ${firstName}, vive en Perú, sueldo neto S/ ${inc}/mes (ya descontada AFP u ONP). Hoy es ${m.longL} (${m.pctL} del mes, quedan ${m.daysLeft} días contando hoy). Moneda: soles (S/).
Responde SIEMPRE en español peruano neutro, cálido y directo, máximo 80 palabras, texto plano sin markdown ni viñetas. Usa los números reales de abajo; si falta un dato, dilo en vez de inventarlo.
Principios: presupuesto base cero (cada sol tiene carpeta; mover dinero entre carpetas mantiene el total). Deudas: método avalancha, primero la de mayor TCEA; pagar siempre más que el mínimo; las compras con tarjeta de crédito deben pagarse completas al cierre. Fondo de emergencia: 3 a 6 meses de gastos esenciales. Contexto Perú: gratificación en julio y diciembre (un sueldo + 9% de bonificación, inafecta a AFP), CTS depositada en mayo y noviembre (respaldo ante desempleo). Nunca sugieras recortar el fondo de emergencia ni el pago de deudas para cubrir deseos. No recomiendes productos financieros específicos.
Si propones mover dinero entre carpetas de este mes, llama a la función ${ADVISOR_TOOL_NAME} (se mostrará un botón Aplicar) y luego explica en 1–2 frases.
Carpetas (id entre paréntesis el nombre):
${folders}
Deudas${sim ? ` (pago mensual total S/ ${b.deudas}; con avalancha queda libre en ${sim.months} meses, intereses ~S/ ${Math.round(sim.interest)})` : ''}:
${debtsL}
Metas:
${goalsL}
Movimientos sin categorizar este mes: ${uncategorized}.
Ingresos extra este mes: ${(ctx.incomes || []).filter(i => i.date.slice(0, 7) === m.key).map(i => `${i.name} S/ ${i.amt}`).join(', ') || 'ninguno'}${ctx.salary ? ` (sueldo base S/ ${ctx.salary})` : ''}.
Si te piden optimizar el fin de mes: calcula lo que sobra en deseos según el ritmo de gasto y propón moverlo a la deuda de mayor interés o al fondo de emergencia con ${ADVISOR_TOOL_NAME}; nunca recortes necesidades.`;
}

/** Historial en el formato de Gemini: une turnos seguidos del mismo rol y empieza por la persona. */
export function toGeminiContents(turns: ChatTurn[]): GeminiRequest['contents'] {
  const out: GeminiRequest['contents'] = [];
  turns.forEach(t => {
    const role = t.role === 'user' ? 'user' : 'model';
    const last = out[out.length - 1];
    if (last && last.role === role) last.parts[0].text += '\n' + t.text;
    else out.push({ role, parts: [{ text: t.text }] });
  });
  while (out.length && out[0].role !== 'user') out.shift();
  return out;
}

export function buildGeminiRequest(ctx: AdvisorContext, turns: ChatTurn[]): GeminiRequest {
  return { system: buildSystemPrompt(ctx), contents: toGeminiContents(turns.slice(-30)), tools: [{ functionDeclarations: [advisorTool()] }] };
}
