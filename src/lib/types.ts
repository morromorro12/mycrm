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
  /** false = pausado: sigue siendo cliente, pero no cuenta para MRR ni cobros. */
  active: boolean;
  /** Archivado: sale de todas las listas, pero no se borra nada. */
  archived: boolean;
}

/** Cliente con sus servicios y pagos ya resueltos. Lo que consumen las vistas. */
export interface ClientFull extends Client {
  services: ClientService[];
  payments: Payment[];
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

export const KIND_LABEL: Record<ServiceKind, string> = {
  web: "Web",
  retainer: "Retainer",
  ads: "Ads",
};
