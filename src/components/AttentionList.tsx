import Link from "next/link";
import { markClientPaid, markSetupPaid, snoozeProspect, touchProspect } from "@/lib/actions";
import type { AttentionItem } from "@/lib/billing";
import { relativeDay } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { KIND_LABEL, STAGE_LABEL } from "@/lib/types";
import { ActionButton } from "./ActionButton";
import { Empty, WhatsAppButton } from "./ui";

/**
 * "Atención hoy": lo único que mirás si tenés 30 segundos.
 * Cada fila trae las acciones resueltas ahí mismo, sin entrar a la ficha.
 */
export function AttentionList({ items }: { items: AttentionItem[] }) {
  if (items.length === 0) {
    return <Empty>Nada pendiente para hoy. Todo al día. ✨</Empty>;
  }

  return (
    <ul className="grid gap-2">
      {items.map((item) =>
        item.kind === "client" ? (
          <ClientRow key={`c-${item.client.id}-${item.setup ? "ini" : "mes"}`} item={item} />
        ) : (
          <ProspectRow key={`p-${item.prospect.id}`} item={item} />
        ),
      )}
    </ul>
  );
}

function ClientRow({ item }: { item: Extract<AttentionItem, { kind: "client" }> }) {
  const { client, services, status } = item;
  const overdue = status === "vencido";

  // El pago inicial es otro cobro, con otro monto y su propio botón.
  const total = item.setup
    ? formatMoney(client.setup_amount ?? 0, client.setup_currency)
    : services.map((s) => formatMoney(s.amount, s.currency)).join(" + ");
  const detail = item.setup
    ? (client.setup_note ?? "Pago inicial")
    : services.map((s) => KIND_LABEL[s.kind]).join(", ");
  const chip = item.setup
    ? overdue
      ? "Pago inicial vencido"
      : "Pago inicial pendiente"
    : overdue
      ? "Cobro vencido"
      : "Vence hoy";

  return (
    <li className={`card p-3 ${overdue ? "border-l-4 border-l-bad" : "border-l-4 border-l-warn"}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <span className={`chip ${overdue ? "bg-bad-bg text-bad" : "bg-warn-bg text-warn"}`}>
            {chip}
          </span>
          <Link href={`/clientes/${client.id}`} className="mt-1.5 block truncate font-bold hover:underline">
            {client.business_name}
          </Link>
          <p className="truncate text-sm text-muted">
            {total} · {detail}
          </p>
        </div>
      </div>

      <div className="mt-2.5 flex flex-wrap gap-2">
        <ActionButton
          action={
            item.setup
              ? markSetupPaid.bind(null, client.id)
              : markClientPaid.bind(null, client.id)
          }
          className="btn btn-primary !min-h-[2.3rem] flex-1 md:flex-none"
          pendingLabel="Marcando…"
        >
          {item.setup ? "Cobré el inicial" : "Marcar pagado"}
        </ActionButton>
        <WhatsAppButton
          phone={client.phone}
          compact
          text={`Hola ${client.contact_name ?? ""}! Te escribo por el ${
            item.setup ? "pago inicial" : "pago de este mes"
          }.`.replace("  ", " ")}
        />
      </div>
    </li>
  );
}

function ProspectRow({ item }: { item: Extract<AttentionItem, { kind: "prospect" }> }) {
  const { prospect: p, date, overdue } = item;

  return (
    <li className={`card p-3 ${overdue ? "border-l-4 border-l-warn" : "border-l-4 border-l-brand"}`}>
      <div className="min-w-0">
        <span className="chip bg-bg text-muted">{STAGE_LABEL[p.stage]}</span>
        <Link href={`/prospectos/${p.id}`} className="mt-1.5 block truncate font-bold hover:underline">
          {p.business_name}
        </Link>
        <p className="text-sm">
          {p.next_action ?? "Seguimiento"}{" "}
          <span className={overdue ? "font-semibold text-warn" : "text-muted"}>
            · {relativeDay(date)}
          </span>
        </p>
      </div>

      <div className="mt-2.5 flex flex-wrap gap-2">
        <WhatsAppButton
          phone={p.phone}
          className="flex-1 !min-h-[2.3rem] md:flex-none"
          text={`Hola ${p.contact_name ?? ""}! Te escribo de parte del estudio.`.replace("  ", " ")}
        />
        <ActionButton
          action={touchProspect.bind(null, p.id)}
          className="btn !min-h-[2.3rem]"
          title="Marcar que hablaste hoy"
          pendingLabel="…"
        >
          Hablé hoy
        </ActionButton>
        <ActionButton
          action={snoozeProspect.bind(null, p.id, 3)}
          className="btn !min-h-[2.3rem]"
          title="Posponer 3 días"
          pendingLabel="…"
        >
          +3d
        </ActionButton>
      </div>
    </li>
  );
}
