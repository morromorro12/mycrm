"use client";

import { useOptimistic, useRef, useTransition } from "react";
import { addColdContacts } from "@/lib/actions";
import { Bar } from "./parts";

/**
 * La meta del día: cuántos contactaste en frío y los botones para sumar. El
 * número sube apenas tocás, sin esperar a la base; si tocás varias veces
 * seguidas, se guardan en orden.
 */
export function ColdCounter({ count, target }: { count: number; target: number }) {
  const [shown, bump] = useOptimistic(count, (c, delta: number) => Math.max(0, c + delta));
  const [, startTransition] = useTransition();
  const otherRef = useRef<HTMLInputElement>(null);

  function add(delta: number) {
    startTransition(async () => {
      bump(delta);
      await addColdContacts(delta);
    });
  }

  const done = shown >= target;
  const left = target - shown;

  return (
    <>
      <p className="mt-1 text-3xl font-extrabold tabular-nums">
        {shown}
        <span className="text-base font-bold text-muted"> / {target} contactados en frío</span>
      </p>
      <div className="mt-2">
        <Bar pct={(shown / target) * 100} tone={done ? "ok" : "brand"} label="Meta del día" thick />
      </div>
      <p className={`mt-2 text-sm font-semibold ${done ? "text-ok" : "text-muted"}`}>
        {done
          ? "¡Cumplida! Lo que sumes ahora es extra."
          : `Te ${left === 1 ? "falta 1" : `faltan ${left}`} para cumplirla.`}
      </p>

      <div className="mt-4 grid grid-cols-4 gap-2 border-t border-line pt-4">
        <button type="button" onClick={() => add(1)} className="btn btn-primary !text-lg">
          +1
        </button>
        <button type="button" onClick={() => add(5)} className="btn !text-lg">
          +5
        </button>
        <button type="button" onClick={() => add(10)} className="btn !text-lg">
          +10
        </button>
        <button
          type="button"
          onClick={() => add(-1)}
          disabled={shown === 0}
          aria-label="Restar uno"
          title="Restar uno, si tocaste de más"
          className="btn !text-lg text-muted"
        >
          −1
        </button>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          const input = otherRef.current;
          const n = Math.trunc(Number(input?.value));
          if (!input || !(n > 0)) return;
          add(n);
          input.value = "";
        }}
        className="mt-2 flex gap-2"
      >
        <input
          ref={otherRef}
          type="number"
          inputMode="numeric"
          min={1}
          max={1000}
          step={1}
          required
          placeholder="Otro número"
          aria-label="Cuántos contactaste"
          className="field flex-1"
        />
        <button type="submit" className="btn">
          Sumar
        </button>
      </form>
    </>
  );
}
