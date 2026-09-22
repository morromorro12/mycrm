import Link from "next/link";
import { ClientsView } from "@/components/clients/ClientsView";
import { PageTitle } from "@/components/ui";
import { monthSummary, mrr } from "@/lib/billing";
import { repo } from "@/lib/data";
import { todayISO } from "@/lib/dates";
import { formatTotals } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  const clients = await repo().listClients();
  const today = todayISO();
  const recurring = mrr(clients);
  const month = monthSummary(clients, today);

  return (
    <>
      <PageTitle
        title="Clientes"
        subtitle={`MRR ${formatTotals(recurring).join(" + ")} · falta cobrar ${formatTotals(month.pending).join(" + ")}`}
        action={
          <Link href="/clientes/nuevo" className="btn btn-primary shrink-0">
            + Cliente
          </Link>
        }
      />
      <ClientsView clients={clients} today={today} />
    </>
  );
}
