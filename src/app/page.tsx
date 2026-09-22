import Link from "next/link";
import { AttentionList } from "@/components/AttentionList";
import { PageTitle } from "@/components/ui";
import {
  attentionItems,
  collectedSetups,
  monthSummary,
  mrr,
  pendingSetups,
} from "@/lib/billing";
import { repo } from "@/lib/data";
import { currentPeriod, periodLabel, todayISO } from "@/lib/dates";
import { formatMoney, formatTotals, type MoneyByCurrency } from "@/lib/money";
import type { CurrencyCode } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const r = repo();
  const [prospects, clients] = await Promise.all([r.listProspects(), r.listClients()]);

  const today = todayISO();
  const recurring = mrr(clients);
  const month = monthSummary(clients, today);
  const items = attentionItems(prospects, clients, today);
  const setups = pendingSetups(clients, today);
  const setupsIn = collectedSetups(clients, today);

  const openPipeline = prospects.filter(
    (p) => p.stage !== "ganado" && p.stage !== "perdido",
  ).length;

  const activos = clients.filter((c) => c.active).length;

  return (
    <>
      <PageTitle
        title="Hoy"
        subtitle={`${periodLabel(currentPeriod())} · ${activos} ${
          activos === 1 ? "cliente activo" : "clientes activos"
        }`}
      />

      {/* MRR — el número grande */}
      <section className="card mb-3 p-4">
        <h2 className="text-xs font-bold uppercase tracking-wide text-muted">MRR</h2>
        <div className="mt-1 flex flex-wrap items-baseline gap-x-4 gap-y-1">
          {formatTotals(recurring).map((t) => (
            <span key={t} className="text-3xl font-extrabold tabular-nums tracking-tight md:text-4xl">
              {t}
            </span>
          ))}
        </div>
        <p className="mt-1 text-xs text-muted">
          Suma de todos los servicios activos, por mes. Los pagos iniciales no cuentan:
          no se repiten.
        </p>
      </section>

      {/* Cobrado vs pendiente */}
      <section className="card mb-3 p-4">
        <h2 className="mb-3 text-xs font-bold uppercase tracking-wide text-muted">
          Este mes
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <Stat
            label={setupsIn.count > 0 ? "Cobrado (mensual)" : "Cobrado"}
            tone="ok"
            totals={month.collected}
          />
          <Stat
            label="Falta cobrar"
            tone={month.overdueClients > 0 ? "bad" : "warn"}
            totals={month.pending}
            note={
              month.overdueClients > 0
                ? `${month.overdueClients} ${month.overdueClients === 1 ? "cliente vencido" : "clientes vencidos"}`
                : undefined
            }
          />
        </div>
        <Progress collected={month.collected} pending={month.pending} />

        {(month.free.UYU > 0 || month.free.USD > 0) && (
          <p className="mt-2 text-xs text-muted">
            No se cobra {formatTotals(month.free).join(" + ")} este mes por primer mes gratis.
            Por eso el total de arriba no llega al MRR.
          </p>
        )}

        {setupsIn.count > 0 && (
          <div className="mt-3 flex items-baseline justify-between gap-2 border-t border-line pt-2.5">
            <span className="text-xs font-semibold text-muted">
              + {setupsIn.count} {setupsIn.count === 1 ? "pago inicial" : "pagos iniciales"} cobrado
              {setupsIn.count === 1 ? "" : "s"} este mes
            </span>
            <span className="text-sm font-extrabold tabular-nums text-ok">
              {formatTotals(setupsIn.totals).join(" + ")}
            </span>
          </div>
        )}

        {setups.count > 0 && (
          <div className="mt-3 flex items-baseline justify-between gap-2 border-t border-line pt-2.5">
            <span className="text-xs font-semibold text-muted">
              + {setups.count} {setups.count === 1 ? "pago inicial" : "pagos iniciales"} sin cobrar
            </span>
            <span className="text-sm font-extrabold tabular-nums text-warn">
              {formatTotals(setups.totals).join(" + ")}
            </span>
          </div>
        )}
      </section>

      {/* Atención hoy */}
      <section>
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="text-base font-bold">
            Atención hoy{" "}
            {items.length > 0 && (
              <span className="ml-1 rounded-full bg-bad px-2 py-0.5 text-xs font-bold text-white tabular-nums">
                {items.length}
              </span>
            )}
          </h2>
          <Link href="/pipeline" className="text-sm font-semibold text-brand hover:underline">
            {openPipeline} en pipeline →
          </Link>
        </div>
        <AttentionList items={items} />
      </section>
    </>
  );
}

function Stat({
  label,
  totals,
  tone,
  note,
}: {
  label: string;
  totals: MoneyByCurrency;
  tone: "ok" | "warn" | "bad";
  note?: string;
}) {
  const color = { ok: "text-ok", warn: "text-warn", bad: "text-bad" }[tone];
  return (
    <div>
      <p className="text-xs font-semibold text-muted">{label}</p>
      <div className="mt-0.5 grid">
        {formatTotals(totals).map((t) => (
          <span key={t} className={`text-lg font-extrabold tabular-nums ${color}`}>
            {t}
          </span>
        ))}
      </div>
      {note && <p className="mt-0.5 text-xs font-semibold text-bad">{note}</p>}
    </div>
  );
}

/** Una barra por moneda: no se mezclan pesos con dólares. */
function Progress({
  collected,
  pending,
}: {
  collected: MoneyByCurrency;
  pending: MoneyByCurrency;
}) {
  const rows = (["UYU", "USD"] as CurrencyCode[])
    .map((c) => ({ c, total: collected[c] + pending[c], done: collected[c] }))
    .filter((r) => r.total > 0);

  if (rows.length === 0) return null;

  return (
    <div className="mt-3 grid gap-2">
      {rows.map(({ c, total, done }) => {
        const pct = Math.round((done / total) * 100);
        return (
          <div key={c}>
            <div className="mb-1 flex justify-between text-xs font-semibold text-muted">
              <span>{c}</span>
              <span className="tabular-nums">
                {pct}% · {formatMoney(done, c)} de {formatMoney(total, c)}
              </span>
            </div>
            <div
              className="h-2 overflow-hidden rounded-full bg-line"
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Cobrado en ${c}`}
            >
              <div className="h-full rounded-full bg-ok transition-[width]" style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
