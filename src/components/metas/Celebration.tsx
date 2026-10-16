"use client";

import { useEffect, useState } from "react";
import type { Unlocked } from "@/lib/metas";
import { IconStar } from "../icons";

const SEEN_KEY = "crm:metas-festejadas";

/**
 * El festejo cuando desbloqueás algo. Lo ya festejado se guarda en el
 * celular, no en la base: en otro dispositivo se festeja de nuevo, y no pasa
 * nada. La primera vez sólo toma nota de lo que ya tenías, sin festejar todo.
 */
export function Celebration({ items }: { items: Unlocked[] }) {
  const [fresh, setFresh] = useState<Unlocked[]>([]);

  useEffect(() => {
    let seen: string[] | null = null;
    try {
      seen = JSON.parse(localStorage.getItem(SEEN_KEY) ?? "null");
    } catch {}
    // Sin poder leer lo ya visto (modo privado), mejor no festejar que
    // festejar todo cada vez.
    if (!Array.isArray(seen)) seen = null;

    const news = seen ? items.filter((i) => !seen.includes(i.key)) : [];
    try {
      const all = new Set([...(seen ?? []), ...items.map((i) => i.key)]);
      localStorage.setItem(SEEN_KEY, JSON.stringify([...all]));
    } catch {}

    if (news.length > 0) {
      setFresh((prev) => [...prev, ...news]);
      navigator.vibrate?.([60, 40, 120]);
    }
  }, [items]);

  if (fresh.length === 0) return null;

  return (
    <section role="status" className="pop card mb-3 border-warn/40 bg-warn-bg p-4">
      <div className="flex items-start gap-3">
        <IconStar filled className="h-8 w-8 shrink-0 text-warn" />
        <div className="min-w-0 flex-1">
          <p className="font-extrabold text-warn">
            {fresh.length === 1 ? "¡Logro desbloqueado!" : `¡${fresh.length} logros desbloqueados!`}
          </p>
          <ul className="mt-1 grid gap-0.5 text-sm font-semibold">
            {fresh.map((f) => (
              <li key={f.key}>{f.label}</li>
            ))}
          </ul>
        </div>
        <button type="button" onClick={() => setFresh([])} className="btn !min-h-0 !px-3 !py-2 text-sm">
          Genial
        </button>
      </div>
    </section>
  );
}
