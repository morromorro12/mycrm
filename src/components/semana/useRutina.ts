"use client";

import { useCallback, useOptimistic, useState, useTransition } from "react";
import { addColdContacts, setHabitDone } from "@/lib/actions";
import { addDays } from "@/lib/dates";
import { DAILY_TARGET } from "@/lib/metas";
import {
  dayStatus,
  weekPerfect,
  type DayItem,
  type DayPlan,
  type Rutina,
  type WeekGoal,
} from "@/lib/rutina";

type Change =
  | { kind: "check"; key: string; done: boolean }
  | { kind: "frio"; day: string; add: number };

interface Overrides {
  checks: Record<string, boolean>;
  frio: Record<string, number>;
}
const NONE: Overrides = { checks: {}, frio: {} };

/** Lo que se ve en pantalla: la semana y sus tareas "X veces por semana". */
export interface WeekState {
  week: DayPlan[];
  goals: WeekGoal[];
}

/** El festejo. `id` cambia en cada uno, para reiniciarlo. */
export interface Festejo {
  id: number;
  title: string;
  detail: string;
}

const key = (habitId: string, day: string) => `${habitId}|${day}`;

/** La misma semana, con una tarea tachada o destachada en un día. */
function withCheck(v: WeekState, habitId: string, day: string, done: boolean): WeekState {
  return {
    week: v.week.map((d) =>
      d.day === day
        ? { ...d, items: d.items.map((i) => (i.id === habitId ? { ...i, done } : i)) }
        : d,
    ),
    goals: v.goals.map((g) => {
      if (g.id !== habitId) return g;
      const days = done ? [...new Set([...g.days, day])].sort() : g.days.filter((x) => x !== day);
      return { ...g, days, done: days.length >= g.required };
    }),
  };
}

/** La misma semana, con un contactado en frío más ese día. */
function withCold(v: WeekState, day: string): WeekState {
  return {
    ...v,
    week: v.week.map((d) =>
      d.day === day
        ? {
            ...d,
            items: d.items.map((i) =>
              i.kind === "frio" ? { ...i, count: i.count + 1, done: i.count + 1 >= DAILY_TARGET } : i,
            ),
          }
        : d,
    ),
  };
}

/**
 * Tachar sin esperar a la base: lo tocado cambia al instante y se guarda en
 * orden por detrás. También sabe cuándo un toque completa el día, la semana
 * o una meta semanal, para festejarlo en el momento.
 */
export function useRutina(rt: Pick<Rutina, "today" | "streakBeforeToday" | "best">) {
  const { today } = rt;
  const [ov, apply] = useOptimistic(NONE, (o: Overrides, c: Change): Overrides =>
    c.kind === "check"
      ? { ...o, checks: { ...o.checks, [c.key]: c.done } }
      : { ...o, frio: { ...o.frio, [c.day]: (o.frio[c.day] ?? 0) + c.add } },
  );
  const [, startTransition] = useTransition();
  const [festejo, setFestejo] = useState<Festejo | null>(null);

  /** Un día con lo que tocaste encima de lo que dice la base. */
  const view = (plan: DayPlan): DayPlan => ({
    day: plan.day,
    items: plan.items.map((i) => {
      if (i.kind === "frio") {
        const count = i.count + (ov.frio[plan.day] ?? 0);
        return { ...i, count, done: count >= DAILY_TARGET };
      }
      const k = key(i.id, plan.day);
      return k in ov.checks ? { ...i, done: ov.checks[k] } : i;
    }),
  });

  /** Una meta semanal con lo que tocaste encima. */
  const viewGoal = (g: WeekGoal): WeekGoal => {
    const days = new Set(g.days);
    for (let i = 0; i < 7; i++) {
      const d = addDays(g.week, i);
      const k = key(g.id, d);
      if (k in ov.checks) {
        if (ov.checks[k]) days.add(d);
        else days.delete(d);
      }
    }
    const list = [...days].sort();
    return { ...g, days: list, done: list.length >= g.required };
  };

  /** La racha con lo de hoy: suma recién cuando hoy queda completo. */
  const streakWith = (todayPlan: DayPlan) =>
    dayStatus(todayPlan, today) === "completo" ? rt.streakBeforeToday + 1 : rt.streakBeforeToday;

  /** Qué se festeja con este cambio, de lo más grande a lo más chico. */
  function celebrate(before: WeekState, after: WeekState, goalId?: string) {
    const todayBefore = before.week.find((d) => d.day === today);
    const todayAfter = after.week.find((d) => d.day === today);
    const dayDone =
      todayBefore !== undefined &&
      todayAfter !== undefined &&
      dayStatus(todayBefore, today) !== "completo" &&
      dayStatus(todayAfter, today) === "completo";
    const streak = rt.streakBeforeToday + 1;
    const streakText = `Racha de ${streak} ${streak === 1 ? "día" : "días"}${
      streak > rt.best && streak > 1 ? " · ¡tu mejor racha!" : ""
    }`;

    let next: Omit<Festejo, "id"> | null = null;
    if (!weekPerfect(before.week, before.goals, today) && weekPerfect(after.week, after.goals, today)) {
      next = {
        title: "¡Semana perfecta!",
        detail: dayDone ? streakText : "Cumpliste todo lo de la semana.",
      };
    } else if (dayDone) {
      next = { title: "¡Día completo!", detail: streakText };
    } else if (goalId) {
      const b = before.goals.find((g) => g.id === goalId);
      const a = after.goals.find((g) => g.id === goalId);
      if (a && b && !b.done && a.done) {
        next = { title: "¡Meta de la semana cumplida!", detail: `${a.title}: ${a.required} de ${a.required}` };
      }
    }
    if (!next) return;
    setFestejo({ id: Date.now(), ...next });
    navigator.vibrate?.([60, 40, 120]);
  }

  function setDone(habitId: string, day: string, done: boolean) {
    // Si destachás, el festejo de recién ya no vale.
    if (!done) setFestejo(null);
    startTransition(async () => {
      apply({ kind: "check", key: key(habitId, day), done });
      await setHabitDone(habitId, day, done);
    });
  }

  /** Tachar o destachar una tarea de días fijos. */
  function toggle(v: WeekState, day: string, item: DayItem) {
    if (item.kind !== "check" || day > today) return;
    celebrate(v, withCheck(v, item.id, day, !item.done));
    setDone(item.id, day, !item.done);
  }

  /** Anotar (o desanotar) que hiciste una tarea semanal ese día. */
  function toggleGoal(v: WeekState, day: string, goal: WeekGoal) {
    if (day > today) return;
    const done = !goal.days.includes(day);
    celebrate(v, withCheck(v, goal.id, day, done), goal.id);
    setDone(goal.id, day, done);
  }

  /** +1 contactado en frío: sólo hoy, como el contador de Metas. */
  function addCold(v: WeekState, day: string) {
    if (day !== today) return;
    celebrate(v, withCold(v, day));
    startTransition(async () => {
      apply({ kind: "frio", day, add: 1 });
      await addColdContacts(1);
    });
  }

  const dismiss = useCallback(() => setFestejo(null), []);
  return { view, viewGoal, streakWith, toggle, toggleGoal, addCold, festejo, dismiss };
}
