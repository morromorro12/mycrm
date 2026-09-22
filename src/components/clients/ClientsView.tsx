"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ActionButton } from "@/components/ActionButton";
import { IconCheck } from "@/components/icons";
import { StatusChip, WhatsAppButton } from "@/components/ui";
import { markClientPaid } from "@/lib/actions";
import { clientStatus, serviceStatus } from "@/lib/billing";
import { effectiveBillingDay } from "@/lib/dates";
import { formatMoney, formatTotals, ZERO, addMoney } from "@/lib/money";
import { KIND_LABEL, type ClientFull, type PaymentStatus } from "@/lib/types";

/**
 * Tabla de clientes activos.
 * Celular → tarjetas apiladas. Desktop → tabla de verdad.
 * En ambas el estado va con color y el botón de "pagado" es un solo toque.
 */
export function ClientsView({ clients, today }: { clients: ClientFull[]; today: string }) {
  const [q, setQ] = useState("");
  const [onlyDue, setOnlyDue] = useState(false);

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return clients
      // Un cliente pausado no tiene estado de pago: `status` va en null.
      // Si no, la tabla lo mostraría en rojo mientras el dashboard lo ignora.
      .map((c) => ({ client: c, status: c.active ? clientStatus(c, today) : null }))
      .filter(({ client, status }) => {
        if (term && !client.business_name.toLowerCase().includes(term)) return false;
        if (onlyDue && status !== "vencido" && status !== "pendiente") return false;
        return true;
      })
      .sort((a, b) => {
        // Pausados últimos; entre los activos, primero lo que hay que cobrar.
        const rank = (s: PaymentStatus | null) =>
          s === null ? 3 : { vencido: 0, pendiente: 1, pagado: 2, gratis: 2 }[s];
        return (
          rank(a.status) - rank(b.status) ||
          a.client.business_name.localeCompare(b.client.business_name, "es")
        );
      });
  }, [clients, q, onlyDue, today]);

  const pendientes = clients.filter((c) => c.active && clientStatus(c, today) !== "pagado").length;

  return (
    <>
      <div className="mb-3 flex gap-2">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Filtrar por nombre…"
          aria-label="Filtrar clientes por nombre de negocio"
          className="field !min-h-[2.5rem] flex-1 text-sm"
        />
        <button
          type="button"
          onClick={() => setOnlyDue((v) => !v)}
          aria-pressed={onlyDue}
          className={`btn !min-h-[2.5rem] shrink-0 ${onlyDue ? "btn-primary" : ""}`}
        >
          Sin cobrar{pendientes > 0 && ` (${pendientes})`}
        </button>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line px-4 py-8 text-center text-sm text-muted">
          {clients.length === 0 ? "Todavía no cargaste clientes." : "Ningún cliente coincide."}
        </p>
      ) : (
        <>
          {/* Celular */}
          <ul className="grid gap-2 md:hidden">
            {rows.map(({ client, status }) => (
              <li key={client.id}>
                <Card client={client} status={status} today={today} />
              </li>
            ))}
          </ul>

          {/* Desktop */}
          <div className="hidden overflow-hidden rounded-xl border border-line md:block">
            <table className="w-full border-collapse text-sm">
              <thead className="bg-surface text-left text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-3 py-2 font-bold">Negocio</th>
                  <th className="px-3 py-2 font-bold">Servicios</th>
                  <th className="px-3 py-2 text-right font-bold">Mensual</th>
                  <th className="px-3 py-2 font-bold">Cobro</th>
                  <th className="px-3 py-2 font-bold">Estado</th>
                  <th className="px-3 py-2 text-right font-bold">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ client, status }) => (
                  <Row key={client.id} client={client} status={status} today={today} />
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}

function totals(client: ClientFull) {
  let t = ZERO;
  for (const s of client.services) if (s.active) t = addMoney(t, s.currency, s.amount);
  return formatTotals(t);
}

function billingDays(client: ClientFull, today: string) {
  const days = [
    ...new Set(
      client.services.filter((s) => s.active).map((s) => effectiveBillingDay(s.billing_day, today)),
    ),
  ].sort((a, b) => a - b);
  return days.length ? `día ${days.join(" y ")}` : "—";
}

const STRIPE: Record<PaymentStatus | "pausado", string> = {
  pagado: "border-l-ok",
  pendiente: "border-l-warn",
  vencido: "border-l-bad",
  gratis: "border-l-brand",
  pausado: "border-l-line",
};

const stripe = (s: PaymentStatus | null) => STRIPE[s ?? "pausado"];

/** Chip de estado, o la marca de pausado cuando el cliente no está activo. */
function RowStatus({ status }: { status: PaymentStatus | null }) {
  if (status === null) return <span className="chip bg-bg text-muted">Pausado</span>;
  return <StatusChip status={status} />;
}

function Card({
  client,
  status,
  today,
}: {
  client: ClientFull;
  status: PaymentStatus | null;
  today: string;
}) {
  return (
    <div className={`card border-l-4 p-3 ${stripe(status)} ${status === null ? "opacity-60" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <Link href={`/clientes/${client.id}`} className="min-w-0 flex-1">
          <p className="truncate font-bold leading-tight">{client.business_name}</p>
          <p className="truncate text-xs text-muted">
            {client.services.filter((s) => s.active).map((s) => KIND_LABEL[s.kind]).join(", ") ||
              "Sin servicios"}{" "}
            · {billingDays(client, today)}
          </p>
        </Link>
        <RowStatus status={status} />
      </div>

      <div className="mt-2 flex items-end justify-between gap-2">
        <div className="grid">
          {totals(client).map((t) => (
            <span key={t} className="text-lg font-extrabold tabular-nums">
              {t}
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <WhatsAppButton phone={client.phone} compact />
          {(status === "pendiente" || status === "vencido") && <PayButton client={client} />}
        </div>
      </div>
    </div>
  );
}

function Row({
  client,
  status,
  today,
}: {
  client: ClientFull;
  status: PaymentStatus | null;
  today: string;
}) {
  const active = client.services.filter((s) => s.active);
  return (
    <tr
      className={`border-t border-line border-l-4 bg-surface ${stripe(status)} ${
        status === null ? "opacity-60" : ""
      }`}
    >
      <td className="px-3 py-2">
        <Link href={`/clientes/${client.id}`} className="font-semibold hover:underline">
          {client.business_name}
        </Link>
        {client.contact_name && <p className="text-xs text-muted">{client.contact_name}</p>}
      </td>
      <td className="px-3 py-2 text-xs text-muted">
        {active.length === 0
          ? "—"
          : active.map((s) => (
              <span key={s.id} className="mr-1.5 inline-block whitespace-nowrap">
                {KIND_LABEL[s.kind]}{" "}
                <span
                  className={
                    serviceStatus(s, client.payments, today) === "pagado" ? "text-ok" : "text-muted"
                  }
                >
                  {formatMoney(s.amount, s.currency)}
                </span>
              </span>
            ))}
      </td>
      <td className="px-3 py-2 text-right font-bold tabular-nums">
        {totals(client).map((t) => (
          <div key={t}>{t}</div>
        ))}
      </td>
      <td className="whitespace-nowrap px-3 py-2 text-xs text-muted">{billingDays(client, today)}</td>
      <td className="px-3 py-2">
        <RowStatus status={status} />
      </td>
      <td className="px-3 py-2">
        <div className="flex justify-end gap-2">
          <WhatsAppButton phone={client.phone} compact />
          {(status === "pendiente" || status === "vencido") && <PayButton client={client} />}
        </div>
      </td>
    </tr>
  );
}

/** El botón de un click. Marca pagados todos los servicios que falten del mes. */
function PayButton({ client }: { client: ClientFull }) {
  const pending = client.services.filter((s) => s.active).length;
  return (
    <ActionButton
      action={markClientPaid.bind(null, client.id)}
      className="btn btn-primary !min-h-[2.2rem] !px-2.5 whitespace-nowrap"
      pendingLabel="…"
      title={
        pending > 1
          ? "Marcar pagados todos los servicios de este mes"
          : "Marcar pagado este mes"
      }
    >
      <IconCheck className="h-4 w-4" />
      Pagado
    </ActionButton>
  );
}
