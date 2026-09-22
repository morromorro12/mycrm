import {
  currentPeriod,
  dayOfMonth,
  effectiveBillingDay,
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

export function serviceStatus(
  service: ClientService,
  payments: Payment[],
  today = todayISO(),
): PaymentStatus {
  if (isPaid(service, payments, `${today.slice(0, 7)}-01`)) return "pagado";
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
  return dayOfMonth(today) === effectiveBillingDay(service.billing_day, today);
}

const SEVERITY: Record<PaymentStatus, number> = { pagado: 0, pendiente: 1, vencido: 2 };

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

export interface MonthSummary {
  /** Ya entró este mes. */
  collected: MoneyByCurrency;
  /** Falta cobrar: pendiente + vencido. */
  pending: MoneyByCurrency;
  /** Sólo lo vencido (subconjunto de `pending`). */
  overdue: MoneyByCurrency;
  overdueClients: number;
}

/** Cobrado vs pendiente del mes en curso. */
export function monthSummary(
  clients: ClientFull[],
  today = todayISO(),
): MonthSummary {
  let collected = ZERO;
  let pending = ZERO;
  let overdue = ZERO;
  let overdueClients = 0;

  for (const c of clients) {
    if (!c.active) continue;
    let hasOverdue = false;
    for (const s of c.services) {
      if (!s.active) continue;
      const status = serviceStatus(s, c.payments, today);
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

  return { collected, pending, overdue, overdueClients };
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
