"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { currentPeriod, isISODate, todayISO, weekStart } from "./dates";
import { amountDue, isFreeMonth } from "./billing";
import { repo } from "./data";
import { cleanTitles } from "./pendientes";
import type {
  AdCard,
  CurrencyCode,
  HabitKind,
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

/**
 * La pauta en Meta de un servicio de Ads: cuánto quiere invertir el cliente y
 * con qué tarjeta se paga. En cualquier otro servicio queda vacía, así que
 * pasar un servicio de Ads a Retainer la borra.
 */
function parseAdSpend(
  kind: ServiceKind,
  budget: FormDataEntryValue | null,
  currency: FormDataEntryValue | null,
  card: FormDataEntryValue | null,
) {
  if (kind !== "ads") return { ad_budget: null, ad_currency: "USD" as CurrencyCode, ad_card: null };
  const n = Number(String(budget ?? "").replace(",", "."));
  return {
    ad_budget: n > 0 ? n : null,
    ad_currency: (String(currency ?? "") || "USD") as CurrencyCode,
    ad_card: card === "cliente" || card === "mia" ? (card as AdCard) : null,
  };
}

/**
 * Primer mes: precio normal, gratis, o con descuento. El descuento es lo que
 * se cobra ese mes; si no es menor que el precio normal, no es descuento.
 */
function parseFirstMonth(
  mode: FormDataEntryValue | null,
  value: FormDataEntryValue | null,
  amount: number,
) {
  if (mode === "gratis") return { first_month_free: true, first_month_amount: null };
  const raw = String(value ?? "").trim();
  const n = Number(raw.replace(",", "."));
  if (mode === "descuento" && raw && Number.isFinite(n) && n >= 0 && n < amount) {
    // Cobrar 0 el primer mes es lo mismo que darlo gratis.
    return n === 0
      ? { first_month_free: true, first_month_amount: null }
      : { first_month_free: false, first_month_amount: n };
  }
  return { first_month_free: false, first_month_amount: null };
}

/** Los servicios llegan como filas repetidas del form: kind[], amount[], … */
function parseServices(fd: FormData) {
  const kinds = fd.getAll("svc_kind").map(String);
  const amounts = fd.getAll("svc_amount").map(String);
  const currencies = fd.getAll("svc_currency").map(String);
  const days = fd.getAll("svc_day").map(String);
  const starts = fd.getAll("svc_starts_on").map(String);

  return kinds
    .map((kind, i) => {
      const amount = Number((amounts[i] ?? "0").replace(",", ".")) || 0;
      return {
        kind: kind as ServiceKind,
        amount,
        currency: (currencies[i] || "UYU") as CurrencyCode,
        billing_day: Math.min(31, Math.max(1, Number(days[i]) || 1)),
        active: true,
        starts_on: starts[i] || todayISO(),
        // Los campos que no están en todas las filas van con el índice en el
        // nombre en vez de como lista.
        ...parseFirstMonth(fd.get(`first_month_${i}`), fd.get(`first_month_amount_${i}`), amount),
        ...parseAdSpend(
          kind as ServiceKind,
          fd.get(`ad_budget_${i}`),
          fd.get(`ad_currency_${i}`),
          fd.get(`ad_card_${i}`),
        ),
      };
    })
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
  const kind = (str(fd, "kind") || "retainer") as ServiceKind;
  await repo().addService(clientId, {
    kind,
    amount,
    currency: (str(fd, "currency") || "UYU") as CurrencyCode,
    billing_day: Math.min(31, Math.max(1, Number(str(fd, "billing_day")) || 1)),
    active: true,
    starts_on: str(fd, "starts_on") || todayISO(),
    ...parseFirstMonth(fd.get("first_month"), fd.get("first_month_amount"), amount),
    ...parseAdSpend(kind, fd.get("ad_budget"), fd.get("ad_currency"), fd.get("ad_card")),
  });
  refresh();
}

export async function updateService(id: string, fd: FormData) {
  const kind = (str(fd, "kind") || "retainer") as ServiceKind;
  const amount = num(fd, "amount");
  await repo().updateService(id, {
    kind,
    amount,
    currency: (str(fd, "currency") || "UYU") as CurrencyCode,
    billing_day: Math.min(31, Math.max(1, Number(str(fd, "billing_day")) || 1)),
    starts_on: str(fd, "starts_on") || todayISO(),
    ...parseFirstMonth(fd.get("first_month"), fd.get("first_month_amount"), amount),
    ...parseAdSpend(kind, fd.get("ad_budget"), fd.get("ad_currency"), fd.get("ad_card")),
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
  if (isFreeMonth(svc)) return; // mes de promo: no hay nada que cobrar

  await r.recordPayment({
    clientId,
    serviceId,
    period: currentPeriod(),
    amount: amountDue(svc), // el primer mes con descuento se cobra menos
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
      amount: amountDue(svc),
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

// ── Pauta con tu tarjeta ────────────────────────────────────────────────────

/**
 * Anotar plata que el cliente te transfirió para la pauta. No es un cobro
 * tuyo, así que no toca `payments` ni el MRR.
 */
export async function addAdMovement(clientId: string, fd: FormData) {
  const amount = num(fd, "amount");
  if (amount <= 0) return;
  await repo().addAdMovement(clientId, {
    kind: "transferencia",
    amount,
    currency: (str(fd, "currency") || "USD") as CurrencyCode,
    moved_on: str(fd, "moved_on") || todayISO(),
    note: orNull(fd, "note"),
  });
  refresh();
}

/** Deshacer una transferencia mal anotada. */
export async function deleteAdMovement(id: string) {
  await repo().deleteAdMovement(id);
  refresh();
}

/**
 * Lo que lleva gastado la campaña. Se PISA con lo que dice Meta, no se suma:
 * así no hay que llevar la cuenta de cada cobro. Vacío = sin cargar.
 */
export async function saveAdSpent(clientId: string, fd: FormData) {
  const raw = str(fd, "ad_spent");
  const n = Number(raw.replace(",", "."));
  if (raw && !(Number.isFinite(n) && n >= 0)) return; // no borrar el número por un typo
  await repo().updateClient(clientId, {
    ad_spent: raw ? n : null,
    ad_spent_currency: (str(fd, "ad_spent_currency") || "USD") as CurrencyCode,
    ad_spent_on: raw ? todayISO() : null,
  });
  refresh();
}

// ── Metas ───────────────────────────────────────────────────────────────────

/**
 * Sumar contactados en frío a hoy, o restar para corregir un toque de más.
 * Sólo el número: sin nombres, para que anotar no lleve más que contactar.
 */
export async function addColdContacts(delta: number) {
  const n = Math.trunc(delta);
  if (!Number.isFinite(n) || n === 0 || Math.abs(n) > 1000) return;
  await repo().addColdContacts(todayISO(), n);
  refresh();
}

// ── Rutina semanal ──────────────────────────────────────────────────────────

/** Tachar o destachar. Sólo hasta hoy: lo de mañana se tacha mañana. */
export async function setHabitDone(habitId: string, day: string, done: boolean) {
  if (!isISODate(day) || day > todayISO()) return;
  await repo().setHabitCheck(habitId, day, done === true);
  refresh();
}

/**
 * Título y cuándo toca, ya limpios; null si falta algo. Con `per_week` (1 a 7)
 * es "tantas veces por semana" y los días no importan: se guardan todos.
 */
function cleanHabit(input: { title: unknown; weekdays: unknown; per_week?: unknown }) {
  const title = String(input.title ?? "").trim().replace(/\s+/g, " ").slice(0, 80);
  const perWeek = Number(input.per_week);
  if (input.per_week != null && Number.isInteger(perWeek) && perWeek >= 1 && perWeek <= 7) {
    return title ? { title, weekdays: [1, 2, 3, 4, 5, 6, 7], per_week: perWeek } : null;
  }
  const raw = Array.isArray(input.weekdays) ? input.weekdays : [];
  const weekdays = [...new Set(raw.map(Number))]
    .filter((n) => Number.isInteger(n) && n >= 1 && n <= 7)
    .sort((a, b) => a - b);
  return title && weekdays.length > 0 ? { title, weekdays, per_week: null } : null;
}

type HabitForm = { title: string; weekdays: number[]; per_week: number | null };

async function activeHabits() {
  return (await repo().listHabits())
    .filter((h) => h.ends_on === null)
    .sort((a, b) => a.position - b.position);
}

export async function addHabit(input: HabitForm & { kind?: HabitKind }) {
  const kind: HabitKind = input.kind === "frio" ? "frio" : "check";
  // La de contactados en frío es por día: se cumple con la meta diaria.
  const clean = cleanHabit(kind === "frio" ? { ...input, per_week: null } : input);
  if (!clean) return;
  const current = await activeHabits();
  await repo().createHabit({
    ...clean,
    kind,
    position: current.reduce((max, h) => Math.max(max, h.position + 1), 0),
    starts_on: todayISO(),
    ends_on: null,
  });
  refresh();
}

/**
 * Cambiar el título se hace en el lugar. Cambiar cuándo toca (los días, las
 * veces por semana o de una cosa a la otra), de hoy en adelante: la versión
 * vieja termina hoy y arranca una nueva, así los días y semanas que ya
 * pasaron quedan como estaban y la racha no se toca. Lo tachado esta semana
 * se copia a la versión nueva, para no perder lo que ya hiciste.
 */
export async function updateHabit(id: string, input: HabitForm) {
  const h = (await activeHabits()).find((x) => x.id === id);
  const clean = h && cleanHabit(h.kind === "frio" ? { ...input, per_week: null } : input);
  if (!clean || !h) return;

  const today = todayISO();
  const sameSchedule =
    (h.per_week ?? null) === clean.per_week &&
    (clean.per_week !== null ||
      clean.weekdays.join() === [...h.weekdays].sort((a, b) => a - b).join());
  if (sameSchedule || h.starts_on >= today) {
    await repo().updateHabit(id, clean);
  } else {
    await repo().updateHabit(id, { ends_on: today });
    const next = await repo().createHabit({
      ...clean,
      kind: h.kind,
      position: h.position,
      starts_on: today,
      ends_on: null,
    });
    const monday = weekStart(today);
    const thisWeek = (await repo().listHabitChecks()).filter(
      (c) => c.habit_id === id && c.done_on >= monday && c.done_on <= today,
    );
    await Promise.all(thisWeek.map((c) => repo().setHabitCheck(next.id, c.done_on, true)));
  }
  refresh();
}

/**
 * Sacar una tarea de la rutina. Si la creaste hoy se borra; si no, deja de
 * tocar desde hoy y los días pasados la siguen mostrando tal cual.
 */
export async function removeHabit(id: string) {
  const h = (await activeHabits()).find((x) => x.id === id);
  if (!h) return;
  const today = todayISO();
  if (h.starts_on >= today) await repo().deleteHabit(id);
  else await repo().updateHabit(id, { ends_on: today });
  refresh();
}

/** Subir o bajar una tarea en la lista. Renumera todas para que no haya empates. */
export async function moveHabit(id: string, dir: -1 | 1) {
  const list = await activeHabits();
  const i = list.findIndex((h) => h.id === id);
  const j = i + (dir === -1 ? -1 : 1);
  if (i < 0 || j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
  await Promise.all(
    list.map((h, n) => (h.position === n ? null : repo().updateHabit(h.id, { position: n }))),
  );
  refresh();
}

// ── Pendientes ──────────────────────────────────────────────────────────────

/** Anotar a mano. Cada renglón es un pendiente aparte. */
export async function addTodo(text: string) {
  const titles = cleanTitles(String(text ?? "").split("\n"));
  if (!titles.length) return;
  await repo().addTodos(titles);
  refresh();
}

export async function setTodoDone(id: string, done: boolean) {
  await repo().setTodoDone(id, done === true);
  refresh();
}

export async function deleteTodo(id: string) {
  await repo().deleteTodo(id);
  refresh();
}
