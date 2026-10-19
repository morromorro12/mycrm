"use client";

import Link from "next/link";
import { dayStatus, type Rutina } from "@/lib/rutina";
import { IconFlame } from "../icons";
import { Bar } from "../metas/parts";
import { Checklist, doneOf, StreakToast, WeekDots } from "./parts";
import { useRutina } from "./useRutina";

/** La tarjeta de Hoy: lo que toca hoy, para tachar sin salir del inicio. */
export function TodayRoutine({ rt }: { rt: Rutina }) {
  const { today } = rt;
  const r = useRutina(rt);
  const week = rt.week.map(r.view);
  const plan = r.view(rt.todayPlan);
  const streak = r.streakWith(plan);
  const status = dayStatus(plan, today);
  const done = doneOf(plan);
  const total = plan.items.length;

  if (rt.habits.length === 0) {
    return (
      <Link href="/semana" className="card mb-3 block p-4 hover:border-muted">
        <h2 className="text-xs font-bold uppercase tracking-wide text-muted">Rutina de hoy</h2>
        <p className="mt-1 font-semibold">
          Armá tu rutina: lo que se repite cada día, para ir tachándolo y sumar racha.
        </p>
        <p className="mt-2 text-sm font-semibold text-brand">Armar mi rutina →</p>
      </Link>
    );
  }

  return (
    <section className="card mb-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xs font-bold uppercase tracking-wide text-muted">Rutina de hoy</h2>
        <Link
          href="/semana"
          className={`flex items-center gap-1 text-xs font-bold ${streak > 0 ? "text-warn" : "text-muted"}`}
        >
          <IconFlame filled={streak > 0} className="h-3.5 w-3.5" />
          {streak} {streak === 1 ? "día" : "días"} de racha
        </Link>
      </div>

      {total > 0 ? (
        <>
          <div className="mt-1 flex items-center justify-between gap-2">
            <p className="text-2xl font-extrabold tabular-nums">
              {done}
              <span className="text-base font-bold text-muted"> / {total} tachadas</span>
            </p>
            <WeekDots week={week} today={today} />
          </div>
          <div className="mb-3 mt-2">
            <Bar
              pct={(done / total) * 100}
              tone={status === "completo" ? "ok" : "brand"}
              label="Rutina de hoy"
            />
          </div>
          <Checklist
            plan={plan}
            today={today}
            onToggle={(item) => r.toggle(plan, item, week)}
            onAddCold={() => r.addCold(plan, week)}
          />
        </>
      ) : (
        <div className="mt-1 flex items-center justify-between gap-2">
          <p className="font-semibold">Hoy no tenés tareas fijas: día libre.</p>
          <WeekDots week={week} today={today} />
        </div>
      )}

      <Link href="/semana" className="mt-3 block text-sm font-semibold text-brand">
        Ver la semana →
      </Link>
      <StreakToast festejo={r.festejo} onClose={r.dismiss} />
    </section>
  );
}
