import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionButton, SubmitButton } from "@/components/ActionButton";
import { IconCheck } from "@/components/icons";
import { BackLink, StatusChip, WhatsAppButton } from "@/components/ui";
import {
  addService,
  markSetupPaid,
  saveSetup,
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
import {
  clientLedger,
  clientStatus,
  isFreeMonth,
  serviceStatus,
  setupPayment,
  setupStatus,
} from "@/lib/billing";
import { repo } from "@/lib/data";
import { effectiveBillingDay, periodLabel, shortDate, todayISO } from "@/lib/dates";
import { addMoney, formatMoney, formatTotals, ZERO } from "@/lib/money";
import { KIND_LABEL, type ClientFull, type ClientService, type ServiceKind } from "@/lib/types";
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
          {(status === "pendiente" || status === "vencido") && (
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

      {/* ── Pago inicial ── */}
      <SetupSection client={client} today={today} />

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
            <label className="col-span-2">
              <span className="label">Arranca el</span>
              <input name="starts_on" type="date" defaultValue={today} className="field" />
            </label>
            <label className="col-span-2 flex items-center gap-2 text-sm">
              <input type="checkbox" name="first_month_free" className="h-4 w-4" />
              Primer mes gratis
            </label>
            <div className="col-span-2">
              <SubmitButton className="btn btn-primary w-full">Agregar</SubmitButton>
            </div>
          </form>
        </details>
      </section>

      {/* ── Estado de cuenta ── */}
      <section className="card mb-3 p-4">
        <h2 className="mb-3 text-xs font-bold uppercase tracking-wide text-muted">
          Estado de cuenta
        </h2>

        {byPeriod.size === 0 ? (
          <p className="py-2 text-sm text-muted">Todavía no cobraste nada de este cliente.</p>
        ) : (
          <>
            <Ledger client={client} />

            <h3 className="mb-2 mt-4 text-xs font-bold uppercase tracking-wide text-muted">
              Mes por mes
            </h3>
            <ul className="grid gap-1.5">
            {[...byPeriod.entries()].map(([period, rows]) => {
              let sum = ZERO;
              for (const p of rows) sum = addMoney(sum, p.currency, p.amount);
              return (
                <li
                  key={period}
                  // min-w-0 en el <li>: sin esto la grilla le da el ancho del
                  // contenido y la fila se sale de la tarjeta en el celular.
                  className="flex min-w-0 items-center justify-between gap-2 rounded-lg bg-bg px-2.5 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold capitalize">{periodLabel(period)}</p>
                    <p className="truncate text-xs text-muted">
                      {rows
                        .map((p) => {
                          if (p.kind === "inicial") return `Pago inicial · ${shortDate(p.paid_at)}`;
                          const svc = client.services.find((s) => s.id === p.service_id);
                          return `${svc ? KIND_LABEL[svc.kind] : "Pago"} · ${shortDate(p.paid_at)}`;
                        })
                        .join(" | ")}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {/* Una moneda por línea: unidas con " + " desbordaban a
                        lo ancho en pantalla de celular. */}
                    <span className="grid justify-items-end text-sm font-bold tabular-nums text-ok">
                      {formatTotals(sum).map((t) => (
                        <span key={t}>{t}</span>
                      ))}
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
          </>
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

/**
 * Los acumulados del cliente: cuánto dejó en mensualidades, cuánto de pago
 * inicial, y el total de los dos juntos. Crece solo con cada cobro.
 */
function Ledger({ client }: { client: ClientFull }) {
  const l = clientLedger(client);
  const hasSetup = l.setup.UYU > 0 || l.setup.USD > 0;

  return (
    <div className="rounded-xl bg-bg p-3">
      <Line
        label="Mensualidades"
        hint={`${l.months} ${l.months === 1 ? "mes cobrado" : "meses cobrados"}`}
        totals={l.monthly}
      />

      {hasSetup && <Line label="Pago inicial" hint="por única vez" totals={l.setup} />}

      <div className="mt-2 flex items-start justify-between gap-3 border-t border-line pt-2">
        <div>
          <p className="text-sm font-bold">Total cobrado</p>
          {/* Sin `capitalize`: en español los meses van en minúscula. */}
          {l.since && (
            <p className="text-xs text-muted">desde {periodLabel(l.since)}</p>
          )}
        </div>
        <div className="grid justify-items-end">
          {formatTotals(l.total).map((t) => (
            <span key={t} className="text-xl font-extrabold tabular-nums text-ok">
              {t}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function Line({
  label,
  hint,
  totals,
}: {
  label: string;
  hint: string;
  totals: ReturnType<typeof clientLedger>["monthly"];
}) {
  return (
    <div className="flex items-start justify-between gap-3 py-1">
      <div>
        <p className="text-sm font-semibold">{label}</p>
        <p className="text-xs text-muted">{hint}</p>
      </div>
      <div className="grid justify-items-end">
        {formatTotals(totals).map((t) => (
          <span key={t} className="font-bold tabular-nums">
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * Pago inicial: el cobro de arranque del proyecto. Uno por cliente y por única
 * vez, así que no entra en el MRR — pero es casi siempre el importe más grande.
 */
function SetupSection({ client, today }: { client: ClientFull; today: string }) {
  const status = setupStatus(client, today);
  const paid = setupPayment(client);
  const has = client.setup_amount != null && client.setup_amount > 0;

  return (
    <section className="card mb-3 p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-xs font-bold uppercase tracking-wide text-muted">Pago inicial</h2>
        {status && <StatusChip status={status} />}
      </div>

      {!has ? (
        <p className="text-sm text-muted">
          Sin pago inicial. Si a este cliente le cobrás un monto de arranque —el
          armado del sitio, el setup de las campañas— cargalo acá.
        </p>
      ) : (
        <>
          <p className="text-2xl font-extrabold tabular-nums">
            {formatMoney(client.setup_amount!, client.setup_currency)}
          </p>
          <p className="text-xs text-muted">
            {paid
              ? `Cobrado el ${shortDate(paid.paid_at)}`
              : client.setup_due_on
                ? `Para el ${shortDate(client.setup_due_on)}`
                : "Sin fecha acordada"}
            {client.setup_note ? ` · ${client.setup_note}` : ""}
          </p>
          {!paid && (
            <ActionButton
              action={markSetupPaid.bind(null, client.id)}
              className="btn btn-primary mt-2.5 w-full md:w-auto"
              pendingLabel="Marcando…"
            >
              <IconCheck className="h-4 w-4" />
              Cobré el pago inicial
            </ActionButton>
          )}
        </>
      )}

      <details className="mt-3">
        <summary className="cursor-pointer text-sm font-semibold text-brand">
          {has ? "Editar pago inicial" : "+ Cargar pago inicial"}
        </summary>
        <form action={saveSetup.bind(null, client.id)} className="mt-2 grid grid-cols-2 gap-2">
          <label>
            <span className="label">Monto</span>
            <input
              name="setup_amount"
              type="number"
              min={0}
              step="1"
              inputMode="numeric"
              defaultValue={client.setup_amount ?? ""}
              placeholder="28000"
              className="field"
            />
          </label>
          <label>
            <span className="label">Moneda</span>
            <select name="setup_currency" defaultValue={client.setup_currency} className="field">
              <option value="UYU">$U (pesos)</option>
              <option value="USD">US$ (dólares)</option>
            </select>
          </label>
          <label className="col-span-2">
            <span className="label">¿Para cuándo? (opcional)</span>
            <input
              name="setup_due_on"
              type="date"
              defaultValue={client.setup_due_on ?? ""}
              className="field"
            />
          </label>
          <label className="col-span-2">
            <span className="label">Qué incluye (opcional)</span>
            <input
              name="setup_note"
              defaultValue={client.setup_note ?? ""}
              placeholder="Armado del sitio + integración a WhatsApp"
              className="field"
            />
          </label>
          <div className="col-span-2">
            <SubmitButton className="btn btn-primary w-full">Guardar</SubmitButton>
          </div>
        </form>
        <p className="mt-1.5 text-xs text-muted">
          Monto en 0 o vacío quita el pago inicial. No entra en el MRR: no se repite.
        </p>
      </details>
    </section>
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
          {s.first_month_free && (
            <p className="text-xs font-semibold text-brand">
              {isFreeMonth(s, today)
                ? "Primer mes gratis — este mes no se cobra"
                : `Tuvo el primer mes gratis (${shortDate(s.starts_on)})`}
            </p>
          )}
          <p className="text-lg font-extrabold tabular-nums">{formatMoney(s.amount, s.currency)}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          {s.active && <StatusChip status={status} />}
          {/* `gratis` no lleva botón: ese mes no hay nada que cobrar. */}
          {s.active && (status === "pendiente" || status === "vencido") && (
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
          <label className="col-span-2">
            <span className="label">Arrancó el</span>
            <input
              name="starts_on"
              type="date"
              defaultValue={s.starts_on}
              className="field !min-h-[2.3rem] !text-sm"
            />
          </label>
          <label className="col-span-2 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="first_month_free"
              defaultChecked={s.first_month_free}
              className="h-4 w-4"
            />
            Primer mes gratis
          </label>
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
