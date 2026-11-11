import { addDays, daysBetween } from "./dates";
import type { Prospect, ProspectStage } from "./types";

/**
 * Seguimiento de prospectos: que ninguno se quede sin próximo paso.
 *
 * El problema que resuelve: los que te escribieron hace poco te tapan a los
 * de hace dos semanas. Un prospecto abierto sin fecha de próximo paso no
 * aparece nunca en "Atención hoy", así que se olvida. Por eso:
 *   · el bot de Telegram nunca deja uno sin fecha (si no decís cuándo, pone
 *     DEFAULT_FOLLOW_UP_DAYS), y
 *   · los que ya quedaron sin fecha se muestran aparte, el más olvidado
 *     primero, en el Pipeline, en Hoy y con /seguimiento.
 *
 * Sin nada del servidor: lo usan también componentes de cliente.
 */

/** Si no dijiste cuándo seguir, el bot lo pone para dentro de estos días. */
export const DEFAULT_FOLLOW_UP_DAYS = 3;

/** Lo que el bot pone como próximo paso si no dijiste cuál. */
export const DEFAULT_FOLLOW_UP = "Hacer seguimiento";

export const isOpenStage = (s: ProspectStage) => s !== "ganado" && s !== "perdido";

export interface FollowUps {
  /** Con fecha de hoy o atrasada, la más vieja primero. */
  due: Prospect[];
  /** Abiertos sin fecha de próximo paso: los que se olvidan. El de hace más tiempo primero. */
  adrift: Prospect[];
  /** Con fecha en los próximos `horizon` días. */
  upcoming: Prospect[];
}

export function followUps(prospects: Prospect[], today: string, horizon = 7): FollowUps {
  const open = prospects.filter((p) => !p.archived && isOpenStage(p.stage));
  const until = addDays(today, horizon);
  const byDate = (a: Prospect, b: Prospect) => a.next_action_at!.localeCompare(b.next_action_at!);
  return {
    due: open.filter((p) => p.next_action_at && p.next_action_at <= today).sort(byDate),
    // Sin contacto anotado ("" ordena primero), después el de hace más tiempo.
    adrift: open
      .filter((p) => !p.next_action_at)
      .sort((a, b) => (a.last_contact_at ?? "").localeCompare(b.last_contact_at ?? "")),
    upcoming: open
      .filter((p) => p.next_action_at && p.next_action_at > today && p.next_action_at <= until)
      .sort(byDate),
  };
}

/** "hablaste hace 12 días", "hablaste ayer", "sin contacto anotado". */
export function lastContactLabel(p: Pick<Prospect, "last_contact_at">, today: string): string {
  if (!p.last_contact_at) return "sin contacto anotado";
  const d = daysBetween(p.last_contact_at, today);
  if (d <= 0) return "hablaste hoy";
  if (d === 1) return "hablaste ayer";
  return `hablaste hace ${d} días`;
}

/** "La Pasiva", "la pasiva", "LaPasivá" → "lapasiva". */
export function normName(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

/**
 * El prospecto que nombraste, aunque lo hayas dicho distinto: sin tildes ni
 * mayúsculas, y "Fogón" encuentra a "Parrilla El Fogón" si es el único que
 * encaja. Con dos candidatos no adivina: mejor uno nuevo que pisar al otro.
 */
export function findProspect(name: string, prospects: Prospect[]): Prospect | null {
  const n = normName(name);
  if (!n) return null;

  const exact = prospects.filter((p) => normName(p.business_name) === n);
  if (exact.length) return exact.find((p) => isOpenStage(p.stage)) ?? exact[0];

  if (n.length < 4) return null;
  const partial = prospects.filter((p) => {
    const m = normName(p.business_name);
    return m.length >= 4 && (m.includes(n) || n.includes(m));
  });
  return partial.length === 1 ? partial[0] : null;
}
