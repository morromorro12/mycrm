import type {
  AdMovement,
  Client,
  ClientFull,
  ColdContactDay,
  Habit,
  HabitCheck,
  Payment,
  Prospect,
} from "../types";
import {
  seedClients,
  seedColdContacts,
  seedHabitChecks,
  seedHabits,
  seedProspects,
} from "./seed";
import type { ClientInput, ProspectInput, Repo, ServiceInput } from "./types";

// ============================================================================
// MODO DEMO — se usa sólo mientras NEXT_PUBLIC_SUPABASE_URL esté vacío.
// Guarda todo en memoria del servidor: sirve para probar la app entera sin
// base de datos, pero los cambios se pierden al reiniciar. En cuanto cargues
// las claves de Supabase, este archivo deja de ejecutarse.
// ============================================================================

interface Store {
  prospects: Prospect[];
  clients: ClientFull[];
  coldContacts: ColdContactDay[];
  habits: Habit[];
  habitChecks: HabitCheck[];
  seq: number;
}

// En `globalThis` para que sobreviva al hot-reload de `next dev`.
const g = globalThis as typeof globalThis & { __crmDemo?: Store };
function store(): Store {
  if (!g.__crmDemo) {
    g.__crmDemo = {
      prospects: seedProspects(),
      clients: seedClients(),
      coldContacts: seedColdContacts(),
      habits: seedHabits(),
      habitChecks: seedHabitChecks(),
      seq: 1000,
    };
  }
  // Un store de antes de Metas o de la rutina, que sobrevivió a un hot-reload.
  g.__crmDemo.coldContacts ??= seedColdContacts();
  g.__crmDemo.habits ??= seedHabits();
  g.__crmDemo.habitChecks ??= seedHabitChecks();
  return g.__crmDemo;
}

const id = () => `d${++store().seq}`;
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

export const demoRepo: Repo = {
  mode: "demo",

  async listProspects() {
    return clone(store().prospects.filter((p) => !p.archived));
  },

  async getProspect(pid) {
    return clone(store().prospects.find((p) => p.id === pid) ?? null);
  },

  async createProspect(input: ProspectInput) {
    const p: Prospect = { ...input, id: id(), converted_client_id: null, archived: false };
    store().prospects.unshift(p);
    return clone(p);
  },

  async updateProspect(pid, patch) {
    const p = store().prospects.find((x) => x.id === pid);
    if (p) Object.assign(p, patch);
  },

  async setProspectStage(pid, stage) {
    const p = store().prospects.find((x) => x.id === pid);
    if (p) p.stage = stage;
  },

  async setProspectArchived(pid, archived) {
    const p = store().prospects.find((x) => x.id === pid);
    if (p) p.archived = archived;
  },

  async listArchived() {
    return clone({
      prospects: store().prospects.filter((p) => p.archived),
      clients: store().clients.filter((c) => c.archived),
    });
  },

  async deleteProspect(pid) {
    store().prospects = store().prospects.filter((p) => p.id !== pid);
  },

  async linkProspectToClient(prospectId, clientId) {
    const p = store().prospects.find((x) => x.id === prospectId);
    if (p) p.converted_client_id = clientId;
  },

  async listClients() {
    return clone(
      store()
        .clients.filter((c) => !c.archived)
        .sort((a, b) => a.business_name.localeCompare(b.business_name, "es")),
    );
  },

  async getClient(cid) {
    return clone(store().clients.find((c) => c.id === cid) ?? null);
  },

  async createClient(input: ClientInput, services: ServiceInput[]) {
    const cid = id();
    const c: ClientFull = {
      ...input,
      id: cid,
      active: true,
      archived: false,
      ad_spent: null,
      ad_spent_currency: "USD",
      ad_spent_on: null,
      services: services.map((s) => ({ ...s, id: id(), client_id: cid })),
      payments: [],
      ad_movements: [],
    };
    store().clients.push(c);
    const { services: _s, payments: _p, ad_movements: _m, ...plain } = c;
    return clone(plain as Client);
  },

  async updateClient(cid, patch) {
    const c = store().clients.find((x) => x.id === cid);
    if (c) Object.assign(c, patch);
  },

  async setClientArchived(cid, archived) {
    const c = store().clients.find((x) => x.id === cid);
    if (c) c.archived = archived;
  },

  async deleteClient(cid) {
    store().clients = store().clients.filter((c) => c.id !== cid);
  },

  async addService(clientId, input) {
    const c = store().clients.find((x) => x.id === clientId);
    if (c) c.services.push({ ...input, id: id(), client_id: clientId });
  },

  async updateService(sid, patch) {
    for (const c of store().clients) {
      const s = c.services.find((x) => x.id === sid);
      if (s) return void Object.assign(s, patch);
    }
  },

  async deleteService(sid) {
    for (const c of store().clients) {
      c.services = c.services.filter((s) => s.id !== sid);
    }
  },

  async recordPayment({ clientId, serviceId, period, amount, currency, paidAt, kind }) {
    const c = store().clients.find((x) => x.id === clientId);
    if (!c) return;
    // Mismo efecto que el índice único de Postgres: un pago por servicio y mes.
    if (kind === "inicial") {
      if (c.payments.some((p) => p.kind === "inicial")) return; // uno por cliente
    } else if (c.payments.some((p) => p.service_id === serviceId && p.period === period)) {
      return;
    }
    const p: Payment = {
      id: id(),
      client_id: clientId,
      service_id: serviceId,
      period,
      kind,
      amount,
      currency,
      paid_at: paidAt,
      note: null,
    };
    c.payments.push(p);
  },

  async deletePayment(pid) {
    for (const c of store().clients) {
      c.payments = c.payments.filter((p) => p.id !== pid);
    }
  },

  async listPayments(clientId) {
    const c = store().clients.find((x) => x.id === clientId);
    return clone((c?.payments ?? []).slice().sort((a, b) => b.period.localeCompare(a.period)));
  },

  async addAdMovement(clientId, input) {
    const c = store().clients.find((x) => x.id === clientId);
    if (!c) return;
    const m: AdMovement = { ...input, id: id(), client_id: clientId };
    c.ad_movements.push(m);
  },

  async deleteAdMovement(mid) {
    for (const c of store().clients) {
      c.ad_movements = c.ad_movements.filter((m) => m.id !== mid);
    }
  },

  async listColdContacts() {
    return clone(
      store().coldContacts.slice().sort((a, b) => a.contacted_on.localeCompare(b.contacted_on)),
    );
  },

  async addColdContacts(day, delta) {
    const rows = store().coldContacts;
    const row = rows.find((r) => r.contacted_on === day);
    if (row) row.contacts = Math.max(0, row.contacts + delta);
    else rows.push({ contacted_on: day, contacts: Math.max(0, delta) });
  },

  async listHabits() {
    return clone(store().habits);
  },

  async createHabit(input) {
    const h: Habit = { ...input, id: id() };
    store().habits.push(h);
    return clone(h);
  },

  async updateHabit(hid, patch) {
    const h = store().habits.find((x) => x.id === hid);
    if (h) Object.assign(h, patch);
  },

  async deleteHabit(hid) {
    const s = store();
    s.habits = s.habits.filter((h) => h.id !== hid);
    s.habitChecks = s.habitChecks.filter((c) => c.habit_id !== hid);
  },

  async listHabitChecks() {
    return clone(store().habitChecks);
  },

  async setHabitCheck(hid, day, done) {
    const s = store();
    s.habitChecks = s.habitChecks.filter((c) => !(c.habit_id === hid && c.done_on === day));
    if (done) s.habitChecks.push({ habit_id: hid, done_on: day });
  },
};
