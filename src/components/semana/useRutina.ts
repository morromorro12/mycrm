"use client";

import { useCallback, useOptimistic, useState, useTransition } from "react";
import { addColdContacts, setHabitDone } from "@/lib/actions";
import { DAILY_TARGET } from "@/lib/metas";
import { dayStatus, type DayItem, type DayPlan, type Rutina } from "@/lib/rutina";

type Change =
  | { kind: "check"; key: string; done: boolean }
  | { kind: "frio"; day: string; add: number };

interface Overrides {
  checks: Record<string, boolean>;
  frio: Record<string, number>;
}
const NONE: Overrides = { checks: {}, frio: {} };

/** El festejo de completar el día. `id` cambia en cada uno, para reiniciarlo. */
export interface Festejo {
  id: number;
  streak: number;
  record: boolean;
  perfectWeek: boolean;
}

/**
 * Tachar sin esperar a la base: lo tocado cambia al instante y se guarda en
 * orden por detrás. También sabe cuándo un toque completa el día, para
 * festejarlo y sumar la racha en el momento.
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
      const key = `${i.id}|${plan.day}`;
      return key in ov.checks ? { ...i, done: ov.checks[key] } : i;
    }),
  });

  /** La racha con lo de hoy: suma recién cuando hoy queda completo. */
  const streakWith = (todayPlan: DayPlan) =>
    dayStatus(todayPlan, today) === "completo" ? rt.streakBeforeToday + 1 : rt.streakBeforeToday;

  /** Si con este cambio hoy queda completo, se festeja. */
  function celebrate(before: DayPlan, after: DayPlan, week?: DayPlan[]) {
    if (after.day !== today) return;
    if (dayStatus(before, today) === "completo" || dayStatus(after, today) !== "completo") return;
    const streak = rt.streakBeforeToday + 1;
    // Semana perfecta: no queda ningún día de esta semana con algo sin tachar.
    const perfectWeek =
      week?.some((d) => d.day === today) === true &&
      week.every((d) => {
        const s = dayStatus(d.day === today ? after : d, today);
        return s === "completo" || s === "libre";
      });
    setFestejo({ id: Date.now(), streak, record: streak > rt.best, perfectWeek });
    navigator.vibrate?.([60, 40, 120]);
  }

  function toggle(plan: DayPlan, item: DayItem, week?: DayPlan[]) {
    if (item.kind !== "check" || plan.day > today) return;
    const done = !item.done;
    celebrate(
      plan,
      { ...plan, items: plan.items.map((i) => (i.id === item.id ? { ...i, done } : i)) },
      week,
    );
    startTransition(async () => {
      apply({ kind: "check", key: `${item.id}|${plan.day}`, done });
      await setHabitDone(item.id, plan.day, done);
    });
  }

  /** +1 contactado en frío: sólo hoy, como el contador de Metas. */
  function addCold(plan: DayPlan, week?: DayPlan[]) {
    if (plan.day !== today) return;
    celebrate(
      plan,
      {
        ...plan,
        items: plan.items.map((i) =>
          i.kind === "frio" ? { ...i, count: i.count + 1, done: i.count + 1 >= DAILY_TARGET } : i,
        ),
      },
      week,
    );
    startTransition(async () => {
      apply({ kind: "frio", day: plan.day, add: 1 });
      await addColdContacts(1);
    });
  }

  const dismiss = useCallback(() => setFestejo(null), []);
  return { view, streakWith, toggle, addCold, festejo, dismiss };
}
