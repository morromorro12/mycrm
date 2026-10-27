"use client";

import { useOptimistic, useRef, useTransition } from "react";
import { addTodo, deleteTodo, setTodoDone } from "@/lib/actions";
import { relativeDay, TZ } from "@/lib/dates";
import type { Todo } from "@/lib/types";
import { IconPlus } from "../icons";
import { Tick } from "../semana/parts";
import { Empty } from "../ui";

type Op =
  | { t: "add"; todos: Todo[] }
  | { t: "done"; id: string; done: boolean }
  | { t: "remove"; id: string };

function reduce(list: Todo[], op: Op): Todo[] {
  switch (op.t) {
    case "add":
      return [...op.todos, ...list];
    case "done":
      return list.map((x) =>
        x.id === op.id ? { ...x, done_at: op.done ? new Date().toISOString() : null } : x,
      );
    case "remove":
      return list.filter((x) => x.id !== op.id);
  }
}

/** El día de un timestamp, en hora uruguaya, como 'YYYY-MM-DD'. */
const dayOf = (ts: string) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date(ts));

/** Lo pendiente arriba, lo más nuevo primero; lo tachado esta semana, abajo. */
export function TodoList({ todos, today }: { todos: Todo[]; today: string }) {
  const [list, apply] = useOptimistic(todos, reduce);
  const [, startTransition] = useTransition();
  const input = useRef<HTMLInputElement>(null);

  const open = list.filter((x) => !x.done_at);
  const done = list
    .filter((x) => x.done_at)
    .sort((a, b) => b.done_at!.localeCompare(a.done_at!));

  function add(fd: FormData) {
    const text = String(fd.get("title") ?? "").trim();
    if (!text) return;
    const now = new Date().toISOString();
    startTransition(async () => {
      apply({ t: "add", todos: [{ id: `nuevo-${now}`, title: text, done_at: null, created_at: now }] });
      await addTodo(text);
    });
    if (input.current) input.current.value = "";
  }

  const toggle = (x: Todo) =>
    startTransition(async () => {
      apply({ t: "done", id: x.id, done: !x.done_at });
      await setTodoDone(x.id, !x.done_at);
    });

  const remove = (x: Todo) =>
    startTransition(async () => {
      apply({ t: "remove", id: x.id });
      await deleteTodo(x.id);
    });

  return (
    <>
      <form action={add} className="mb-4 flex gap-2">
        <input
          ref={input}
          name="title"
          placeholder="Anotar un pendiente…"
          autoComplete="off"
          maxLength={200}
          className="field"
        />
        <button type="submit" className="btn btn-primary shrink-0" aria-label="Anotar">
          <IconPlus className="h-[18px] w-[18px]" />
          <span className="hidden sm:inline">Anotar</span>
        </button>
      </form>

      {open.length > 0 ? (
        <ul className="grid gap-2">
          {open.map((x) => (
            <Item key={x.id} todo={x} onToggle={toggle} onRemove={remove}>
              Anotado {relativeDay(dayOf(x.created_at), today)}
            </Item>
          ))}
        </ul>
      ) : (
        <Empty>
          Nada por hacer. Anotá acá, o mandale un audio al bot de Telegram y aparece en esta lista.
        </Empty>
      )}

      {done.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">
            Hechos esta semana
          </h2>
          <ul className="grid gap-2">
            {done.map((x) => (
              <Item key={x.id} todo={x} onToggle={toggle} onRemove={remove}>
                Hecho {relativeDay(dayOf(x.done_at!), today)}
              </Item>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

function Item({
  todo,
  onToggle,
  onRemove,
  children,
}: {
  todo: Todo;
  onToggle: (x: Todo) => void;
  onRemove: (x: Todo) => void;
  children: React.ReactNode;
}) {
  const done = Boolean(todo.done_at);
  return (
    <li
      className={`flex items-center gap-1 rounded-xl border pr-1.5 transition-colors ${
        done ? "border-ok/30 bg-ok-bg" : "border-line bg-surface hover:border-muted"
      }`}
    >
      <button
        type="button"
        role="checkbox"
        aria-checked={done}
        onClick={() => onToggle(todo)}
        className="flex min-w-0 flex-1 items-center gap-3 px-3 py-3 text-left"
      >
        <Tick done={done} />
        <span className="min-w-0 flex-1">
          <span className={`block font-semibold ${done ? "text-muted line-through" : ""}`}>
            {todo.title}
          </span>
          <span className="block text-xs font-semibold text-muted">{children}</span>
        </span>
      </button>
      <button
        type="button"
        onClick={() => {
          if (confirm(`¿Borrar "${todo.title}"?`)) onRemove(todo);
        }}
        aria-label={`Borrar ${todo.title}`}
        title="Borrar"
        className="btn !min-h-[2.2rem] shrink-0 !border-transparent !bg-transparent !px-2.5 !text-sm text-muted"
      >
        ✕
      </button>
    </li>
  );
}
