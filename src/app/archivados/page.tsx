import Link from "next/link";
import { ActionButton } from "@/components/ActionButton";
import { BackLink, Empty, PageTitle } from "@/components/ui";
import {
  deleteClient,
  deleteProspect,
  restoreClient,
  restoreProspect,
} from "@/lib/actions";
import { repo } from "@/lib/data";
import { addMoney, formatTotals, ZERO } from "@/lib/money";
import { KIND_LABEL, STAGE_LABEL } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * La papelera. Archivar es de un toque y reversible; borrar de verdad vive
 * sólo acá y pide confirmación aparte. Nada se pierde por un dedazo.
 */
export default async function ArchivedPage() {
  const { prospects, clients } = await repo().listArchived();
  const total = prospects.length + clients.length;

  return (
    <div className="mx-auto max-w-2xl">
      <BackLink href="/clientes">Clientes</BackLink>
      <PageTitle
        title="Archivados"
        subtitle={
          total === 0
            ? undefined
            : `${total} ${total === 1 ? "ficha guardada" : "fichas guardadas"} · no cuentan para el MRR ni aparecen en las listas`
        }
      />

      {total === 0 ? (
        <Empty>
          No archivaste nada todavía. Lo que archives desde una ficha aparece acá, y
          desde acá lo podés restaurar.
        </Empty>
      ) : (
        <div className="grid gap-4">
          {clients.length > 0 && (
            <section>
              <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">
                Clientes ({clients.length})
              </h2>
              <ul className="grid gap-2">
                {clients.map((c) => {
                  let t = ZERO;
                  for (const s of c.services) t = addMoney(t, s.currency, s.amount);
                  return (
                    <li key={c.id} className="card p-3">
                      <Link href={`/clientes/${c.id}`} className="font-bold hover:underline">
                        {c.business_name}
                      </Link>
                      <p className="text-xs text-muted">
                        {formatTotals(t).join(" + ")} ·{" "}
                        {c.services.map((s) => KIND_LABEL[s.kind]).join(", ") || "sin servicios"} ·{" "}
                        {c.payments.length}{" "}
                        {c.payments.length === 1 ? "pago en el historial" : "pagos en el historial"}
                      </p>
                      <div className="mt-2 flex gap-2">
                        <ActionButton
                          action={restoreClient.bind(null, c.id)}
                          className="btn btn-primary !min-h-[2.2rem] !text-sm"
                          pendingLabel="…"
                        >
                          Restaurar
                        </ActionButton>
                        <ActionButton
                          action={deleteClient.bind(null, c.id)}
                          className="btn !min-h-[2.2rem] !text-sm text-bad"
                          confirm={`Borrar "${c.business_name}" para siempre, junto con sus ${c.payments.length} pagos del historial.\n\nEsto NO se puede deshacer. ¿Seguro?`}
                          pendingLabel="…"
                        >
                          Borrar definitivamente
                        </ActionButton>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {prospects.length > 0 && (
            <section>
              <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">
                Prospectos ({prospects.length})
              </h2>
              <ul className="grid gap-2">
                {prospects.map((p) => (
                  <li key={p.id} className="card p-3">
                    <Link href={`/prospectos/${p.id}`} className="font-bold hover:underline">
                      {p.business_name}
                    </Link>
                    <p className="text-xs text-muted">
                      {STAGE_LABEL[p.stage]}
                      {p.contact_name ? ` · ${p.contact_name}` : ""}
                    </p>
                    <div className="mt-2 flex gap-2">
                      <ActionButton
                        action={restoreProspect.bind(null, p.id)}
                        className="btn btn-primary !min-h-[2.2rem] !text-sm"
                        pendingLabel="…"
                      >
                        Restaurar
                      </ActionButton>
                      <ActionButton
                        action={deleteProspect.bind(null, p.id)}
                        className="btn !min-h-[2.2rem] !text-sm text-bad"
                        confirm={`Borrar "${p.business_name}" para siempre.\n\nEsto NO se puede deshacer. ¿Seguro?`}
                        pendingLabel="…"
                      >
                        Borrar definitivamente
                      </ActionButton>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
