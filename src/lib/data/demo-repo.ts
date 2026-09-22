import type { Client, ClientFull, Payment, Prospect } from "../types";
import { seedClients, seedProspects } from "./seed";
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
  seq: number;
}

// En `globalThis` para que sobreviva al hot-reload de `next dev`.
const g = globalThis as typeof globalThis & { __crmDemo?: Store };
function store(): Store {
  if (!g.__crmDemo) {
    g.__crmDemo = { prospects: seedProspects(), clients: seedClients(), seq: 1000 };
  }
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
      services: services.map((s) => ({ ...s, id: id(), client_id: cid })),
      payments: [],
    };
    store().clients.push(c);
    const { services: _s, payments: _p, ...plain } = c;
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
};
