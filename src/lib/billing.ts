import {
  currentPeriod,
  dayOfMonth,
  effectiveBillingDay,
  periodOf,
  todayISO,
} from "./dates";
import { ZERO, addMoney, type MoneyByCurrency } from "./money";
import type {
  ClientFull,
  ClientService,
  Payment,
  PaymentStatus,
  Prospect,
} from "./types";

// ============================================================================
// El estado de pago NUNCA se guarda en la base: se deriva de si existe la fila
// de pago del mes actual. Esa es la razón por la que el 1° de cada mes todos
// los clientes vuelven solos a "pendiente" sin que haya que correr nada.
// ============================================================================

export function isPaid(
  service: ClientService,
  payments: Payment[],
  period = currentPeriod(),
): boolean {
  return payments.some((p) => p.service_id === service.id && p.period === period);
}

/**
 * ¿Este mes es el mes de promo del servicio?
 * Es el mes en que arrancó, y sólo si tiene marcado "primer mes gratis".
 */
export function isFreeMonth(service: ClientService, today = todayISO()): boolean {
  if (!service.first_month_free) return false;
  return periodOf(today) === periodOf(service.starts_on);
}

export function serviceStatus(
  service: ClientService,
  payments: Payment[],
  today = todayISO(),
): PaymentStatus {
  if (isPaid(service, payments, `${today.slice(0, 7)}-01`)) return "pagado";
  // El mes gratis no es una deuda: no vence ni queda pendiente.
  if (isFreeMonth(service, today)) return "gratis";
  const due = effectiveBillingDay(service.billing_day, today);
  // El mismo día de cobro todavía no está vencido: vence al día siguiente.
  return dayOfMonth(today) > due ? "vencido" : "pendiente";
}

/** ¿Vence justo hoy? Sirve para la lista de Atención hoy. */
export function isDueToday(
  service: ClientService,
  payments: Payment[],
  today = todayISO(),
): boolean {
  if (isPaid(service, payments, `${today.slice(0, 7)}-01`)) return false;
  if (isFreeMonth(service, today)) return false;
  return dayOfMonth(today) === effectiveBillingDay(service.billing_day, today);
}

// `gratis` y `pagado` pesan igual: en ninguno de los dos hay plata por cobrar.
const SEVERITY: Record<PaymentStatus, number> = {
  pagado: 0,
  gratis: 0,
  pendiente: 1,
  vencido: 2,
};

/** Estado del cliente = el peor estado entre sus servicios activos. */
export function clientStatus(client: ClientFull, today = todayISO()): PaymentStatus {
  const active = client.services.filter((s) => s.active);
  if (active.length === 0) return "pagado";
  return active
    .map((s) => serviceStatus(s, client.payments, today))
    .reduce((worst, s) => (SEVERITY[s] > SEVERITY[worst] ? s : worst), "pagado" as PaymentStatus);
}

/** MRR: suma de todos los servicios activos de clientes activos, por moneda. */
export function mrr(clients: ClientFull[]): MoneyByCurrency {
  let total = ZERO;
  for (const c of clients) {
    if (!c.active) continue;
    for (const s of c.services) {
      if (s.active) total = addMoney(total, s.currency, s.amount);
    }
  }
  return total;
}

// ── Pago inicial ────────────────────────────────────────────────────────────
// El cobro de arranque del proyecto. Uno por cliente, no se repite, y por eso
// NO entra en el MRR. Pero sí tiene que aparecer en "atención hoy": suele ser
// el importe más grande de todos y es el más fácil de que se pase.

export function setupPayment(client: ClientFull): Payment | undefined {
  return client.payments.find((p) => p.kind === "inicial");
}

/** null = este cliente no tiene pago inicial cargado. */
export function setupStatus(
  client: ClientFull,
  today = todayISO(),
): PaymentStatus | null {
  if (client.setup_amount == null || client.setup_amount <= 0) return null;
  if (setupPayment(client)) return "pagado";
  if (client.setup_due_on && client.setup_due_on < today) return "vencido";
  return "pendiente";
}

/** Total de pagos iniciales todavía sin cobrar, por moneda. */
export function pendingSetups(
  clients: ClientFull[],
  today = todayISO(),
): { totals: MoneyByCurrency; count: number } {
  let totals = ZERO;
  let count = 0;
  for (const c of clients) {
    if (!c.active) continue;
    const st = setupStatus(c, today);
    if (st === "pendiente" || st === "vencido") {
      totals = addMoney(totals, c.setup_currency, c.setup_amount ?? 0);
      count++;
    }
  }
  return { totals, count };
}

export interface MonthSummary {
  /** Ya entró este mes. */
  collected: MoneyByCurrency;
  /** Falta cobrar: pendiente + vencido. */
  pending: MoneyByCurrency;
  /** Sólo lo vencido (subconjunto de `pending`). */
  overdue: MoneyByCurrency;
  overdueClients: number;
  /**
   * Lo que este mes no se cobra por estar de promo. Explica por qué el MRR
   * no coincide con cobrado + pendiente.
   */
  free: MoneyByCurrency;
}

/** Cobrado vs pendiente del mes en curso. */
export function monthSummary(
  clients: ClientFull[],
  today = todayISO(),
): MonthSummary {
  let collected = ZERO;
  let pending = ZERO;
  let overdue = ZERO;
  let free = ZERO;
  let overdueClients = 0;

  for (const c of clients) {
    if (!c.active) continue;
    let hasOverdue = false;
    for (const s of c.services) {
      if (!s.active) continue;
      const status = serviceStatus(s, c.payments, today);
      // Un mes de promo no entró ni está por entrar: queda fuera de las dos.
      if (status === "gratis") {
        free = addMoney(free, s.currency, s.amount);
        continue;
      }
      if (status === "pagado") {
        collected = addMoney(collected, s.currency, s.amount);
      } else {
        pending = addMoney(pending, s.currency, s.amount);
        if (status === "vencido") {
          overdue = addMoney(overdue, s.currency, s.amount);
          hasOverdue = true;
        }
      }
    }
    if (hasOverdue) overdueClients++;
  }

  return { collected, pending, overdue, overdueClients, free };
}

// ── Atención hoy ────────────────────────────────────────────────────────────

export interface AttentionProspect {
  kind: "prospect";
  prospect: Prospect;
  date: string;
  overdue: boolean;
}

export interface AttentionClient {
  kind: "client";
  client: ClientFull;
  status: Extract<PaymentStatus, "vencido" | "pendiente">;
  services: ClientService[];
  /** true = lo que falta cobrar es el pago inicial, no la cuota del mes. */
  setup: boolean;
}

export type AttentionItem = AttentionProspect | AttentionClient;

const OPEN_STAGES = new Set(["contactado", "demo_enviada", "propuesta_enviada", "negociacion"]);

/**
 * Lo que necesita tu atención HOY:
 *  · prospectos abiertos con próxima acción vencida o para hoy
 *  · clientes con algún servicio vencido, o que vence justo hoy
 * Ordenado por urgencia: lo más atrasado primero.
 */
export function attentionItems(
  prospects: Prospect[],
  clients: ClientFull[],
  today = todayISO(),
): AttentionItem[] {
  const items: AttentionItem[] = [];

  for (const p of prospects) {
    if (!OPEN_STAGES.has(p.stage)) continue;
    if (!p.next_action_at) continue;
    if (p.next_action_at > today) continue;
    items.push({
      kind: "prospect",
      prospect: p,
      date: p.next_action_at,
      overdue: p.next_action_at < today,
    });
  }

  for (const c of clients) {
    if (!c.active) continue;

    // El pago inicial va como fila aparte: es otro cobro, con otro monto.
    const setup = setupStatus(c, today);
    if (setup === "vencido" || setup === "pendiente") {
      items.push({ kind: "client", client: c, status: setup, services: [], setup: true });
    }

    const due = c.services.filter(
      (s) =>
        s.active &&
        (serviceStatus(s, c.payments, today) === "vencido" || isDueToday(s, c.payments, today)),
    );
    if (due.length === 0) continue;
    const overdue = due.some((s) => serviceStatus(s, c.payments, today) === "vencido");
    items.push({
      kind: "client",
      client: c,
      status: overdue ? "vencido" : "pendiente",
      services: due,
      setup: false,
    });
  }

  // Cobros vencidos primero, después seguimientos, cada grupo por antigüedad.
  return items.sort((a, b) => {
    const rank = (i: AttentionItem) =>
      i.kind === "client" ? (i.status === "vencido" ? 0 : 2) : i.overdue ? 1 : 3;
    const d = rank(a) - rank(b);
    if (d !== 0) return d;
    if (a.kind === "prospect" && b.kind === "prospect") return a.date.localeCompare(b.date);
    return 0;
  });
}
