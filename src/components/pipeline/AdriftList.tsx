import Link from "next/link";
import { snoozeProspect } from "@/lib/actions";
import { lastContactLabel } from "@/lib/seguimiento";
import { STAGE_LABEL, type Prospect } from "@/lib/types";
import { ActionButton } from "../ActionButton";
import { WhatsAppButton } from "../ui";

/**
 * Prospectos abiertos sin fecha de próximo paso: los que nunca aparecen en
 * "Atención hoy" y por eso se olvidan. El de hace más tiempo, primero. Un
 * toque les pone fecha y pasan al seguimiento normal.
 */
export function AdriftList({
  prospects,
  today,
  limit,
}: {
  /** Ya filtrados y ordenados: `followUps().adrift`. */
  prospects: Prospect[];
  today: string;
  /** En Hoy se muestran unos pocos, con link al resto. */
  limit?: number;
}) {
  if (prospects.length === 0) return null;
  const shown = limit ? prospects.slice(0, limit) : prospects;
  const rest = prospects.length - shown.length;

  return (
    <section className="card mb-3 border-warn/50 p-3">
      <h2 className="text-xs font-bold uppercase tracking-wide text-warn">
        Sin próximo paso · {prospects.length}
      </h2>
      <p className="mt-0.5 text-xs text-muted">
        No tienen fecha, así que nunca aparecen en Atención hoy. Poneles una.
      </p>

      <ul className="mt-2 grid grid-cols-1">
        {shown.map((p) => (
          <li key={p.id} className="flex items-center gap-2 border-t border-line py-2">
            <div className="min-w-0 flex-1">
              <Link href={`/prospectos/${p.id}`} className="block truncate text-sm font-bold hover:underline">
                {p.business_name}
              </Link>
              <p className="truncate text-xs text-muted">
                {/* Primero cuánto hace: es lo que se corta en el celular si no entra. */}
                {lastContactLabel(p, today)} · {STAGE_LABEL[p.stage]}
              </p>
            </div>
            <WhatsAppButton
              phone={p.phone}
              compact
              text={`Hola ${p.contact_name ?? ""}!`.replace("  ", " ")}
            />
            <ActionButton
              action={snoozeProspect.bind(null, p.id, 1)}
              className="btn !min-h-[2.2rem] !px-2.5 !text-xs"
              title="Seguimiento mañana"
              pendingLabel="…"
            >
              Mañana
            </ActionButton>
            <ActionButton
              action={snoozeProspect.bind(null, p.id, 3)}
              className="btn !min-h-[2.2rem] !px-2.5 !text-xs"
              title="Seguimiento en 3 días"
              pendingLabel="…"
            >
              +3d
            </ActionButton>
          </li>
        ))}
      </ul>

      {rest > 0 && (
        <Link href="/pipeline" className="mt-1 block text-sm font-semibold text-brand hover:underline">
          Ver los {rest} que faltan →
        </Link>
      )}
    </section>
  );
}
