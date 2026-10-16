import Link from "next/link";
import { Celebration } from "@/components/metas/Celebration";
import { QuickContact } from "@/components/metas/QuickContact";
import { Bar, Stars } from "@/components/metas/parts";
import { PageTitle } from "@/components/ui";
import { globalLedger } from "@/lib/billing";
import { repo } from "@/lib/data";
import { MILLION_UYU, metas } from "@/lib/metas";
import { formatMoney } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function MetasPage() {
  const r = repo();
  const [prospects, clients, archived] = await Promise.all([
    r.listProspects(),
    r.listClients(),
    r.listArchived(),
  ]);

  // Archivados incluidos: archivar no te hace perder progreso ni plata cobrada.
  const ledger = globalLedger(clients, archived.clients);
  const m = metas([...prospects, ...archived.prospects], ledger.total.UYU);
  const { today, level, million } = m;
  const left = today.target - today.count;

  return (
    <div className="mx-auto max-w-2xl">
      <PageTitle
        title="Metas"
        subtitle={`Nivel ${level.n} · ${level.name} · ${m.stars} de ${m.maxStars} estrellas`}
      />

      <Celebration items={m.unlocked} />

      {/* Lo de hoy primero: es lo que se hace cuando no sabés qué hacer. */}
      <section className="card mb-3 p-4">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-xs font-bold uppercase tracking-wide text-muted">Meta del día</h2>
          {m.streak.current > 0 && (
            <span className="text-xs font-bold text-warn">
              Racha: {m.streak.current} {m.streak.current === 1 ? "día" : "días"}
            </span>
          )}
        </div>
        <p className="mt-1 text-3xl font-extrabold tabular-nums">
          {today.count}
          <span className="text-base font-bold text-muted">
            {" "}
            / {today.target} negocios contactados
          </span>
        </p>
        <div className="mt-2">
          <Bar
            pct={(today.count / today.target) * 100}
            tone={today.done ? "ok" : "brand"}
            label="Meta del día"
            thick
          />
        </div>
        <p className={`mt-2 text-sm font-semibold ${today.done ? "text-ok" : "text-muted"}`}>
          {today.done
            ? "¡Cumplida! Lo que sumes ahora es extra."
            : `Te ${left === 1 ? "falta 1" : `faltan ${left}`} para cumplirla.`}
        </p>

        <div className="mt-4 border-t border-line pt-4">
          <QuickContact />
        </div>

        {today.prospects.length > 0 && (
          <div className="mt-4 border-t border-line pt-3">
            <p className="label">Anotados hoy</p>
            <ul className="flex flex-wrap gap-1.5">
              {today.prospects.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/prospectos/${p.id}`}
                    className="chip bg-bg py-1 text-sm font-semibold text-ink hover:underline"
                  >
                    {p.business_name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <div className="mb-3 grid gap-3 md:grid-cols-2">
        <section className="card p-4">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-warn-bg text-xl font-extrabold text-warn tabular-nums">
              {level.n}
            </span>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-muted">Nivel {level.n}</p>
              <p className="text-lg font-extrabold">{level.name}</p>
            </div>
          </div>
          <div className="mt-3">
            <Bar pct={level.pct} tone="warn" label="Camino al siguiente nivel" />
          </div>
          <p className="mt-2 text-xs font-semibold text-muted">
            {level.starsToNext !== null
              ? `${level.starsToNext} ${level.starsToNext === 1 ? "estrella" : "estrellas"} más para Nivel ${level.n + 1} · ${level.nextName}`
              : level.nextName
                ? `Nivel ${level.n + 1} · ${level.nextName}: llegá a ${formatMoney(MILLION_UYU, "UYU")} cobrados`
                : "Llegaste al nivel máximo."}
          </p>
        </section>

        <section className="card p-4">
          <h2 className="text-xs font-bold uppercase tracking-wide text-muted">Camino al millón</h2>
          <p className="mt-1 text-2xl font-extrabold tabular-nums text-ok">
            {formatMoney(million.collected, "UYU")}
          </p>
          {million.next !== null ? (
            <>
              <div className="mt-2">
                <Bar
                  pct={(million.collected / million.next) * 100}
                  tone="ok"
                  label={`Camino a ${formatMoney(million.next, "UYU")}`}
                />
              </div>
              <p className="mt-2 text-xs font-semibold text-muted">
                Próximo hito: {formatMoney(million.next, "UYU")} · te faltan{" "}
                {formatMoney(million.next - million.collected, "UYU")}
              </p>
            </>
          ) : (
            <p className="mt-2 text-sm font-bold text-ok">¡Sos millonario!</p>
          )}
          <p className="mt-1 text-xs text-muted">
            Todo lo cobrado en pesos, desde siempre. Lo cobrado en dólares no suma acá.
          </p>
        </section>
      </div>

      <section className="card px-4 py-1">
        <h2 className="pt-3 text-xs font-bold uppercase tracking-wide text-muted">Logros</h2>
        <ul>
          {m.tracks.map((t) => (
            <li key={t.id} className="border-b border-line py-3 last:border-b-0">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-bold">{t.title}</span>
                <span className="text-sm font-semibold text-muted tabular-nums">
                  {t.next !== null ? `${t.value} / ${t.next}` : t.value}
                </span>
              </div>
              <div className="mt-1">
                <Stars earned={t.stars} total={t.tiers.length} />
              </div>
              {t.next !== null ? (
                <>
                  <div className="mt-1.5">
                    <Bar pct={(t.value / t.next) * 100} label={t.nextGoal ?? t.title} />
                  </div>
                  <p className="mt-1 text-xs text-muted">Próximo: {t.nextGoal}</p>
                </>
              ) : (
                <p className="mt-1 text-xs font-bold text-ok">¡Completo!</p>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
