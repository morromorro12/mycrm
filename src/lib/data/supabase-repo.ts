import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Client, ClientFull, ColdContactDay, Payment, Prospect } from "../types";
import type { Repo } from "./types";

export function supabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  return url && key ? { url, key } : null;
}

let cached: SupabaseClient | null = null;
function db(): SupabaseClient {
  const cfg = supabaseConfig();
  if (!cfg) throw new Error("Supabase no está configurado");
  cached ??= createClient(cfg.url, cfg.key, { auth: { persistSession: false } });
  return cached;
}

/** Cualquier error de PostgREST corta acá con un mensaje legible. */
function check<T>(
  res: { data: T; error: { message: string; code?: string } | null },
  what: string,
): T {
  if (!res.error) return res.data;

  // 42703 = la columna no existe. Pasa siempre por lo mismo: se actualizó el
  // código pero falta correr la migración en Supabase. Vale la pena decirlo
  // con todas las letras en vez de dejar el mensaje crudo de Postgres.
  if (res.error.code === "42703") {
    throw new Error(
      `${what}: la base todavía no tiene una columna que el código espera ` +
        `(${res.error.message}). Falta correr supabase/schema.sql en el ` +
        `SQL Editor de Supabase: es idempotente y no toca los datos.`,
    );
  }
  // Lo mismo, pero con una tabla entera: 42P01 viene de Postgres, y PGRST200 /
  // PGRST205 de la API cuando no encuentra la tabla o la relación.
  if (["42P01", "PGRST200", "PGRST205"].includes(res.error.code ?? "")) {
    throw new Error(
      `${what}: la base todavía no tiene una tabla que el código espera ` +
        `(${res.error.message}). Falta correr supabase/schema.sql en el ` +
        `SQL Editor de Supabase: es idempotente y no toca los datos.`,
    );
  }

  throw new Error(`${what}: ${res.error.message}`);
}

/**
 * Lecturas mínimas para que Supabase vea actividad. El plan gratis pausa el
 * proyecto tras unos 7 días sin pedidos ("unos pocos por día" alcanzan), así
 * que se toca cada tabla una vez en vez de hacer un solo pedido.
 */
export async function pingSupabase() {
  for (const table of ["clients", "prospects", "payments"]) {
    check(await db().from(table).select("id").limit(1), `ping ${table}`);
  }
}

/** Cliente + servicios + pagos + pauta, en un solo request. */
const CLIENT_FULL = "*, services:client_services(*), payments(*), ad_movements(*)";

export const supabaseRepo: Repo = {
  mode: "supabase",

  async listProspects() {
    const r = await db()
      .from("prospects")
      .select("*")
      .eq("archived", false)
      .order("next_action_at", { ascending: true, nullsFirst: false })
      .order("business_name");
    return check(r, "listar prospectos") as Prospect[];
  },

  async getProspect(id) {
    const r = await db().from("prospects").select("*").eq("id", id).maybeSingle();
    return check(r, "leer prospecto") as Prospect | null;
  },

  async createProspect(input) {
    const r = await db().from("prospects").insert(input).select().single();
    return check(r, "crear prospecto") as Prospect;
  },

  async updateProspect(id, patch) {
    check(await db().from("prospects").update(patch).eq("id", id), "actualizar prospecto");
  },

  async setProspectStage(id, stage) {
    check(await db().from("prospects").update({ stage }).eq("id", id), "mover prospecto");
  },

  async setProspectArchived(id, archived) {
    check(await db().from("prospects").update({ archived }).eq("id", id), "archivar prospecto");
  },

  async listArchived() {
    const [p, c] = await Promise.all([
      db().from("prospects").select("*").eq("archived", true).order("business_name"),
      db()
        .from("clients")
        .select(CLIENT_FULL)
        .eq("archived", true)
        .order("business_name"),
    ]);
    return {
      prospects: (check(p, "listar prospectos archivados") ?? []) as Prospect[],
      clients: (check(c, "listar clientes archivados") ?? []) as ClientFull[],
    };
  },

  async deleteProspect(id) {
    check(await db().from("prospects").delete().eq("id", id), "borrar prospecto");
  },

  async linkProspectToClient(prospectId, clientId) {
    check(
      await db()
        .from("prospects")
        .update({ converted_client_id: clientId, stage: "ganado" })
        .eq("id", prospectId),
      "vincular prospecto",
    );
  },

  async listClients() {
    // Un solo request: cliente + servicios + pagos + pauta.
    const r = await db()
      .from("clients")
      .select(CLIENT_FULL)
      .eq("archived", false)
      .order("business_name");
    return (check(r, "listar clientes") ?? []) as ClientFull[];
  },

  async getClient(id) {
    const r = await db()
      .from("clients")
      .select(CLIENT_FULL)
      .eq("id", id)
      .maybeSingle();
    return check(r, "leer cliente") as ClientFull | null;
  },

  async createClient(input, services) {
    const c = check(
      await db().from("clients").insert(input).select().single(),
      "crear cliente",
    ) as Client;
    if (services.length) {
      check(
        await db()
          .from("client_services")
          .insert(services.map((s) => ({ ...s, client_id: c.id }))),
        "crear servicios",
      );
    }
    return c;
  },

  async updateClient(id, patch) {
    check(await db().from("clients").update(patch).eq("id", id), "actualizar cliente");
  },

  async setClientArchived(id, archived) {
    check(await db().from("clients").update({ archived }).eq("id", id), "archivar cliente");
  },

  async deleteClient(id) {
    check(await db().from("clients").delete().eq("id", id), "borrar cliente");
  },

  async addService(clientId, input) {
    check(
      await db().from("client_services").insert({ ...input, client_id: clientId }),
      "agregar servicio",
    );
  },

  async updateService(id, patch) {
    check(await db().from("client_services").update(patch).eq("id", id), "actualizar servicio");
  },

  async deleteService(id) {
    check(await db().from("client_services").delete().eq("id", id), "borrar servicio");
  },

  async recordPayment({ clientId, serviceId, period, amount, currency, paidAt, kind }) {
    const row = {
      client_id: clientId,
      service_id: kind === "inicial" ? null : serviceId,
      period,
      kind,
      amount,
      currency,
      paid_at: paidAt,
    };

    if (kind === "inicial") {
      // El índice del pago inicial es parcial, así que ON CONFLICT no lo puede
      // inferir: se consulta antes de insertar.
      const prev = check(
        await db()
          .from("payments")
          .select("id")
          .eq("client_id", clientId)
          .eq("kind", "inicial")
          .maybeSingle(),
        "buscar pago inicial",
      );
      if (prev) return;
      check(await db().from("payments").insert(row), "registrar pago inicial");
      return;
    }

    // onConflict sobre (service_id, period): tocar el botón dos veces no
    // duplica el pago.
    check(
      await db()
        .from("payments")
        .upsert(row, { onConflict: "service_id,period", ignoreDuplicates: true }),
      "registrar pago",
    );
  },

  async deletePayment(id) {
    check(await db().from("payments").delete().eq("id", id), "borrar pago");
  },

  async listPayments(clientId) {
    const r = await db()
      .from("payments")
      .select("*")
      .eq("client_id", clientId)
      .order("period", { ascending: false });
    return (check(r, "listar pagos") ?? []) as Payment[];
  },

  async addAdMovement(clientId, input) {
    check(
      await db().from("ad_movements").insert({ ...input, client_id: clientId }),
      "anotar movimiento de pauta",
    );
  },

  async deleteAdMovement(id) {
    check(await db().from("ad_movements").delete().eq("id", id), "borrar movimiento de pauta");
  },

  async listColdContacts() {
    // La API devuelve hasta 1000 filas por pedido. Una por día alcanza para
    // casi tres años, pero se pide de a páginas para que el total nunca se corte.
    const rows: ColdContactDay[] = [];
    for (let from = 0; ; from += 1000) {
      const r = await db()
        .from("cold_contacts")
        .select("contacted_on, contacts")
        .order("contacted_on")
        .range(from, from + 999);
      const page = (check(r, "listar contactados") ?? []) as ColdContactDay[];
      rows.push(...page);
      if (page.length < 1000) return rows;
    }
  },

  async addColdContacts(day, delta) {
    const prev = check(
      await db().from("cold_contacts").select("contacts").eq("contacted_on", day).maybeSingle(),
      "leer contactados",
    ) as { contacts: number } | null;
    const contacts = Math.max(0, (prev?.contacts ?? 0) + delta);
    check(
      await db()
        .from("cold_contacts")
        .upsert({ contacted_on: day, contacts }, { onConflict: "contacted_on" }),
      "anotar contactados",
    );
  },
};
