import Link from "next/link";
import { SearchBox } from "@/components/SearchBox";
import { Empty, PageTitle, StatusChip, WhatsAppButton } from "@/components/ui";
import { clientStatus } from "@/lib/billing";
import { repo } from "@/lib/data";
import { todayISO } from "@/lib/dates";
import { addMoney, formatTotals, ZERO } from "@/lib/money";
import { KIND_LABEL, STAGE_LABEL } from "@/lib/types";

export const dynamic = "force-dynamic";

/** Normaliza para que "cafe" encuentre "Café". */
const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const term = norm(q.trim());

  const r = repo();
  const [prospects, clients] = await Promise.all([r.listProspects(), r.listClients()]);
  const today = todayISO();

  const hitClients = term ? clients.filter((c) => norm(c.business_name).includes(term)) : [];
  const hitProspects = term ? prospects.filter((p) => norm(p.business_name).includes(term)) : [];
  const total = hitClients.length + hitProspects.length;

  return (
    <div className="mx-auto max-w-2xl">
      <PageTitle
        title="Buscar"
        subtitle={term ? `${total} ${total === 1 ? "resultado" : "resultados"} para “${q}”` : undefined}
      />

      <div className="mb-4 md:hidden">
        <SearchBox initial={q} />
      </div>

      {!term ? (
        <Empty>Escribí el nombre de un negocio.</Empty>
      ) : total === 0 ? (
        <Empty>Nada con ese nombre, ni en prospectos ni en clientes.</Empty>
      ) : (
        <div className="grid gap-4">
          {hitClients.length > 0 && (
            <section>
              <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">
                Clientes ({hitClients.length})
              </h2>
              <ul className="grid gap-2">
                {hitClients.map((c) => {
                  let t = ZERO;
                  for (const s of c.services) if (s.active) t = addMoney(t, s.currency, s.amount);
                  return (
                    <li key={c.id} className="card flex items-center gap-2 p-3">
                      <Link href={`/clientes/${c.id}`} className="min-w-0 flex-1">
                        <p className="truncate font-bold">{c.business_name}</p>
                        <p className="truncate text-xs text-muted">
                          {formatTotals(t).join(" + ")} ·{" "}
                          {c.services.filter((s) => s.active).map((s) => KIND_LABEL[s.kind]).join(", ") ||
                            "sin servicios"}
                        </p>
                      </Link>
                      <StatusChip status={clientStatus(c, today)} />
                      <WhatsAppButton phone={c.phone} compact />
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {hitProspects.length > 0 && (
            <section>
              <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">
                Prospectos ({hitProspects.length})
              </h2>
              <ul className="grid gap-2">
                {hitProspects.map((p) => (
                  <li key={p.id} className="card flex items-center gap-2 p-3">
                    <Link href={`/prospectos/${p.id}`} className="min-w-0 flex-1">
                      <p className="truncate font-bold">{p.business_name}</p>
                      <p className="truncate text-xs text-muted">
                        {STAGE_LABEL[p.stage]}
                        {p.contact_name ? ` · ${p.contact_name}` : ""}
                      </p>
                    </Link>
                    <WhatsAppButton phone={p.phone} compact />
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
