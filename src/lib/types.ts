// Tipos del dominio. Espejan 1:1 las tablas de supabase/schema.sql.

export type ProspectStage =
  | "contactado"
  | "demo_enviada"
  | "propuesta_enviada"
  | "negociacion"
  | "ganado"
  | "perdido";

export type ServiceInterest = "web" | "ads" | "ambos";
export type LeadSource = "frio" | "in_person" | "referido";
export type CurrencyCode = "UYU" | "USD";
export type ServiceKind = "web" | "retainer" | "ads";
/** `gratis` = mes de promo: no hay nada que cobrar y no es una deuda. */
export type PaymentStatus = "pagado" | "pendiente" | "vencido" | "gratis";

export type PaymentKind = "mensual" | "inicial";

/** Con qué tarjeta se paga la pauta en Meta. */
export type AdCard = "cliente" | "mia";

/**
 * Pauta con tu tarjeta: `transferencia` = el cliente te pasó plata. `gasto`
 * quedó de la primera versión y ya no se anota: lo gastado es un solo número
 * por cliente (`Client.ad_spent`). Sigue acá porque es el enum de la base.
 */
export type AdMovementKind = "transferencia" | "gasto";

export interface Prospect {
  id: string;
  business_name: string;
  contact_name: string | null;
  phone: string | null;
  service_interest: ServiceInterest;
  stage: ProspectStage;
  source: LeadSource;
  last_contact_at: string | null; // YYYY-MM-DD
  next_action: string | null;
  next_action_at: string | null; // YYYY-MM-DD
  notes: string | null;
  converted_client_id: string | null;
  /** Archivado: sale de todas las listas, pero no se borra nada. */
  archived: boolean;
}

export interface ClientService {
  id: string;
  client_id: string;
  kind: ServiceKind;
  amount: number;
  currency: CurrencyCode;
  billing_day: number; // 1..31
  active: boolean;
  /** Desde cuándo corre. Define cuál es "el primer mes". */
  starts_on: string; // YYYY-MM-DD
  /** Promo de cierre: el mes de `starts_on` no se cobra. */
  first_month_free: boolean;
  /**
   * Promo de cierre con descuento: lo que se cobra el mes de `starts_on`, en
   * vez de `amount`. null = sin descuento. Nunca junto con `first_month_free`.
   */
  first_month_amount: number | null;
  /**
   * Sólo Ads: cuánto quiere invertir el cliente por mes en Meta. Es aparte de
   * `amount` (tus honorarios) y no entra en el MRR. null = sin cargar.
   */
  ad_budget: number | null;
  ad_currency: CurrencyCode;
  /** Sólo Ads: con qué tarjeta se paga esa pauta. null = sin cargar. */
  ad_card: AdCard | null;
}

export interface Payment {
  id: string;
  client_id: string;
  service_id: string | null;
  period: string; // YYYY-MM-01, el mes que cubre
  kind: PaymentKind;
  amount: number;
  currency: CurrencyCode;
  paid_at: string; // YYYY-MM-DD
  note: string | null;
}

export interface Client {
  id: string;
  business_name: string;
  contact_name: string | null;
  phone: string | null;
  notes: string | null;
  /**
   * Pago inicial: el cobro de arranque del proyecto, uno por cliente.
   * No entra en el MRR porque no se repite. null = este cliente no tiene.
   */
  setup_amount: number | null;
  setup_currency: CurrencyCode;
  setup_due_on: string | null;
  setup_note: string | null;
  /**
   * Pauta con tu tarjeta: lo que lleva gastado la campaña en Meta, desde que
   * la pagás vos. Es UN número que se pisa con lo que dice Meta, no una suma
   * de cobros. null = sin cargar.
   */
  ad_spent: number | null;
  ad_spent_currency: CurrencyCode;
  /** Cuándo se actualizó `ad_spent` por última vez. */
  ad_spent_on: string | null;
  /** false = pausado: sigue siendo cliente, pero no cuenta para MRR ni cobros. */
  active: boolean;
  /** Archivado: sale de todas las listas, pero no se borra nada. */
  archived: boolean;
}

/**
 * Una transferencia del cliente para la pauta que pagás con tu tarjeta. No es
 * un cobro tuyo: es plata del cliente que pasa por tus manos, así que no
 * entra en `payments` ni en el MRR.
 */
export interface AdMovement {
  id: string;
  client_id: string;
  kind: AdMovementKind;
  amount: number; // siempre positivo; el signo lo da `kind`
  currency: CurrencyCode;
  moved_on: string; // YYYY-MM-DD
  note: string | null;
}

/**
 * Contactados en frío de un día, para la meta diaria de Metas. Sólo el número:
 * sin nombres, porque anotarlos lleva más que escribirle a uno nuevo.
 */
export interface ColdContactDay {
  contacted_on: string; // YYYY-MM-DD
  contacts: number;
}

/**
 * Tarea fija de la rutina semanal. `check` se tacha a mano; `frio` se tacha
 * sola cuando el contador de contactados en frío del día llega a la meta.
 */
export type HabitKind = "check" | "frio";

/**
 * Una tarea que se repite ciertos días de la semana. Cambiarle los días no
 * reescribe el pasado: la versión vieja termina (`ends_on`) y arranca otra.
 */
export interface Habit {
  id: string;
  title: string;
  kind: HabitKind;
  /** Qué días toca: 1 = lunes … 7 = domingo. */
  weekdays: number[];
  position: number;
  starts_on: string; // YYYY-MM-DD
  /** El primer día en que ya no toca. null = vigente. */
  ends_on: string | null;
}

/** Una tarea tachada en un día. */
export interface HabitCheck {
  habit_id: string;
  done_on: string; // YYYY-MM-DD
}

/** Cliente con sus servicios y pagos ya resueltos. Lo que consumen las vistas. */
export interface ClientFull extends Client {
  services: ClientService[];
  payments: Payment[];
  ad_movements: AdMovement[];
}

// ── Etiquetas en español, en un solo lugar ──────────────────────────────────

export const STAGES: ProspectStage[] = [
  "contactado",
  "demo_enviada",
  "propuesta_enviada",
  "negociacion",
  "ganado",
  "perdido",
];

export const STAGE_LABEL: Record<ProspectStage, string> = {
  contactado: "Contactado",
  demo_enviada: "Demo enviada",
  propuesta_enviada: "Propuesta enviada",
  negociacion: "Negociación",
  ganado: "Ganado",
  perdido: "Perdido",
};

export const SOURCE_LABEL: Record<LeadSource, string> = {
  frio: "Frío",
  in_person: "In-person",
  referido: "Referido",
};

export const INTEREST_LABEL: Record<ServiceInterest, string> = {
  web: "Web",
  ads: "Ads",
  ambos: "Web + Ads",
};

export const STATUS_LABEL: Record<PaymentStatus, string> = {
  pagado: "Pagado",
  pendiente: "Pendiente",
  vencido: "Vencido",
  gratis: "Gratis",
};

export const AD_CARD_LABEL: Record<AdCard, string> = {
  cliente: "Tarjeta del cliente",
  mia: "Mi tarjeta",
};

export const KIND_LABEL: Record<ServiceKind, string> = {
  web: "Web",
  retainer: "Retainer",
  ads: "Ads",
};
