"use client";

import Link, { useLinkStatus } from "next/link";
import { useState } from "react";
import { addDays, weekdayDate, weekRangeLabel } from "@/lib/dates";
import { dayStatus, WEEKDAYS, type DayPlan, type Rutina } from "@/lib/rutina";
import { IconFlame } from "../icons";
import { Bar } from "../metas/parts";
import { Checklist, DayRing, doneOf, STATUS_TEXT, StreakToast, WeekGoals } from "./parts";
import { useRutina } from "./useRutina";

/**
 * La semana de lunes a domingo: un círculo por día que se va cerrando a
 * medida que tachás, y abajo las tareas del día elegido. Arriba, la racha.
 */
export function WeekView({
  rt,
  monday,
  thisMonday,
  prevHref,
  nextHref,
}: {
  rt: Rutina;
  monday: string;
  thisMonday: string;
  prevHref: string;
  nextHref: string;
}) {
  const { today } = rt;
  const r = useRutina(rt);
  const week = rt.week.map(r.view);
  const goals = rt.goals.map(r.viewGoal);
  const v = { week, goals };
  const todayPlan = r.view(rt.todayPlan);
  const streak = r.streakWith(todayPlan);
  const best = Math.max(rt.best, streak);

  const [selected, setSelected] = useState(() =>
    week.some((d) => d.day === today) ? today : monday,
  );
  const plan = week.find((d) => d.day === selected) ?? week[0];
  const status = dayStatus(plan, today);
  const done = doneOf(plan);
  const total = plan.items.length;

  // Cada vez que pide una semanal cuenta como una tarea más de la semana.
  const weekTotal =
    week.reduce((n, d) => n + d.items.length, 0) + goals.reduce((n, g) => n + g.required, 0);
  const weekDone =
    week.reduce((n, d) => n + doneOf(d), 0) +
    goals.reduce((n, g) => n + Math.min(g.days.length, g.required), 0);

  const hasHabits = rt.habits.length > 0;
  const todayStatus = dayStatus(todayPlan, today);
  const left = todayPlan.items.length - doneOf(todayPlan);

  const weekName =
    monday === thisMonday
      ? "Esta semana"
      : monday === addDays(thisMonday, -7)
        ? "La semana pasada"
        : monday === addDays(thisMonday, 7)
          ? "La semana que viene"
          : weekRangeLabel(monday);

  return (
    <>
      {/* La racha primero: es lo que dan ganas de no cortar. */}
      <section className="card mb-3 p-4">
        <div className="flex items-center gap-3">
          <span
            className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full ${
              streak > 0 ? "bg-warn-bg text-warn" : "bg-bg text-muted"
            }`}
          >
            <IconFlame filled={streak > 0} className="h-8 w-8" />
          </span>
          <div className="min-w-0">
            <p className="text-3xl font-extrabold tabular-nums leading-none">
              {streak}
              <span className="text-base font-bold text-muted">
                {" "}
                {streak === 1 ? "día" : "días"} de racha
              </span>
            </p>
            <p className="mt-1 text-sm font-semibold text-muted">
              {!hasHabits
                ? "Armá tu rutina abajo para arrancar."
                : todayStatus === "completo"
                  ? "Hoy está todo tachado. Mañana seguís sumando."
                  : todayStatus === "libre"
                    ? "Hoy es día libre: la racha no se corta."
                    : `Te ${left === 1 ? "falta 1" : `faltan ${left}`} hoy para ${
                        streak > 0 ? `llegar a ${streak + 1}` : "arrancar la racha"
                      }.`}
            </p>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 border-t border-line pt-3 text-center">
          <Stat label="Mejor racha" value={best} />
          <Stat label="Semanas perfectas" value={rt.perfectWeeks} />
          <Stat label={monday === thisMonday ? "Esta semana" : "Esa semana"} value={`${weekDone}/${weekTotal}`} />
        </div>
      </section>

      <section className="card mb-3 p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <Link href={prevHref} aria-label="Semana anterior" className="btn !min-h-[2.2rem] !px-3">
            <Arrow>‹</Arrow>
          </Link>
          <div className="min-w-0 text-center">
            <p className="text-sm font-bold">{weekName}</p>
            {monday !== thisMonday && (
              <Link href="/semana" className="text-xs font-semibold text-brand hover:underline">
                Volver a esta semana
              </Link>
            )}
          </div>
          <Link href={nextHref} aria-label="Semana siguiente" className="btn !min-h-[2.2rem] !px-3">
            <Arrow>›</Arrow>
          </Link>
        </div>

        <div className="grid grid-cols-7 gap-0.5">
          {week.map((d, i) => (
            <DayButton
              key={d.day}
              plan={d}
              today={today}
              label={d.day === today ? "Hoy" : WEEKDAYS[i].short}
              selected={d.day === plan.day}
              onSelect={() => setSelected(d.day)}
            />
          ))}
        </div>

        <div className="mt-3 border-t border-line px-1 pt-3">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="font-bold first-letter:uppercase">{dayTitle(plan.day, today)}</h2>
            {total > 0 && (
              <span className="text-sm font-semibold text-muted tabular-nums">
                {done} de {total}
              </span>
            )}
          </div>

          {total > 0 ? (
            <>
              <div className="mb-3 mt-1.5">
                <Bar
                  pct={(done / total) * 100}
                  tone={status === "completo" ? "ok" : "brand"}
                  label="Tareas del día"
                  thick
                />
              </div>
              <Checklist
                plan={plan}
                today={today}
                onToggle={(item) => r.toggle(v, plan.day, item)}
                onAddCold={() => r.addCold(v, plan.day)}
              />
              <DayNote plan={plan} today={today} />
            </>
          ) : (
            <p className="mt-1 pb-1 text-sm text-muted">
              {hasHabits
                ? "Día libre: no hay tareas fijas. La racha no se corta."
                : "Todavía no armaste tu rutina. Agregá abajo las tareas que se repiten cada semana."}
            </p>
          )}
          <WeekGoals
            goals={goals}
            day={plan.day}
            today={today}
            onToggle={(g) => r.toggleGoal(v, plan.day, g)}
          />
        </div>
      </section>

      <StreakToast festejo={r.festejo} onClose={r.dismiss} />
    </>
  );
}

function DayButton({
  plan,
  today,
  label,
  selected,
  onSelect,
}: {
  plan: DayPlan;
  today: string;
  label: string;
  selected: boolean;
  onSelect: () => void;
}) {
  const total = plan.items.length;
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      aria-label={`${weekdayDate(plan.day)}: ${STATUS_TEXT[dayStatus(plan, today)]}`}
      className={`flex flex-col items-center gap-1 rounded-xl py-2 transition-colors ${
        selected ? "bg-bg ring-1 ring-line" : "hover:bg-bg"
      }`}
    >
      <span className={`text-[0.7rem] font-bold ${plan.day === today ? "text-brand" : "text-muted"}`}>
        {label}
      </span>
      <DayRing plan={plan} today={today} />
      <span className="text-[0.68rem] font-semibold tabular-nums text-muted">
        {total > 0 ? `${doneOf(plan)}/${total}` : "–"}
      </span>
    </button>
  );
}

/** La flecha late mientras carga la otra semana, para que se note que tocaste. */
function Arrow({ children }: { children: React.ReactNode }) {
  const { pending } = useLinkStatus();
  return <span className={pending ? "animate-pulse opacity-40" : ""}>{children}</span>;
}

/** 'Hoy · lunes 19', 'Ayer · domingo 18', 'jueves 22'. */
function dayTitle(day: string, today: string): string {
  const name = weekdayDate(day);
  if (day === today) return `Hoy · ${name}`;
  if (day === addDays(today, -1)) return `Ayer · ${name}`;
  if (day === addDays(today, 1)) return `Mañana · ${name}`;
  return name;
}

function DayNote({ plan, today }: { plan: DayPlan; today: string }) {
  const status = dayStatus(plan, today);
  const text =
    status === "futuro"
      ? "Todavía no llegó: se tacha ese día."
      : status === "incompleto"
        ? "Quedó algo sin tachar. Si lo hiciste y te olvidaste de marcarlo, tachalo ahora."
        : status === "completo" && plan.day === today
          ? "¡Todo tachado! Este día ya suma a la racha."
          : null;
  if (!text) return null;
  return (
    <p className={`mt-2.5 text-xs font-semibold ${status === "completo" ? "text-ok" : "text-muted"}`}>
      {text}
    </p>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <p className="text-lg font-extrabold tabular-nums">{value}</p>
      <p className="text-[0.7rem] font-semibold leading-tight text-muted">{label}</p>
    </div>
  );
}
