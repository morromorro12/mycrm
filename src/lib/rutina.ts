import { addDays, daysBetween, isoWeekday, todayISO, weekStart } from "./dates";
import { DAILY_TARGET } from "./metas";
import type { ColdContactDay, Habit, HabitCheck, HabitKind } from "./types";

// ============================================================================
// Rutina semanal: las tareas fijas de cada día (las que se repiten siempre,
// no las puntuales), cuáles tachaste y la racha de días con todo tachado.
//
// Reglas de la racha:
//   · Suma un día cada vez que tachás TODO lo de ese día.
//   · Un día sin tareas (p. ej. el domingo, si no le pusiste nada) no suma
//     ni la corta.
//   · Hoy no la corta mientras no termine: tenés hasta la medianoche.
//   · Cambiar la rutina no reescribe el pasado (ver Habit.ends_on), así que
//     sumar una tarea o cambiarle los días nunca te rompe una racha.
//
// Las tareas "X veces por semana" (salir a correr 3 veces) no tienen día:
// se tacha el día que las hacés. No tocan la racha diaria, porque ningún día
// en particular tocaba hacerlas, pero una semana es perfecta sólo si además
// de todos los días cumpliste las veces de cada una.
// ============================================================================

export const WEEKDAYS = [
  { n: 1, short: "Lu" },
  { n: 2, short: "Ma" },
  { n: 3, short: "Mi" },
  { n: 4, short: "Ju" },
  { n: 5, short: "Vi" },
  { n: 6, short: "Sá" },
  { n: 7, short: "Do" },
];
export const WORKDAYS = [1, 2, 3, 4, 5];
export const EVERY_DAY = [1, 2, 3, 4, 5, 6, 7];

/** 'Todos los días', 'Lu a Vi', 'Lu · Mi · Vi', 'Lu a Mi · Sá'. */
export function weekdaysLabel(days: number[]): string {
  const sorted = [...new Set(days)].sort((a, b) => a - b);
  if (sorted.join() === EVERY_DAY.join()) return "Todos los días";
  if (sorted.join() === "6,7") return "Fines de semana";

  // Tres o más días seguidos van como tramo: 'Lu a Vi'.
  const short = (n: number) => WEEKDAYS[n - 1].short;
  const parts: string[] = [];
  for (let i = 0; i < sorted.length; ) {
    let j = i;
    while (j + 1 < sorted.length && sorted[j + 1] === sorted[j] + 1) j++;
    if (j - i >= 2) parts.push(`${short(sorted[i])} a ${short(sorted[j])}`);
    else for (let k = i; k <= j; k++) parts.push(short(sorted[k]));
    i = j + 1;
  }
  return parts.join(" · ");
}

/** '3 veces por semana' o los días: 'Lu a Vi'. */
export function scheduleLabel(h: { weekdays: number[]; per_week: number | null }): string {
  if (h.per_week == null) return weekdaysLabel(h.weekdays);
  return `${h.per_week} ${h.per_week === 1 ? "vez" : "veces"} por semana`;
}

const activeOn = (h: Habit, day: string) =>
  h.starts_on <= day && (h.ends_on === null || day < h.ends_on);

/** Si una tarea de días fijos toca ese día: estaba vigente y es uno de sus días. */
export function appliesOn(h: Habit, day: string): boolean {
  return h.per_week == null && activeOn(h, day) && h.weekdays.includes(isoWeekday(day));
}

export interface DayItem {
  id: string;
  title: string;
  kind: HabitKind;
  done: boolean;
  /** Sólo en las de contactados en frío: cuántos van ese día. */
  count: number;
}

export interface DayPlan {
  day: string;
  items: DayItem[];
}

/**
 * libre      = ese día no tiene tareas
 * completo   = todo tachado
 * en-curso   = hoy, con algo pendiente
 * incompleto = un día que ya pasó y quedó algo sin tachar
 * futuro     = todavía no llegó
 */
export type DayStatus = "libre" | "completo" | "en-curso" | "incompleto" | "futuro";

export function dayStatus(plan: DayPlan, today: string): DayStatus {
  if (plan.items.length === 0) return "libre";
  if (plan.day > today) return "futuro";
  if (plan.items.every((i) => i.done)) return "completo";
  return plan.day === today ? "en-curso" : "incompleto";
}

/** Una tarea "X veces por semana", en una semana dada. */
export interface WeekGoal {
  id: string;
  title: string;
  /** El lunes de la semana. */
  week: string;
  perWeek: number;
  /**
   * Cuántas veces se piden esa semana: perWeek, o menos si la tarea arrancó a
   * mitad de semana y no quedaban tantos días.
   */
  required: number;
  /** Los días que la hiciste, en orden. */
  days: string[];
  done: boolean;
}

/** Que no quede nada pendiente en la semana: todos los días y todas las veces. */
export function weekPerfect(week: DayPlan[], goals: WeekGoal[], today: string): boolean {
  const statuses = week.map((d) => dayStatus(d, today));
  const hasTasks = goals.length > 0 || statuses.some((s) => s !== "libre");
  return (
    hasTasks &&
    goals.every((g) => g.done) &&
    statuses.every((s) => s === "completo" || s === "libre")
  );
}

/** Lo que se cuenta de la rutina para Metas. */
export interface RutinaStats {
  best: number;
  perfectWeeks: number;
}

export interface Rutina extends RutinaStats {
  today: string;
  /** Lunes a domingo de la semana pedida. */
  week: DayPlan[];
  /** Las tareas "X veces por semana" de esa misma semana. */
  goals: WeekGoal[];
  todayPlan: DayPlan;
  streak: number;
  /** La racha sin contar hoy: lo de hoy suma recién cuando lo completás. */
  streakBeforeToday: number;
  /** Las tareas vigentes, en orden: las que se editan. */
  habits: Habit[];
}

const checkKey = (habitId: string, day: string) => `${habitId}|${day}`;

const byPosition = (a: Habit, b: Habit) =>
  a.position - b.position || a.starts_on.localeCompare(b.starts_on);

export function rutina(
  habits: Habit[],
  checks: HabitCheck[],
  cold: ColdContactDay[],
  { today = todayISO(), weekOf = today }: { today?: string; weekOf?: string } = {},
): Rutina {
  const checked = new Set(checks.map((c) => checkKey(c.habit_id, c.done_on)));
  const daysByHabit = new Map<string, string[]>();
  for (const c of checks) {
    const list = daysByHabit.get(c.habit_id);
    if (list) list.push(c.done_on);
    else daysByHabit.set(c.habit_id, [c.done_on]);
  }
  const counts = new Map(cold.map((c) => [c.contacted_on, c.contacts]));
  const ordered = [...habits].sort(byPosition);

  const plan = (day: string): DayPlan => ({
    day,
    items: ordered
      .filter((h) => appliesOn(h, day))
      .map((h) => {
        const count = h.kind === "frio" ? (counts.get(day) ?? 0) : 0;
        return {
          id: h.id,
          title: h.title,
          kind: h.kind,
          count,
          done: h.kind === "frio" ? count >= DAILY_TARGET : checked.has(checkKey(h.id, day)),
        };
      }),
  });

  // Cuenta la versión vigente el domingo: si le cambiaste las veces a mitad
  // de semana, esa semana ya va con las nuevas.
  const goalsOf = (monday: string): WeekGoal[] => {
    const sunday = addDays(monday, 6);
    return ordered
      .filter((h) => h.per_week != null && activeOn(h, sunday))
      .map((h) => {
        const perWeek = h.per_week ?? 1;
        const from = h.starts_on > monday ? h.starts_on : monday;
        const required = Math.min(perWeek, daysBetween(from, sunday) + 1);
        const days = (daysByHabit.get(h.id) ?? []).filter((d) => d >= monday && d <= sunday).sort();
        return {
          id: h.id,
          title: h.title,
          week: monday,
          perWeek,
          required,
          days,
          done: days.length >= required,
        };
      });
  };

  // Se recorre día por día desde la semana de la primera tarea hasta el
  // domingo de esta semana: la racha llega hasta hoy, y las semanas
  // perfectas necesitan la semana entera.
  let run = 0;
  let best = 0;
  let before = 0;
  let perfectWeeks = 0;
  const first = habits.reduce<string | null>(
    (min, h) => (min === null || h.starts_on < min ? h.starts_on : min),
    null,
  );
  if (first !== null) {
    const lastDay = addDays(weekStart(today), 6);
    let weekHasTasks = false;
    let weekPerfect = true;
    for (let day = weekStart(first); day <= lastDay; day = addDays(day, 1)) {
      const status = dayStatus(plan(day), today);
      if (day < today) {
        if (status === "completo") run++;
        else if (status === "incompleto") run = 0;
        before = run;
      } else if (day === today && status === "completo") {
        run++;
      }
      if (day <= today) best = Math.max(best, run);

      if (status !== "libre") {
        weekHasTasks = true;
        if (status !== "completo") weekPerfect = false;
      }
      if (isoWeekday(day) === 7) {
        const goals = goalsOf(weekStart(day));
        if (goals.length > 0) weekHasTasks = true;
        if (!goals.every((g) => g.done)) weekPerfect = false;
        if (weekHasTasks && weekPerfect) perfectWeeks++;
        weekHasTasks = false;
        weekPerfect = true;
      }
    }
  }

  const monday = weekStart(weekOf);
  return {
    today,
    week: Array.from({ length: 7 }, (_, i) => plan(addDays(monday, i))),
    goals: goalsOf(monday),
    todayPlan: plan(today),
    streak: run,
    streakBeforeToday: before,
    best,
    perfectWeeks,
    habits: ordered.filter((h) => h.ends_on === null),
  };
}

/** Ideas para arrancar, pensadas para tu laburo. Se agregan con un toque. */
export const SUGGESTIONS: {
  title: string;
  kind: HabitKind;
  weekdays: number[];
  per_week: number | null;
}[] = [
  { title: `Contactar ${DAILY_TARGET} negocios en frío`, kind: "frio", weekdays: WORKDAYS, per_week: null },
  { title: "Responder mensajes de clientes", kind: "check", weekdays: WORKDAYS, per_week: null },
  { title: "Revisar las campañas de Ads", kind: "check", weekdays: WORKDAYS, per_week: null },
  { title: "Seguimiento del pipeline", kind: "check", weekdays: [1, 3, 5], per_week: null },
  { title: "Armar un creativo nuevo para testear", kind: "check", weekdays: [2, 4], per_week: null },
  { title: "Revisar cobros pendientes", kind: "check", weekdays: [1], per_week: null },
  { title: "Mandar reporte a clientes de Ads", kind: "check", weekdays: [5], per_week: null },
  { title: "Planificar la semana", kind: "check", weekdays: [7], per_week: null },
  { title: "Salir a correr", kind: "check", weekdays: EVERY_DAY, per_week: 3 },
  { title: "Publicar en mis redes", kind: "check", weekdays: EVERY_DAY, per_week: 2 },
];

/** Para no sugerir lo que ya tenés: sin mayúsculas, tildes ni espacios de más. */
export const normTitle = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();
