import Link from "next/link";
import { PageTitle } from "@/components/ui";
import { getAdsInsights, type AdsInsight } from "@/lib/ads-mock";
import { currentPeriod, periodLabel } from "@/lib/dates";
import { formatMoney } from "@/lib/money";

// MOCKUP. Ver src/lib/ads-mock.ts: ahí está marcado exactamente dónde va la
// llamada real a la Graph API / Marketing API de Meta.

export const dynamic = "force-dynamic";

const int = (n: number) => new Intl.NumberFormat("es-UY").format(n);

export default async function AdsPage() {
  const rows = await getAdsInsights();

  const spend = rows.reduce((s, r) => s + r.spend, 0);
  const reach = rows.reduce((s, r) => s + r.reach, 0);
  const results = rows.reduce((s, r) => s + r.results, 0);
  const cpa = results > 0 ? spend / results : 0;
  const maxSpend = Math.max(...rows.map((r) => r.spend), 1);

  return (
    <>
      <PageTitle title="Anuncios" subtitle={`${periodLabel(currentPeriod())} · Meta Ads`} />

      <div className="mb-3 rounded-xl border border-dashed border-brand/50 bg-brand/5 px-3 py-2.5 text-xs leading-relaxed text-muted">
        <strong className="text-brand">Vista previa con datos de ejemplo.</strong> Todavía no hay
        conexión con Meta. Los puntos exactos donde va la llamada a la Marketing API están
        comentados en <code className="font-mono">src/lib/ads-mock.ts</code>.
      </div>

      {/* Totales del mes */}
      <section className="card mb-3 grid grid-cols-2 gap-3 p-4 md:grid-cols-4">
        <Metric label="Gasto del mes" value={formatMoney(spend, "USD")} tone="ink" />
        <Metric label="Alcance" value={int(reach)} tone="ink" />
        <Metric label="Resultados" value={int(results)} tone="ok" />
        <Metric label="Costo x resultado" value={formatMoney(Number(cpa.toFixed(2)), "USD")} tone="muted" />
      </section>

      <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">Por cliente</h2>
      <ul className="grid gap-2">
        {rows.map((r) => (
          <AdRow key={r.businessName} row={r} maxSpend={maxSpend} />
        ))}
      </ul>

      <p className="mt-4 text-center text-xs text-muted">
        Próximo paso: conectar la Marketing API y guardar el{" "}
        <code className="font-mono">ad_account_id</code> de cada cliente.
      </p>
    </>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "ink" | "ok" | "muted";
}) {
  const color = { ink: "text-ink", ok: "text-ok", muted: "text-muted" }[tone];
  return (
    <div>
      <p className="text-xs font-semibold text-muted">{label}</p>
      <p className={`text-xl font-extrabold tabular-nums ${color}`}>{value}</p>
    </div>
  );
}

function AdRow({ row: r, maxSpend }: { row: AdsInsight; maxSpend: number }) {
  const cpa = r.results > 0 ? r.spend / r.results : 0;

  return (
    <li className="card p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          {r.clientId ? (
            <Link href={`/clientes/${r.clientId}`} className="truncate font-bold hover:underline">
              {r.businessName}
            </Link>
          ) : (
            <span className="truncate font-bold">{r.businessName}</span>
          )}
          <p className="text-xs text-muted">{r.resultLabel}</p>
        </div>
        <span className={`chip ${r.status === "activa" ? "bg-ok-bg text-ok" : "bg-bg text-muted"}`}>
          {r.status === "activa" ? "Activa" : "Pausada"}
        </span>
      </div>

      <div className="mt-2 grid grid-cols-3 gap-2 text-sm">
        <div>
          <p className="text-[0.7rem] font-semibold text-muted">Gasto</p>
          <p className="font-bold tabular-nums">
            {formatMoney(r.spend, "USD")}
            {r.spendTrend !== 0 && (
              <span className={`ml-1 text-xs ${r.spendTrend > 0 ? "text-warn" : "text-ok"}`}>
                {r.spendTrend > 0 ? "▲" : "▼"} {Math.abs(r.spendTrend)}%
              </span>
            )}
          </p>
        </div>
        <div>
          <p className="text-[0.7rem] font-semibold text-muted">Alcance</p>
          <p className="font-bold tabular-nums">{int(r.reach)}</p>
        </div>
        <div>
          <p className="text-[0.7rem] font-semibold text-muted">Resultados</p>
          <p className="font-bold tabular-nums text-ok">
            {int(r.results)}
            <span className="ml-1 text-xs font-normal text-muted">
              · {formatMoney(Number(cpa.toFixed(2)), "USD")} c/u
            </span>
          </p>
        </div>
      </div>

      {/* Barra de participación en el gasto total. */}
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line">
        <div className="h-full rounded-full bg-brand" style={{ width: `${(r.spend / maxSpend) * 100}%` }} />
      </div>
    </li>
  );
}
