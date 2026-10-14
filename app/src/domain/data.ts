// Catálogos y tipos del modelo. Los datos de la persona (tarjetas, metas, movimientos) viven en el estado.

export type GroupId = 'nec' | 'des' | 'aho' | 'deu';
export type FolderId =
  | 'vivienda' | 'mercado' | 'transporte' | 'servicios' | 'salud'
  | 'restaurantes' | 'ocio' | 'suscripciones' | 'libre'
  | 'emergencia' | 'inversion' | 'viaje' | 'deudas';
export type SourceId = 'applepay' | 'correo' | 'yape' | 'eecc' | 'open';
export type PrioId = 'emergencia' | 'invertir' | 'viaje';
export type GoalId = 'emergencia' | 'inversion' | 'viaje';

export type Budgets = Record<FolderId, number>;

export interface Folder { id: FolderId; name: string; icon: string; grp: GroupId; base: number }
export interface Group { id: GroupId; label: string; color: string }

export interface Profile { name: string }

export type CardKind = 'debit' | 'credit';
export interface Card {
  id: string;
  name: string;
  kind: CardKind;
  applePay: boolean;
  /** Solo crédito: */
  limit: number;
  /** Deuda total a la fecha `balDate` (incluye cuotas pendientes). */
  bal: number;
  balDate: string;
  /** TCEA como fracción (0.92 = 92%). */
  tcea: number;
  min: number;
  dueDay: number;
  cuotas: string;
}

/** Medio de pago: efectivo, Yape, Apple Pay sin tarjeta identificada, o el id de una tarjeta. */
export type PayRef = 'cash' | 'yape' | 'applepay' | string;

export interface Tx {
  id: string;
  name: string;
  amt: number;
  f: FolderId | null;
  pay: PayRef;
  /** Fecha ISO del pago. */
  date: string;
  why: string;
  source: 'manual' | 'applepay';
}

export interface Goal { id: GoalId; name: string; saved: number; target: number }

/** Deuda derivada de una tarjeta de crédito (lo que usa la simulación). */
export interface Debt { id: string; name: string; bal: number; limit: number; tcea: number; min: number; due: string; cuotas: string }

export interface Source { name: string; sub: string; icon: string; how: string; soon?: boolean }

export const FOLDERS: Folder[] = [
  { id: 'vivienda', name: 'Alquiler', icon: 'house', grp: 'nec', base: 650 },
  { id: 'mercado', name: 'Mercado y súper', icon: 'shopping-cart', grp: 'nec', base: 480 },
  { id: 'transporte', name: 'Transporte', icon: 'bus', grp: 'nec', base: 170 },
  { id: 'servicios', name: 'Luz, agua, celular', icon: 'lightning', grp: 'nec', base: 150 },
  { id: 'salud', name: 'Salud', icon: 'first-aid', grp: 'nec', base: 80 },
  { id: 'restaurantes', name: 'Comer fuera', icon: 'fork-knife', grp: 'des', base: 160 },
  { id: 'ocio', name: 'Salidas y ocio', icon: 'ticket', grp: 'des', base: 80 },
  { id: 'suscripciones', name: 'Suscripciones', icon: 'television-simple', grp: 'des', base: 45 },
  { id: 'libre', name: 'Libre', icon: 'sparkle', grp: 'des', base: 65 },
  { id: 'emergencia', name: 'Fondo de emergencia', icon: 'lifebuoy', grp: 'aho', base: 150 },
  { id: 'inversion', name: 'Fondo mutuo', icon: 'trend-up', grp: 'aho', base: 50 },
  { id: 'viaje', name: 'Viaje', icon: 'mountains', grp: 'aho', base: 0 },
  { id: 'deudas', name: 'Pago de tarjetas', icon: 'credit-card', grp: 'deu', base: 520 },
];
export const FOLDER_IDS = FOLDERS.map(f => f.id);
export const FM = Object.fromEntries(FOLDERS.map(f => [f.id, f])) as Record<FolderId, Folder>;
export const isFolderId = (x: unknown): x is FolderId => typeof x === 'string' && Object.prototype.hasOwnProperty.call(FM, x);

export const GROUPS: Group[] = [
  { id: 'nec', label: 'Necesidades', color: 'var(--color-neutral-300)' },
  { id: 'des', label: 'Deseos', color: 'var(--color-neutral-600)' },
  { id: 'aho', label: 'Ahorro y metas', color: 'var(--color-accent)' },
  { id: 'deu', label: 'Deudas', color: 'var(--color-accent-700)' },
];
export const GM = Object.fromEntries(GROUPS.map(g => [g.id, g])) as Record<GroupId, Group>;

/** Palabras clave → carpeta, para categorizar lo que llega de Apple Pay o se registra a mano. */
export const KEYWORDS: [RegExp, FolderId][] = [
  [/uber|cabify|indrive|didi|metropolitano|grifo|primax|repsol|pecsa|corredor|peaje|estacionamiento/i, 'transporte'],
  [/plaza vea|wong|tottus|metro|vivanda|makro|mass\b|mercado|bodega|tambo|oxxo|mini market|minimarket/i, 'mercado'],
  [/bembos|kfc|starbucks|pardos|norky|chifa|cevich|pollo|rappi|pedidosya|café|cafe|pizza|restaurante|mcdonald|burger|popeyes|tanta|juan valdez/i, 'restaurantes'],
  [/netflix|spotify|disney|\bmax\b|hbo|youtube|icloud|apple\.com|prime video|amazon prime|crunchyroll|chatgpt|google one/i, 'suscripciones'],
  [/inkafarma|mifarma|clínica|clinica|doctor|farmacia|dental|boticas|laboratorio|oftalm/i, 'salud'],
  [/cineplanet|cinemark|teleticket|joinnus|\bbar\b|discoteca|concierto|steam|playstation/i, 'ocio'],
  [/luz del sur|enel|sedapal|claro|movistar|entel|bitel|calidda|win internet/i, 'servicios'],
];

export const PRIOS: { id: PrioId; label: string; icon: string }[] = [
  { id: 'emergencia', label: 'Fondo de emergencia', icon: 'ph ph-lifebuoy' },
  { id: 'invertir', label: 'Empezar a invertir', icon: 'ph ph-trend-up' },
  { id: 'viaje', label: 'Viajar', icon: 'ph ph-airplane-tilt' },
];
export type Prios = Record<PrioId, boolean>;
export const DEFAULT_PRIOS: Prios = { emergencia: true, invertir: true, viaje: false };

export const SUGGESTIONS = [
  'Optimiza mi plan este mes',
  '¿Qué tarjeta pago primero?',
  '¿Qué hago con mi gratificación?',
  '¿Cuánto debo tener de emergencia?',
];

export const SOURCES: Record<SourceId, Source> = {
  applepay: { name: 'Pagos con Apple Pay', sub: 'Atajo de iPhone · Wallet', icon: 'ph ph-apple-logo', how: 'Una automatización de Atajos envía monto, comercio y tarjeta cada vez que pagas con el iPhone. Llegan a la app al abrirla.' },
  correo: { name: 'Alertas de consumo por correo', sub: 'Tarjeta física o compras en línea', icon: 'ph ph-envelope-simple', how: 'Leer los correos de "consumo realizado" de tu banco.', soon: true },
  yape: { name: 'Constancias de Yape y Plin', sub: 'Por ahora: regístralos con + · Yape', icon: 'ph ph-device-mobile', how: 'Compartir la constancia desde Yape o Plin para registrarla sola.', soon: true },
  eecc: { name: 'Estado de cuenta mensual', sub: 'PDF de tu tarjeta', icon: 'ph ph-file-text', how: 'Subir el PDF al cierre para cuadrar cuotas, intereses y comisiones.', soon: true },
  open: { name: 'Conexión directa al banco', sub: 'Finanzas Abiertas · SBS', icon: 'ph ph-bank', how: 'La SBS está definiendo el reglamento de Finanzas Abiertas. Cuando esté vigente, podrás conectar tu banco directo.', soon: true },
};
export const SOURCE_IDS = Object.keys(SOURCES) as SourceId[];

export const DEFAULT_GOALS: Goal[] = [
  { id: 'emergencia', name: 'Fondo de emergencia', saved: 0, target: 0 },
  { id: 'inversion', name: 'Fondo mutuo', saved: 0, target: 3000 },
  { id: 'viaje', name: 'Viaje', saved: 0, target: 1800 },
];

/** Estructura del gasto del hogar peruano promedio (INEI 2024), en % del gasto. */
export const INEI_BENCH: { label: string; folders: FolderId[]; ref: number }[] = [
  { label: 'Comida en casa', folders: ['mercado'], ref: 28.9 },
  { label: 'Vivienda y servicios', folders: ['vivienda', 'servicios'], ref: 21.3 },
  { label: 'Comer fuera', folders: ['restaurantes'], ref: 12.3 },
  { label: 'Salud', folders: ['salud'], ref: 8.3 },
  { label: 'Transporte', folders: ['transporte'], ref: 7.7 },
];

export const BASE_INCOME = 2600;
