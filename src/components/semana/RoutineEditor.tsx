"use client";

import { useOptimistic, useState, useTransition } from "react";
import { addHabit, moveHabit, removeHabit, updateHabit } from "@/lib/actions";
import { DAILY_TARGET } from "@/lib/metas";
import {
  EVERY_DAY,
  normTitle,
  SUGGESTIONS,
  WEEKDAYS,
  weekdaysLabel,
  WORKDAYS,
} from "@/lib/rutina";
import type { Habit, HabitKind } from "@/lib/types";
import { IconPlus } from "../icons";

type Op =
  | { t: "add"; habit: Habit }
  | { t: "update"; id: string; title: string; weekdays: number[] }
  | { t: "remove"; id: string }
  | { t: "move"; id: string; dir: -1 | 1 };

function reduce(list: Habit[], op: Op): Habit[] {
  switch (op.t) {
    case "add":
      return [...list, op.habit];
    case "update":
      return list.map((h) => (h.id === op.id ? { ...h, title: op.title, weekdays: op.weekdays } : h));
    case "remove":
      return list.filter((h) => h.id !== op.id);
    case "move": {
      const i = list.findIndex((h) => h.id === op.id);
      const j = i + op.dir;
      if (i < 0 || j < 0 || j >= list.length) return list;
      const next = [...list];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    }
  }
}

/**
 * Las tareas fijas: agregar, editar, ordenar y sacar. Todo cambia al instante
 * y se guarda por detrás. Lo que cambies rige de hoy en adelante.
 */
export function RoutineEditor({ habits }: { habits: Habit[] }) {
  const [list, apply] = useOptimistic(habits, reduce);
  const [, startTransition] = useTransition();
  const [editing, setEditing] = useState<string | null>(null);

  function run(op: Op, save: () => Promise<void>) {
    startTransition(async () => {
      apply(op);
      await save();
    });
  }

  function add(title: string, weekdays: number[], kind: HabitKind = "check") {
    const habit: Habit = {
      id: `nueva-${Date.now()}`,
      title,
      kind,
      weekdays,
      position: list.length,
      starts_on: "",
      ends_on: null,
    };
    run({ t: "add", habit }, () => addHabit({ title, weekdays, kind }));
  }

  const hasFrio = list.some((h) => h.kind === "frio");
  const ideas = SUGGESTIONS.filter(
    (s) =>
      !(s.kind === "frio" && hasFrio) && !list.some((h) => normTitle(h.title) === normTitle(s.title)),
  );

  return (
    <section className="card px-4 pb-1 pt-3">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-xs font-bold uppercase tracking-wide text-muted">Tu rutina</h2>
        {list.length > 0 && (
          <span className="text-xs font-semibold text-muted">
            {list.length} {list.length === 1 ? "tarea" : "tareas"}
          </span>
        )}
      </div>
      <p className="mt-1 text-xs text-muted">
        Lo que se repite siempre, no lo puntual. Lo que cambies rige de hoy en adelante: los días
        que ya pasaron quedan como estaban y la racha no se toca.
      </p>

      {list.length > 0 && (
        <ul className="mt-1">
          {list.map((h, i) =>
            editing === h.id ? (
              <li key={h.id} className="border-b border-line py-3 last:border-b-0">
                <HabitForm
                  initial={h}
                  submitLabel="Guardar"
                  onCancel={() => setEditing(null)}
                  onSubmit={(title, weekdays) => {
                    setEditing(null);
                    run({ t: "update", id: h.id, title, weekdays }, () =>
                      updateHabit(h.id, { title, weekdays }),
                    );
                  }}
                  extra={
                    <EditExtras
                      first={i === 0}
                      last={i === list.length - 1}
                      onMove={(dir) => run({ t: "move", id: h.id, dir }, () => moveHabit(h.id, dir))}
                      onRemove={() => {
                        setEditing(null);
                        run({ t: "remove", id: h.id }, () => removeHabit(h.id));
                      }}
                    />
                  }
                />
              </li>
            ) : (
              <li key={h.id} className="border-b border-line last:border-b-0">
                <button
                  type="button"
                  onClick={() => setEditing(h.id)}
                  className="flex w-full items-center justify-between gap-3 py-3 text-left"
                >
                  <span className="min-w-0">
                    <span className="block font-semibold">{h.title}</span>
                    {h.kind === "frio" && (
                      <span className="block text-xs text-muted">
                        Se tacha sola al llegar a {DAILY_TARGET} contactados en Metas
                      </span>
                    )}
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="chip bg-bg text-muted">{weekdaysLabel(h.weekdays)}</span>
                    <span className="text-muted" aria-hidden>
                      ›
                    </span>
                  </span>
                </button>
              </li>
            ),
          )}
        </ul>
      )}

      <div className="border-t border-line py-3">
        {editing === "nueva" ? (
          <HabitForm
            submitLabel="Agregar"
            onCancel={() => setEditing(null)}
            onSubmit={(title, weekdays) => {
              setEditing(null);
              add(title, weekdays);
            }}
          />
        ) : (
          <button type="button" onClick={() => setEditing("nueva")} className="btn w-full">
            <IconPlus className="h-4 w-4" />
            Agregar tarea
          </button>
        )}
      </div>

      {ideas.length > 0 && (
        <div className="border-t border-line py-3">
          <p className="mb-2 text-xs font-semibold text-muted">
            {list.length === 0 ? "Ideas para arrancar · un toque y se agrega" : "Ideas · un toque y se agrega"}
          </p>
          <div className="flex flex-wrap gap-2">
            {ideas.map((s) => (
              <button
                key={s.title}
                type="button"
                onClick={() => add(s.title, s.weekdays, s.kind)}
                className="btn !min-h-0 !justify-start !py-2 text-left text-sm"
              >
                <IconPlus className="h-4 w-4 shrink-0 text-brand" />
                <span>
                  {s.title} <span className="text-xs font-semibold text-muted">· {weekdaysLabel(s.weekdays)}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function HabitForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
  extra,
}: {
  initial?: Habit;
  submitLabel: string;
  onSubmit: (title: string, weekdays: number[]) => void;
  onCancel: () => void;
  extra?: React.ReactNode;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [days, setDays] = useState<number[]>(initial?.weekdays ?? WORKDAYS);
  const valid = title.trim().length > 0 && days.length > 0;

  const toggle = (n: number) =>
    setDays((d) => (d.includes(n) ? d.filter((x) => x !== n) : [...d, n].sort((a, b) => a - b)));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) onSubmit(title.trim(), days);
      }}
      className="grid gap-3"
    >
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={80}
        autoFocus={!initial}
        required
        placeholder="Ej: Revisar las campañas de Ads"
        aria-label="Qué tenés que hacer"
        className="field"
      />
      <div>
        <div className="flex items-baseline justify-between gap-2">
          <span className="label">Qué días</span>
          <span className="flex gap-3 text-xs font-semibold">
            <button type="button" onClick={() => setDays(WORKDAYS)} className="text-brand">
              Lu a Vi
            </button>
            <button type="button" onClick={() => setDays(EVERY_DAY)} className="text-brand">
              Todos
            </button>
          </span>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {WEEKDAYS.map((w) => {
            const on = days.includes(w.n);
            return (
              <button
                key={w.n}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(w.n)}
                className={`rounded-lg border py-2 text-sm font-bold ${
                  on ? "border-brand bg-brand text-white" : "border-line text-muted"
                }`}
              >
                {w.short}
              </button>
            );
          })}
        </div>
        {days.length === 0 && (
          <p className="mt-1 text-xs font-semibold text-bad">Elegí al menos un día.</p>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" disabled={!valid} className="btn btn-primary">
          {submitLabel}
        </button>
        <button type="button" onClick={onCancel} className="btn">
          Cancelar
        </button>
        {extra}
      </div>
    </form>
  );
}

function EditExtras({
  first,
  last,
  onMove,
  onRemove,
}: {
  first: boolean;
  last: boolean;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
}) {
  const [confirm, setConfirm] = useState(false);
  return (
    <>
      <span className="ml-auto flex gap-1">
        <button
          type="button"
          onClick={() => onMove(-1)}
          disabled={first}
          aria-label="Subir"
          className="btn !px-3"
        >
          ↑
        </button>
        <button
          type="button"
          onClick={() => onMove(1)}
          disabled={last}
          aria-label="Bajar"
          className="btn !px-3"
        >
          ↓
        </button>
      </span>
      <button
        type="button"
        onClick={() => (confirm ? onRemove() : setConfirm(true))}
        className={`w-full text-left text-sm font-semibold ${confirm ? "text-bad" : "text-muted"}`}
      >
        {confirm ? "¿Seguro? Tocá de nuevo para sacarla" : "Sacar de la rutina"}
      </button>
    </>
  );
}
