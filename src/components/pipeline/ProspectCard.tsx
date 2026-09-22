"use client";

import Link from "next/link";
import { relativeDay, shortDate, todayISO } from "@/lib/dates";
import { INTEREST_LABEL, SOURCE_LABEL, STAGES, STAGE_LABEL, type Prospect, type ProspectStage } from "@/lib/types";
import { waLink } from "@/lib/whatsapp";
import { IconWhatsApp } from "../icons";

/**
 * Tarjeta del kanban. Además del drag, trae un `select` para cambiar de etapa:
 * en el celular mover con dos toques es más rápido y seguro que arrastrar.
 */
export function ProspectCard({
  prospect: p,
  onMove,
  dragging = false,
}: {
  prospect: Prospect;
  onMove?: (stage: ProspectStage) => void;
  dragging?: boolean;
}) {
  const today = todayISO();
  const due = p.next_action_at;
  const overdue = !!due && due < today;
  const dueToday = due === today;
  const wa = waLink(p.phone, `Hola ${p.contact_name ?? ""}!`.replace("  ", " "));

  return (
    <article
      className={`card p-2.5 ${dragging ? "rotate-2 shadow-lg" : ""} ${
        overdue ? "border-l-4 border-l-bad" : dueToday ? "border-l-4 border-l-warn" : ""
      }`}
    >
      <div className="flex items-start gap-2">
        <Link
          href={`/prospectos/${p.id}`}
          className="min-w-0 flex-1 truncate text-sm font-bold leading-tight hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {p.business_name}
        </Link>
        {wa && (
          <a
            href={wa}
            target="_blank"
            rel="noopener noreferrer"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            aria-label={`WhatsApp a ${p.business_name}`}
            className="shrink-0 rounded-md p-1 text-wa hover:bg-ok-bg"
          >
            <IconWhatsApp className="h-[18px] w-[18px]" />
          </a>
        )}
      </div>

      {p.contact_name && <p className="truncate text-xs text-muted">{p.contact_name}</p>}

      <div className="mt-1.5 flex flex-wrap gap-1">
        <span className="chip bg-bg text-muted">{INTEREST_LABEL[p.service_interest]}</span>
        <span className="chip bg-bg text-muted">{SOURCE_LABEL[p.source]}</span>
      </div>

      {p.next_action && (
        <p className="mt-1.5 text-xs leading-snug">
          {p.next_action}
          {due && (
            <span
              className={`ml-1 font-bold ${
                overdue ? "text-bad" : dueToday ? "text-warn" : "text-muted"
              }`}
            >
              · {overdue || dueToday ? relativeDay(due, today) : shortDate(due)}
            </span>
          )}
        </p>
      )}

      {onMove && (
        <select
          value={p.stage}
          aria-label={`Mover ${p.business_name} de etapa`}
          onPointerDown={(e) => e.stopPropagation()}
          onChange={(e) => onMove(e.target.value as ProspectStage)}
          className="mt-2 w-full rounded-md border border-line bg-bg px-1.5 py-1 text-xs font-semibold text-muted"
        >
          {STAGES.map((s) => (
            <option key={s} value={s}>
              {STAGE_LABEL[s]}
            </option>
          ))}
        </select>
      )}
    </article>
  );
}
