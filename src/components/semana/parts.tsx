"use client";

import Link from "next/link";
import { useEffect } from "react";
import { dayOfMonth } from "@/lib/dates";
import { DAILY_TARGET } from "@/lib/metas";
import { dayStatus, type DayItem, type DayPlan, type DayStatus } from "@/lib/rutina";
import { IconCheck, IconFlame } from "../icons";
import type { Festejo } from "./useRutina";

export const doneOf = (plan: DayPlan) => plan.items.filter((i) => i.done).length;

/**
 * Las tareas de un día, para ir tachando. Las de contactados en frío no se
 * tachan a mano: se completan solas al llegar a la meta, y hoy tienen un +1.
 */
export function Checklist({
  plan,
  today,
  onToggle,
  onAddCold,
}: {
  plan: DayPlan;
  today: string;
  onToggle: (item: DayItem) => void;
  onAddCold: () => void;
}) {
  const future = plan.day > today;
  return (
    <ul className="grid gap-2">
      {plan.items.map((item) =>
        item.kind === "frio" ? (
          <li
            key={item.id}
            className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${
              item.done ? "border-ok/30 bg-ok-bg" : "border-line"
            }`}
          >
            <Tick done={item.done} />
            <Link href="/metas" className="min-w-0 flex-1">
              <span className={`block font-semibold ${item.done ? "text-muted line-through" : ""}`}>
                {item.title}
              </span>
              <span className="block text-xs font-semibold text-muted tabular-nums">
                {future
                  ? `Se tacha sola al llegar a ${DAILY_TARGET}`
                  : `${item.count} de ${DAILY_TARGET} · se tacha sola`}
              </span>
            </Link>
            {plan.day === today && (
              <button
                type="button"
                onClick={onAddCold}
                aria-label="Sumar un contactado en frío"
                className="btn btn-primary !min-h-[2.4rem] shrink-0 !px-3"
              >
                +1
              </button>
            )}
          </li>
        ) : (
          <li key={item.id}>
            <button
              type="button"
              role="checkbox"
              aria-checked={item.done}
              disabled={future}
              onClick={() => onToggle(item)}
              className={`flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition-colors disabled:cursor-default ${
                item.done ? "border-ok/30 bg-ok-bg" : "border-line hover:border-muted disabled:hover:border-line"
              }`}
            >
              <Tick done={item.done} muted={future} />
              <span
                className={`min-w-0 flex-1 font-semibold ${
                  item.done ? "text-muted line-through" : future ? "text-muted" : ""
                }`}
              >
                {item.title}
              </span>
            </button>
          </li>
        ),
      )}
    </ul>
  );
}

function Tick({ done, muted = false }: { done: boolean; muted?: boolean }) {
  return (
    <span
      aria-hidden
      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
        done ? "border-ok bg-ok text-white" : muted ? "border-dashed border-line" : "border-muted/50"
      }`}
    >
      {done && <IconCheck className="h-4 w-4" />}
    </span>
  );
}

const R = 17;
const C = 2 * Math.PI * R;

/** El círculo de un día: se va cerrando a medida que tachás. Verde lleno = completo. */
export function DayRing({ plan, today }: { plan: DayPlan; today: string }) {
  const status = dayStatus(plan, today);
  const total = plan.items.length;
  const pct = total > 0 ? doneOf(plan) / total : 0;
  const arc = { "en-curso": "text-brand", incompleto: "text-bad", futuro: "text-muted" }[
    status as "en-curso" | "incompleto" | "futuro"
  ];
  const number = {
    completo: "text-white",
    "en-curso": "text-ink",
    incompleto: "text-bad",
    futuro: "text-muted",
    libre: "text-muted/60",
  }[status];

  return (
    <span
      className={`relative flex h-10 w-10 items-center justify-center rounded-full ${
        status === "incompleto" ? "bg-bad-bg" : ""
      } ${status === "completo" ? "bg-ok" : ""}`}
    >
      {status !== "completo" && (
        <svg viewBox="0 0 40 40" className="absolute inset-0 -rotate-90" aria-hidden>
          <circle
            cx="20"
            cy="20"
            r={R}
            fill="none"
            stroke="var(--color-line)"
            strokeWidth="3.5"
            strokeDasharray={status === "libre" ? "2 4.2" : undefined}
          />
          {pct > 0 && arc && (
            <circle
              cx="20"
              cy="20"
              r={R}
              fill="none"
              stroke="currentColor"
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeDasharray={`${pct * C} ${C}`}
              className={`${arc} transition-[stroke-dasharray] duration-300`}
            />
          )}
        </svg>
      )}
      <span className={`relative text-sm font-extrabold tabular-nums ${number}`}>
        {dayOfMonth(plan.day)}
      </span>
    </span>
  );
}

export const STATUS_TEXT: Record<DayStatus, string> = {
  libre: "día libre",
  completo: "completo",
  "en-curso": "en curso",
  incompleto: "quedó incompleto",
  futuro: "todavía no llegó",
};

/** La semana en una línea de puntos, para la tarjeta de Hoy. */
export function WeekDots({ week, today }: { week: DayPlan[]; today: string }) {
  return (
    <ol className="flex gap-1.5" aria-label="Esta semana">
      {week.map((d) => {
        const s = dayStatus(d, today);
        const style = {
          completo: "bg-ok border-ok",
          "en-curso": "border-brand border-2",
          incompleto: "bg-bad-bg border-bad",
          futuro: "border-line",
          libre: "border-dashed border-line",
        }[s];
        return (
          <li
            key={d.day}
            title={STATUS_TEXT[s]}
            className={`h-2.5 w-2.5 rounded-full border ${style}`}
          />
        );
      })}
    </ol>
  );
}

/** El festejo al completar el día. Se va solo a los pocos segundos. */
export function StreakToast({ festejo, onClose }: { festejo: Festejo | null; onClose: () => void }) {
  useEffect(() => {
    if (!festejo) return;
    const t = setTimeout(onClose, 6000);
    return () => clearTimeout(t);
  }, [festejo, onClose]);

  if (!festejo) return null;
  const { streak, record, perfectWeek } = festejo;
  return (
    <div
      role="status"
      className="fixed inset-x-3 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-50 md:inset-x-auto md:bottom-6 md:right-6 md:w-96"
    >
      <button
        key={festejo.id}
        type="button"
        onClick={onClose}
        className="pop flex w-full items-center gap-3 rounded-2xl border border-warn/40 bg-warn-bg p-4 text-left shadow-lg"
      >
        <IconFlame filled className="h-10 w-10 shrink-0 text-warn" />
        <span className="min-w-0">
          <span className="block text-lg font-extrabold text-warn">
            {perfectWeek ? "¡Semana perfecta!" : "¡Día completo!"}
          </span>
          <span className="block text-sm font-semibold">
            Racha de {streak} {streak === 1 ? "día" : "días"}
            {record && streak > 1 ? " · ¡tu mejor racha!" : ""}
          </span>
        </span>
      </button>
    </div>
  );
}
