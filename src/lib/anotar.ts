import { repo } from "./data";
import type { ProspectInput } from "./data/types";
import { addDays, dayLabel, daysBetween, isISODate, shortDate } from "./dates";
import type { Novedad } from "./dictado";
import {
  DEFAULT_FOLLOW_UP,
  DEFAULT_FOLLOW_UP_DAYS,
  findProspect,
  followUps,
  isOpenStage,
  lastContactLabel,
} from "./seguimiento";
import { STAGE_LABEL, type Prospect, type ProspectStage } from "./types";

/**
 * Lo que el bot de Telegram hace en el Pipeline con lo que le contaste, y los
 * textos con que te contesta. La regla de fondo: un prospecto abierto nunca
 * queda sin fecha de próximo paso.
 */

/** Cómo quedó un prospecto después de anotar, para contestarte. */
export interface Anotado {
  id: string;
  negocio: string;
  nuevo: boolean;
  etapa: ProspectStage;
  /** La etapa de antes, si cambió. */
  etapaAntes: ProspectStage | null;
  proximo: string | null;
  fecha: string | null;
  /** No dijiste cuándo: la fecha la puso el bot. */
  fechaPuesta: boolean;
}

const limpio = (s: string | null | undefined, max = 200) =>
  s?.replace(/\s+/g, " ").trim().slice(0, max) || null;

/**
 * El próximo paso después de una novedad. Si no lo dijiste, el que había
 * sigue valiendo mientras su fecha sea futura; si ya venció (o no había),
 * pone DEFAULT_FOLLOW_UP dentro de DEFAULT_FOLLOW_UP_DAYS días.
 */
function proximoPaso(
  antes: Pick<Prospect, "next_action" | "next_action_at"> | null,
  n: Pick<Novedad, "hablo">,
  proximo: string | null,
  fecha: string | null,
  today: string,
): { next_action: string; next_action_at: string; puesta: boolean } {
  const vigente = antes?.next_action_at && antes.next_action_at > today ? antes : null;

  if (proximo || fecha) {
    // Sólo la fecha ("pasalo al viernes"): sigue el paso que había, salvo que
    // ya hayas hablado y ese paso esté hecho.
    const action = proximo ?? (n.hablo ? null : antes?.next_action) ?? DEFAULT_FOLLOW_UP;
    return {
      next_action: action,
      next_action_at: fecha ?? addDays(today, DEFAULT_FOLLOW_UP_DAYS),
      puesta: !fecha,
    };
  }
  if (vigente) {
    return { next_action: vigente.next_action ?? DEFAULT_FOLLOW_UP, next_action_at: vigente.next_action_at!, puesta: false };
  }
  return {
    next_action: DEFAULT_FOLLOW_UP,
    next_action_at: addDays(today, DEFAULT_FOLLOW_UP_DAYS),
    puesta: true,
  };
}

/** Crea o actualiza cada prospecto que nombraste. */
export async function anotarProspectos(novedades: Novedad[], today: string): Promise<Anotado[]> {
  const r = repo();
  const prospects = await r.listProspects();
  const out: Anotado[] = [];

  for (const n of novedades) {
    const negocio = limpio(n.negocio, 120);
    if (!negocio) continue;

    // Una fecha pasada no es un próximo paso: es que entendió mal.
    const fecha = isISODate(n.fecha) && n.fecha >= today ? n.fecha : null;
    const proximo = limpio(n.proximo_paso);
    const novedad = limpio(n.novedad, 500);
    const nota = novedad ? `${shortDate(today)}: ${novedad}` : null;
    const contacto = limpio(n.contacto, 80);
    const telefono = limpio(n.telefono, 40);

    // Aunque Claude diga que es nuevo, si ya existe se actualiza ese:
    // un duplicado parte la historia del prospecto en dos.
    const p = findProspect(negocio, prospects);

    if (!p) {
      const etapa = n.etapa ?? "contactado";
      const paso = isOpenStage(etapa) ? proximoPaso(null, n, proximo, fecha, today) : null;
      const created = await r.createProspect({
        business_name: negocio,
        contact_name: contacto,
        phone: telefono,
        service_interest: n.interes ?? "web",
        source: n.fuente ?? "frio",
        stage: etapa,
        last_contact_at: n.hablo ? today : null,
        next_action: paso?.next_action ?? null,
        next_action_at: paso?.next_action_at ?? null,
        notes: nota,
      });
      prospects.push(created);
      out.push({
        id: created.id,
        negocio,
        nuevo: true,
        etapa,
        etapaAntes: null,
        proximo: created.next_action,
        fecha: created.next_action_at,
        fechaPuesta: paso?.puesta ?? false,
      });
      continue;
    }

    const etapa = n.etapa ?? p.stage;
    const patch: Partial<ProspectInput> = {};
    if (etapa !== p.stage) patch.stage = etapa;
    if (n.hablo) patch.last_contact_at = today;
    if (contacto) patch.contact_name = contacto;
    if (telefono) patch.phone = telefono;
    if (n.interes) patch.service_interest = n.interes;
    if (n.fuente) patch.source = n.fuente;
    // Lo nuevo arriba: es lo que vas a querer leer al abrir la ficha.
    if (nota) patch.notes = p.notes ? `${nota}\n${p.notes}` : nota;

    let puesta = false;
    if (!isOpenStage(etapa)) {
      // Cerrado: con él ya no queda nada pendiente en el Pipeline.
      patch.next_action = null;
      patch.next_action_at = null;
    } else {
      const paso = proximoPaso(p, n, proximo, fecha, today);
      patch.next_action = paso.next_action;
      patch.next_action_at = paso.next_action_at;
      puesta = paso.puesta && paso.next_action_at !== p.next_action_at;
    }

    const etapaAntes = patch.stage ? p.stage : null;
    await r.updateProspect(p.id, patch);
    // Al día en memoria, por si el mismo mensaje lo nombra de nuevo.
    Object.assign(p, patch);
    out.push({
      id: p.id,
      negocio: p.business_name,
      nuevo: false,
      etapa,
      etapaAntes,
      proximo: p.next_action,
      fecha: p.next_action_at,
      fechaPuesta: puesta,
    });
  }
  return out;
}

// ── Textos del bot ──────────────────────────────────────────────────────────

const link = (path: string) => {
  const host = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return host ? `https://${host}${path}` : null;
};

/** "• La Pasiva — Demo enviada (antes Contactado)\n  → Llamarlo · jueves 13 nov" */
export function textoAnotado(a: Anotado, today: string): string {
  const etapa =
    a.etapa === "ganado"
      ? "¡Ganado! 🎉"
      : a.nuevo
        ? `nuevo, ${STAGE_LABEL[a.etapa]}`
        : a.etapaAntes
          ? `${STAGE_LABEL[a.etapa]} (antes ${STAGE_LABEL[a.etapaAntes]})`
          : STAGE_LABEL[a.etapa];
  const lines = [`• ${a.negocio} — ${etapa}`];

  if (a.etapa === "ganado") {
    const url = link(`/prospectos/${a.id}/convertir`);
    lines.push(`  Falta darlo de alta como cliente${url ? `: ${url}` : " desde su ficha."}`);
  } else if (a.etapa === "perdido") {
    lines.push("  Sale del seguimiento.");
  } else if (a.fecha) {
    lines.push(
      `  → ${a.proximo ?? DEFAULT_FOLLOW_UP} · ${dayLabel(a.fecha, today)}` +
        (a.fechaPuesta ? " (no dijiste cuándo)" : ""),
    );
  }
  return lines.join("\n");
}

/** Hasta `max` renglones y "…y N más". */
function lista<T>(items: T[], line: (x: T) => string, max = 12): string[] {
  const out = items.slice(0, max).map(line);
  if (items.length > max) out.push(`  …y ${items.length - max} más`);
  return out;
}

/** Atrasado: "era para hace 3 días". */
function cuando(fecha: string, today: string): string {
  const d = daysBetween(fecha, today);
  if (d <= 0) return "hoy";
  if (d === 1) return "era para ayer";
  return `era para hace ${d} días`;
}

/** /seguimiento: a quién tenés que escribirle. */
export function textoSeguimiento(prospects: Prospect[], today: string): string {
  const { due, adrift, upcoming } = followUps(prospects, today);
  if (!due.length && !adrift.length && !upcoming.length) {
    return prospects.some((p) => isOpenStage(p.stage))
      ? "Todo al día: ningún prospecto para hoy, y todos tienen próximo paso."
      : "No tenés prospectos abiertos. Contame a quién le escribiste y lo anoto.";
  }

  const parts: string[] = [];
  if (due.length) {
    parts.push(
      [
        `Para hoy o atrasados (${due.length}):`,
        ...lista(due, (p) => `• ${p.business_name} — ${p.next_action ?? DEFAULT_FOLLOW_UP} (${cuando(p.next_action_at!, today)})`),
      ].join("\n"),
    );
  }
  if (adrift.length) {
    parts.push(
      [
        `Sin próximo paso (${adrift.length}) — estos se te olvidan:`,
        ...lista(adrift, (p) => `• ${p.business_name} — ${STAGE_LABEL[p.stage]}, ${lastContactLabel(p, today)}`),
        `Poneles fecha: «${adrift[0].business_name}: escribirle el lunes».`,
      ].join("\n"),
    );
  }
  if (upcoming.length) {
    parts.push(
      [
        "Esta semana:",
        ...lista(upcoming, (p) => `• ${dayLabel(p.next_action_at!, today)} — ${p.business_name}: ${p.next_action ?? DEFAULT_FOLLOW_UP}`),
      ].join("\n"),
    );
  }
  const url = link("/pipeline");
  if (url) parts.push(url);
  return parts.join("\n\n");
}

/** El recordatorio al pie de cada respuesta, si hay algo olvidado. */
export function textoAviso(prospects: Prospect[], today: string): string | null {
  const { due, adrift } = followUps(prospects, today);
  const bits = [
    due.length ? `${due.length} para hoy o atrasados` : null,
    adrift.length ? `${adrift.length} sin próximo paso` : null,
  ].filter(Boolean);
  return bits.length ? `Ojo: tenés ${bits.join(" y ")}. Mandá /seguimiento para verlos.` : null;
}
