import Link from "next/link";
import type { Metas } from "@/lib/metas";
import { IconStar } from "../icons";

/** Una fila de estrellas: las ganadas llenas, las que faltan sólo el borde. */
export function Stars({ earned, total }: { earned: number; total: number }) {
  return (
    <span className="inline-flex gap-0.5" role="img" aria-label={`${earned} de ${total} estrellas`}>
      {Array.from({ length: total }, (_, i) => (
        <IconStar
          key={i}
          filled={i < earned}
          className={`h-4 w-4 ${i < earned ? "text-warn" : "text-muted/40"}`}
        />
      ))}
    </span>
  );
}

export function Bar({
  pct,
  tone = "brand",
  label,
  thick = false,
}: {
  pct: number;
  tone?: "brand" | "ok" | "warn";
  label: string;
  thick?: boolean;
}) {
  const value = Math.max(0, Math.min(100, Math.floor(pct)));
  const color = { brand: "bg-brand", ok: "bg-ok", warn: "bg-warn" }[tone];
  return (
    <div
      className={`${thick ? "h-2.5" : "h-1.5"} overflow-hidden rounded-full bg-line`}
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div className={`h-full rounded-full ${color} transition-[width]`} style={{ width: `${value}%` }} />
    </div>
  );
}

/** La tarjeta de Hoy: la meta del día y el nivel, y un toque te lleva a sumar. */
export function MetasCard({ m }: { m: Metas }) {
  const { count, target, done } = m.today;
  return (
    <Link href="/metas" className="card mb-3 block p-4 hover:border-muted">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-xs font-bold uppercase tracking-wide text-muted">Meta del día</h2>
        <span className="flex items-center gap-1 text-xs font-bold text-warn">
          <IconStar filled className="h-3.5 w-3.5" />
          Nivel {m.level.n} · {m.level.name}
        </span>
      </div>
      <p className="mt-1 text-2xl font-extrabold tabular-nums">
        {count}
        <span className="text-base font-bold text-muted"> / {target} contactados en frío</span>
      </p>
      <div className="mt-2">
        <Bar pct={(count / target) * 100} tone={done ? "ok" : "brand"} label="Meta del día" />
      </div>
      <p className="mt-2 text-sm font-semibold text-brand">
        {done ? "¡Cumplida! Ver metas →" : "Sumar contactados →"}
      </p>
    </Link>
  );
}
