import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionButton, SubmitButton } from "@/components/ActionButton";
import { IconCheck } from "@/components/icons";
import { BackLink, StatusChip, WhatsAppButton } from "@/components/ui";
import {
  addService,
  deletePayment,
  deleteService,
  markClientPaid,
  markServicePaid,
  restoreClient,
  saveClientNotes,
  setClientActive,
  toggleService,
  updateService,
} from "@/lib/actions";
import { clientStatus, serviceStatus } from "@/lib/billing";
import { repo } from "@/lib/data";
import { effectiveBillingDay, periodLabel, shortDate, todayISO } from "@/lib/dates";
import { addMoney, formatMoney, formatTotals, ZERO } from "@/lib/money";
import { KIND_LABEL, type ClientService, type ServiceKind } from "@/lib/types";
import { prettyPhone } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";

const KINDS: ServiceKind[] = ["web", "retainer", "ads"];

export default async function ClientDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const client = await repo().getClient(id);
  if (!client) notFound();

  const today = todayISO();
  const status = clientStatus(client, today);
  const active = client.services.filter((s) => s.active);

  let total = ZERO;
  for (const s of active) total = addMoney(total, s.currency, s.amount);

  // Historial agrupado por mes, del más reciente al más viejo.
  const byPeriod = new Map<string, typeof client.payments>();
  for (const p of [...client.payments].sort((a, b) => b.period.localeCompare(a.period))) {
    byPeriod.set(p.period, [...(byPeriod.get(p.period) ?? []), p]);
  }

  return (
    <>
      <BackLink href={client.archived ? "/archivados" : "/clientes"}>
        {client.archived ? "Archivados" : "Clientes"}
      </BackLink>

      {client.archived && (
        <div className="card mb-3 flex flex-wrap items-center justify-between gap-2 border-warn/40 bg-warn-bg p-3">
          <p className="text-sm font-semibold text-warn">
            Archivado. No cuenta para el MRR ni aparece en las listas.
          </p>
          <ActionButton
            action={restoreClient.bind(null, client.id)}
            className="btn btn-primary !min-h-[2.2rem] !text-sm"
            pendingLabel="…"
          >
            Restaurar
          </ActionButton>
        </div>
      )}

      <header className="card mb-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-extrabold leading-tight">{client.business_name}</h1>
            <p className="text-sm text-muted">
              {client.contact_name ?? "Sin contacto"} · {prettyPhone(client.phone)}
            </p>
          </div>
          <StatusChip status={status} />
        </div>

        <div className="mt-2 flex flex-wrap items-baseline gap-x-3">
          {formatTotals(total).map((t) => (
            <span key={t} className="text-2xl font-extrabold tabular-nums">
              {t}
            </span>
          ))}
          <span className="text-xs text-muted">por mes</span>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <WhatsAppButton phone={client.phone} className="flex-1 md:flex-none" />
          {status !== "pagado" && (
            <ActionButton
              action={markClientPaid.bind(null, client.id)}
              className="btn btn-primary flex-1 md:flex-none"
              pendingLabel="Marcando…"
            >
              <IconCheck className="h-4 w-4" />
              Marcar pagado
            </ActionButton>
          )}
          <Link href={`/clientes/${client.id}/editar`} className="btn">
            Editar
          </Link>
        </div>
      </header>

      {/* ── Servicios ── */}
      <section className="card mb-3 p-4">
        <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">
          Servicios contratados
        </h2>

        {client.services.length === 0 ? (
          <p className="py-2 text-sm text-muted">Sin servicios cargados.</p>
        ) : (
          <ul className="grid gap-2">
            {client.services.map((s) => (
              <ServiceRow key={s.id} service={s} clientId={client.id} payments={client.payments} today={today} />
            ))}
          </ul>
        )}

        <details className="mt-3">
          <summary className="cursor-pointer text-sm font-semibold text-brand">
            + Agregar servicio
          </summary>
          <form action={addService.bind(null, client.id)} className="mt-2 grid grid-cols-2 gap-2">
            <label className="col-span-1">
              <span className="label">Servicio</span>
              <select name="kind" className="field" defaultValue="retainer">
                {KINDS.map((k) => (
                  <option key={k} value={k}>
                    {KIND_LABEL[k]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="label">Día de cobro</span>
              <input name="billing_day" type="number" min={1} max={31} defaultValue={1} className="field" />
            </label>
            <label>
              <span className="label">Monto</span>
              <input name="amount" type="number" min={0} step="1" required className="field" />
            </label>
            <label>
              <span className="label">Moneda</span>
              <select name="currency" className="field" defaultValue="UYU">
                <option value="UYU">$U (pesos)</option>
                <option value="USD">US$ (dólares)</option>
              </select>
            </label>
            <div className="col-span-2">
              <SubmitButton className="btn btn-primary w-full">Agregar</SubmitButton>
            </div>
          </form>
        </details>
      </section>

      {/* ── Historial ── */}
      <section className="card mb-3 p-4">
        <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">
          Historial de pagos
        </h2>
        {byPeriod.size === 0 ? (
          <p className="py-2 text-sm text-muted">Todavía no hay pagos registrados.</p>
        ) : (
          <ul className="grid gap-1.5">
            {[...byPeriod.entries()].map(([period, rows]) => {
              let sum = ZERO;
              for (const p of rows) sum = addMoney(sum, p.currency, p.amount);
              return (
                <li
                  key={period}
                  className="flex items-center justify-between gap-2 rounded-lg bg-bg px-2.5 py-2"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold capitalize">{periodLabel(period)}</p>
                    <p className="truncate text-xs text-muted">
                      {rows
                        .map((p) => {
                          const svc = client.services.find((s) => s.id === p.service_id);
                          return `${svc ? KIND_LABEL[svc.kind] : "Pago"} · ${shortDate(p.paid_at)}`;
                        })
                        .join(" | ")}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-sm font-bold tabular-nums text-ok">
                      {formatTotals(sum).join(" + ")}
                    </span>
                    {rows.length === 1 && (
                      <ActionButton
                        action={deletePayment.bind(null, rows[0].id)}
                        className="btn !min-h-[1.9rem] !px-2 !text-xs text-muted"
                        confirm="¿Borrar este pago del historial?"
                        pendingLabel="…"
                        title="Deshacer este pago"
                      >
                        ✕
                      </ActionButton>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* ── Notas ── */}
      <section className="card mb-3 p-4">
        <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">
          Notas de cuenta
        </h2>
        <form action={saveClientNotes.bind(null, client.id)} className="grid gap-2">
          <textarea
            name="notes"
            rows={3}
            defaultValue={client.notes ?? ""}
            placeholder="Cómo prefiere que le escribas, acuerdos, pendientes…"
            className="field resize-y"
          />
          <SubmitButton className="btn justify-self-start">Guardar notas</SubmitButton>
        </form>
      </section>

      <div className="flex justify-end">
        <ActionButton
          action={setClientActive.bind(null, client.id, !client.active)}
          className="btn !text-sm text-muted"
          confirm={
            client.active
              ? "¿Pausar este cliente? Sale del MRR y de los cobros, pero no se borra nada."
              : undefined
          }
        >
          {client.active ? "Pausar cliente" : "Reactivar cliente"}
        </ActionButton>
      </div>
    </>
  );
}

function ServiceRow({
  service: s,
  clientId,
  payments,
  today,
}: {
  service: ClientService;
  clientId: string;
  payments: Awaited<ReturnType<ReturnType<typeof repo>["listPayments"]>>;
  today: string;
}) {
  const status = s.active ? serviceStatus(s, payments, today) : "pagado";
  const due = effectiveBillingDay(s.billing_day, today);

  return (
    <li className={`rounded-lg border border-line p-2.5 ${s.active ? "" : "opacity-55"}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold">
            {KIND_LABEL[s.kind]}{" "}
            <span className="text-muted">· día {due}</span>
            {!s.active && <span className="ml-1 text-xs text-muted">(pausado)</span>}
          </p>
          <p className="text-lg font-extrabold tabular-nums">{formatMoney(s.amount, s.currency)}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          {s.active && <StatusChip status={status} />}
          {s.active && status !== "pagado" && (
            <ActionButton
              action={markServicePaid.bind(null, clientId, s.id)}
              className="btn btn-primary !min-h-[2rem] !px-2.5 !text-xs"
              pendingLabel="…"
            >
              Cobrar
            </ActionButton>
          )}
        </div>
      </div>

      <details className="mt-1.5">
        <summary className="cursor-pointer text-xs font-semibold text-muted">Editar</summary>
        <form action={updateService.bind(null, s.id)} className="mt-2 grid grid-cols-2 gap-2">
          <select name="kind" defaultValue={s.kind} className="field !min-h-[2.3rem] !text-sm">
            {KINDS.map((k) => (
              <option key={k} value={k}>
                {KIND_LABEL[k]}
              </option>
            ))}
          </select>
          <input
            name="billing_day"
            type="number"
            min={1}
            max={31}
            defaultValue={s.billing_day}
            aria-label="Día de cobro"
            className="field !min-h-[2.3rem] !text-sm"
          />
          <input
            name="amount"
            type="number"
            min={0}
            step="1"
            defaultValue={s.amount}
            aria-label="Monto"
            className="field !min-h-[2.3rem] !text-sm"
          />
          <select name="currency" defaultValue={s.currency} className="field !min-h-[2.3rem] !text-sm">
            <option value="UYU">$U</option>
            <option value="USD">US$</option>
          </select>
          <SubmitButton className="btn btn-primary !min-h-[2.2rem] !text-sm">Guardar</SubmitButton>
        </form>
        <div className="mt-2 flex gap-2">
          <ActionButton
            action={toggleService.bind(null, s.id, !s.active)}
            className="btn !min-h-[2.2rem] !text-xs"
          >
            {s.active ? "Pausar" : "Reactivar"}
          </ActionButton>
          <ActionButton
            action={deleteService.bind(null, s.id)}
            className="btn !min-h-[2.2rem] !text-xs text-bad"
            confirm="¿Borrar este servicio? Los pagos ya registrados quedan en el historial."
          >
            Borrar
          </ActionButton>
        </div>
      </details>
    </li>
  );
}
