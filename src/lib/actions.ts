"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { currentPeriod, todayISO } from "./dates";
import { isFreeMonth } from "./billing";
import { repo } from "./data";
import type {
  CurrencyCode,
  LeadSource,
  ProspectStage,
  ServiceInterest,
  ServiceKind,
} from "./types";

/**
 * Los agregados del dashboard dependen de todo, así que después de cualquier
 * cambio se refresca la app entera. Con este volumen de datos es instantáneo.
 */
/** Campos del pago inicial, compartidos por alta y conversión de prospecto. */
function parseSetup(fd: FormData) {
  const amount = Number(String(fd.get("setup_amount") ?? "").replace(",", ".")) || 0;
  return {
    setup_amount: amount > 0 ? amount : null,
    setup_currency: (String(fd.get("setup_currency") || "UYU")) as CurrencyCode,
    setup_due_on: amount > 0 ? (String(fd.get("setup_due_on") ?? "").trim() || null) : null,
    setup_note: amount > 0 ? (String(fd.get("setup_note") ?? "").trim() || null) : null,
  };
}

function refresh() {
  revalidatePath("/", "layout");
}

const str = (fd: FormData, k: string): string => String(fd.get(k) ?? "").trim();
const orNull = (fd: FormData, k: string): string | null => str(fd, k) || null;
const num = (fd: FormData, k: string): number => {
  const n = Number(String(fd.get(k) ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

// ── Prospectos ──────────────────────────────────────────────────────────────

/** Mover de etapa. Es lo que dispara el drag-and-drop y el menú rápido. */
export async function moveProspect(id: string, stage: ProspectStage) {
  await repo().setProspectStage(id, stage);
  refresh();
}

export async function saveProspect(id: string | null, fd: FormData) {
  const data = {
    business_name: str(fd, "business_name"),
    contact_name: orNull(fd, "contact_name"),
    phone: orNull(fd, "phone"),
    service_interest: (str(fd, "service_interest") || "web") as ServiceInterest,
    stage: (str(fd, "stage") || "contactado") as ProspectStage,
    source: (str(fd, "source") || "frio") as LeadSource,
    last_contact_at: orNull(fd, "last_contact_at"),
    next_action: orNull(fd, "next_action"),
    next_action_at: orNull(fd, "next_action_at"),
    notes: orNull(fd, "notes"),
  };
  if (!data.business_name) return;

  if (id) await repo().updateProspect(id, data);
  else await repo().createProspect(data);

  refresh();
  redirect("/pipeline");
}

/** Anotar que hablaste hoy: un toque, sin abrir el formulario. */
export async function touchProspect(id: string) {
  await repo().updateProspect(id, { last_contact_at: todayISO() });
  refresh();
}

/** Posponer la próxima acción N días desde hoy. */
export async function snoozeProspect(id: string, days: number) {
  const t = Date.parse(`${todayISO()}T00:00:00Z`) + days * 86_400_000;
  await repo().updateProspect(id, {
    next_action_at: new Date(t).toISOString().slice(0, 10),
  });
  refresh();
}

/**
 * Archivar es la acción normal: el prospecto sale del pipeline y de las
 * búsquedas, pero no se pierde nada y se puede restaurar desde /archivados.
 */
export async function archiveProspect(id: string) {
  await repo().setProspectArchived(id, true);
  refresh();
  redirect("/pipeline");
}

export async function restoreProspect(id: string) {
  await repo().setProspectArchived(id, false);
  refresh();
}

/** Borrado definitivo. Sólo se llega desde el archivo, y no tiene vuelta. */
export async function deleteProspect(id: string) {
  await repo().deleteProspect(id);
  refresh();
  redirect("/archivados");
}

/**
 * Prospecto ganado → cliente activo.
 * Precarga nombre y contacto; los servicios y montos los cargás en el form.
 */
export async function convertProspect(prospectId: string, fd: FormData) {
  const r = repo();
  const p = await r.getProspect(prospectId);
  if (!p) return;

  const services = parseServices(fd);
  const client = await r.createClient(
    {
      business_name: str(fd, "business_name") || p.business_name,
      contact_name: orNull(fd, "contact_name") ?? p.contact_name,
      phone: orNull(fd, "phone") ?? p.phone,
      notes: orNull(fd, "notes") ?? p.notes,
          ...parseSetup(fd),
    },
    services,
  );

  await r.linkProspectToClient(prospectId, client.id);
  await r.setProspectStage(prospectId, "ganado");
  refresh();
  redirect(`/clientes/${client.id}`);
}

// ── Clientes ────────────────────────────────────────────────────────────────

/** Los servicios llegan como filas repetidas del form: kind[], amount[], … */
function parseServices(fd: FormData) {
  const kinds = fd.getAll("svc_kind").map(String);
  const amounts = fd.getAll("svc_amount").map(String);
  const currencies = fd.getAll("svc_currency").map(String);
  const days = fd.getAll("svc_day").map(String);
  const starts = fd.getAll("svc_starts_on").map(String);
  // Los checkbox sin marcar no se envían, así que vienen como lista de índices.
  const free = new Set(fd.getAll("svc_free").map(String));

  return kinds
    .map((kind, i) => ({
      kind: kind as ServiceKind,
      amount: Number((amounts[i] ?? "0").replace(",", ".")) || 0,
      currency: (currencies[i] || "UYU") as CurrencyCode,
      billing_day: Math.min(31, Math.max(1, Number(days[i]) || 1)),
      active: true,
      starts_on: starts[i] || todayISO(),
      first_month_free: free.has(String(i)),
    }))
    .filter((s) => s.kind && s.amount > 0);
}

export async function createClient(fd: FormData) {
  const name = str(fd, "business_name");
  if (!name) return;
  const client = await repo().createClient(
    {
      business_name: name,
      contact_name: orNull(fd, "contact_name"),
      phone: orNull(fd, "phone"),
      notes: orNull(fd, "notes"),
          ...parseSetup(fd),
    },
    parseServices(fd),
  );
  refresh();
  redirect(`/clientes/${client.id}`);
}

export async function updateClient(id: string, fd: FormData) {
  await repo().updateClient(id, {
    business_name: str(fd, "business_name"),
    contact_name: orNull(fd, "contact_name"),
    phone: orNull(fd, "phone"),
    notes: orNull(fd, "notes"),
  });
  refresh();
  redirect(`/clientes/${id}`);
}

export async function saveClientNotes(id: string, fd: FormData) {
  await repo().updateClient(id, { notes: orNull(fd, "notes") });
  refresh();
}

export async function setClientActive(id: string, active: boolean) {
  await repo().updateClient(id, { active });
  refresh();
}

/**
 * Archivar es la acción normal: el cliente sale de las listas y del MRR, pero
 * conserva servicios e historial de pagos y se puede restaurar.
 */
export async function archiveClient(id: string) {
  await repo().setClientArchived(id, true);
  refresh();
  redirect("/clientes");
}

export async function restoreClient(id: string) {
  await repo().setClientArchived(id, false);
  refresh();
}

/**
 * Borrado definitivo: arrastra servicios e historial de pagos.
 * Sólo se llega desde el archivo, y no tiene vuelta atrás.
 */
export async function deleteClient(id: string) {
  await repo().deleteClient(id);
  refresh();
  redirect("/archivados");
}

// ── Servicios ───────────────────────────────────────────────────────────────

export async function addService(clientId: string, fd: FormData) {
  const amount = num(fd, "amount");
  if (amount <= 0) return;
  await repo().addService(clientId, {
    kind: (str(fd, "kind") || "retainer") as ServiceKind,
    amount,
    currency: (str(fd, "currency") || "UYU") as CurrencyCode,
    billing_day: Math.min(31, Math.max(1, Number(str(fd, "billing_day")) || 1)),
    active: true,
    starts_on: str(fd, "starts_on") || todayISO(),
    first_month_free: fd.get("first_month_free") === "on",
  });
  refresh();
}

export async function updateService(id: string, fd: FormData) {
  await repo().updateService(id, {
    kind: (str(fd, "kind") || "retainer") as ServiceKind,
    amount: num(fd, "amount"),
    currency: (str(fd, "currency") || "UYU") as CurrencyCode,
    billing_day: Math.min(31, Math.max(1, Number(str(fd, "billing_day")) || 1)),
    starts_on: str(fd, "starts_on") || todayISO(),
    first_month_free: fd.get("first_month_free") === "on",
  });
  refresh();
}

export async function toggleService(id: string, active: boolean) {
  await repo().updateService(id, { active });
  refresh();
}

export async function deleteService(id: string) {
  await repo().deleteService(id);
  refresh();
}

// ── Pago inicial ────────────────────────────────────────────────────────────

/** Cargar o editar el pago inicial de un cliente ya existente. */
export async function saveSetup(clientId: string, fd: FormData) {
  await repo().updateClient(clientId, parseSetup(fd));
  refresh();
}

/** Marcarlo cobrado. Queda en el historial igual que los mensuales. */
export async function markSetupPaid(clientId: string) {
  const r = repo();
  const client = await r.getClient(clientId);
  if (!client?.setup_amount) return;

  await r.recordPayment({
    clientId,
    serviceId: "",
    period: currentPeriod(),
    amount: client.setup_amount,
    currency: client.setup_currency,
    paidAt: todayISO(),
    kind: "inicial",
  });
  refresh();
}

// ── Pagos ───────────────────────────────────────────────────────────────────

/**
 * Marca UN servicio como pagado en el mes en curso.
 * Queda en el historial; el estado del mes siguiente se recalcula solo.
 */
export async function markServicePaid(clientId: string, serviceId: string) {
  const r = repo();
  const client = await r.getClient(clientId);
  const svc = client?.services.find((s) => s.id === serviceId);
  if (!client || !svc) return;

  await r.recordPayment({
    clientId,
    serviceId,
    period: currentPeriod(),
    amount: svc.amount,
    currency: svc.currency,
    paidAt: todayISO(),
    kind: "mensual",
  });
  refresh();
}

/**
 * El botón de un click de la tabla: marca pagados TODOS los servicios activos
 * del cliente que sigan sin pagar este mes.
 */
export async function markClientPaid(clientId: string) {
  const r = repo();
  const client = await r.getClient(clientId);
  if (!client) return;
  const period = currentPeriod();
  const paidAt = todayISO();

  for (const svc of client.services) {
    if (!svc.active) continue;
    const already = client.payments.some(
      (p) => p.service_id === svc.id && p.period === period,
    );
    if (already) continue;
    if (isFreeMonth(svc)) continue; // mes de promo: no hay nada que cobrar
    await r.recordPayment({
      clientId,
      serviceId: svc.id,
      period,
      amount: svc.amount,
      currency: svc.currency,
      paidAt,
      kind: "mensual",
    });
  }
  refresh();
}

/** Deshacer un pago mal marcado. */
export async function deletePayment(paymentId: string) {
  await repo().deletePayment(paymentId);
  refresh();
}
