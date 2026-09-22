"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { IconSearch } from "./icons";

/** Búsqueda por nombre de negocio. Busca en prospectos y clientes a la vez. */
export function SearchBox({ initial = "" }: { initial?: string }) {
  const router = useRouter();
  const [q, setQ] = useState(initial);

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        router.push(q.trim() ? `/buscar?q=${encodeURIComponent(q.trim())}` : "/buscar");
      }}
      className="relative flex-1 md:max-w-xs"
    >
      <IconSearch className="pointer-events-none absolute left-2.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted" />
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar negocio…"
        aria-label="Buscar por nombre de negocio"
        className="field !min-h-[2.4rem] pl-9 text-sm"
      />
    </form>
  );
}
