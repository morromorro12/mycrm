import { ActionButton, SubmitButton } from "@/components/ActionButton";
import { WhatsAppButton } from "@/components/ui";
import { addAdMovement, deleteAdMovement, saveAdSpent } from "@/lib/actions";
import {
  adBalance,
  adCurrency,
  myCardAdService,
  paysAdsWithMyCard,
  sortedTransfers,
} from "@/lib/ad-balance";
import { relativeDay, shortDate } from "@/lib/dates";
import { formatMoney, formatTotals, type MoneyByCurrency } from "@/lib/money";
import type { ClientFull, CurrencyCode } from "@/lib/types";

const CURRENCIES: CurrencyCode[] = ["USD", "UYU"];

/** Las monedas con saldo distinto de cero. Sin ninguna, el cliente está al día. */
const nonZero = (b: MoneyByCurrency) => CURRENCIES.filter((c) => b[c] !== 0);

/**
 * El saldo de la pauta en un vistazo: rojo si te debe, verde si tiene plata
 * a favor. Un chip por moneda, porque pesos y dólares no se compensan.
 */
export function AdBalanceChips({ balance }: { balance: MoneyByCurrency }) {
  const curs = nonZero(balance);
  if (curs.length === 0) return <span className="chip bg-bg text-muted">Al día</span>;

  return (
    <span className="flex flex-wrap justify-end gap-1">
      {curs.map((c) => (
        <span
          key={c}
          className={`chip tabular-nums ${balance[c] < 0 ? "bg-bad-bg text-bad" : "bg-ok-bg text-ok"}`}
        >
          {balance[c] < 0 ? "Te debe" : "A favor"} {formatMoney(Math.abs(balance[c]), c)}
        </span>
      ))}
    </span>
  );
}

/**
 * La pauta que sale de tu tarjeta: lo que el cliente te va transfiriendo,
 * lo que lleva gastado la campaña, y el saldo entre los dos. Va en la ficha,
 * debajo de los servicios.
 */
export function AdAccountSection({ client, today }: { client: ClientFull; today: string }) {
  const { transferred, spent, balance } = adBalance(client);
  const list = sortedTransfers(client);
  const svc = myCardAdService(client);
  const cur = adCurrency(client);
  const owed = CURRENCIES.filter((c) => balance[c] < 0);
  const started = list.length > 0 || client.ad_spent != null;

  // El mensaje para pedirle lo que falta, con las cuentas a la vista.
  const ask =
    owed.length > 0
      ? `Hola${client.contact_name ? ` ${client.contact_name}` : ""}! Te paso cómo viene la pauta de Meta: ` +
        `me transferiste ${formatTotals(transferred).join(" + ")} y la campaña lleva gastado ` +
        `${formatTotals(spent).join(" + ")}, así que quedan ` +
        `${owed.map((c) => formatMoney(-balance[c], c)).join(" y ")} pendientes.`
      : undefined;

  return (
    <section className="card mb-3 p-4">
      <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">
        Pauta con tu tarjeta
      </h2>

      {!started ? (
        <p className="text-sm text-muted">
          Meta le cobra la pauta de este cliente a tu tarjeta. Anotá lo que te
          transfiere y cuánto lleva gastado la campaña, y te queda el saldo a la vista.
        </p>
      ) : (
        <>
          <div className="grid gap-0.5">
            {(nonZero(balance).length ? nonZero(balance) : [cur]).map((c) => (
              <p key={c} className="flex flex-wrap items-baseline gap-x-2">
                <span
                  className={`text-2xl font-extrabold tabular-nums ${
                    balance[c] < 0 ? "text-bad" : balance[c] > 0 ? "text-ok" : ""
                  }`}
                >
                  {formatMoney(Math.abs(balance[c]), c)}
                </span>
                <span className="text-sm font-semibold text-muted">
                  {balance[c] < 0 ? "te debe" : balance[c] > 0 ? "le quedan sin gastar" : "al día"}
                </span>
              </p>
            ))}
          </div>
          <p className="mt-1 text-xs text-muted">
            Te transfirió {formatTotals(transferred).join(" + ")} · Gastado{" "}
            {formatTotals(spent).join(" + ")}
          </p>
        </>
      )}

      {svc?.ad_budget != null && (
        <p className="mt-1 text-xs text-muted">
          Pauta acordada: {formatMoney(svc.ad_budget, svc.ad_currency)} por mes
        </p>
      )}
      {!paysAdsWithMyCard(client) && (
        <p className="mt-1 text-xs font-semibold text-warn">
          La pauta ya no va con tu tarjeta. Esto queda hasta que el saldo esté en cero.
        </p>
      )}

      {ask && (
        <WhatsAppButton phone={client.phone} text={ask} className="mt-2.5 w-full md:w-auto" />
      )}

      {/* Lo gastado: un solo número que se pisa, no una lista que se suma.
          La key rearma el form al guardar, para que la moneda no vuelva a la
          que tenía al montarse. */}
      <form
        key={`${client.ad_spent}|${client.ad_spent_currency}`}
        action={saveAdSpent.bind(null, client.id)}
        className="mt-3 rounded-xl border border-line p-3"
      >
        <label htmlFor={`ad-spent-${client.id}`} className="label">
          Gastado en la campaña
        </label>
        <div className="flex gap-2">
          <input
            id={`ad-spent-${client.id}`}
            name="ad_spent"
            type="number"
            min={0}
            step="0.01"
            inputMode="decimal"
            defaultValue={client.ad_spent ?? ""}
            placeholder="0"
            className="field min-w-0 flex-1 tabular-nums"
          />
          <select
            name="ad_spent_currency"
            defaultValue={cur}
            aria-label="Moneda de lo gastado"
            className="field !w-auto"
          >
            <option value="USD">US$</option>
            <option value="UYU">$U</option>
          </select>
          <SubmitButton className="btn btn-primary shrink-0" pendingLabel="…">
            Guardar
          </SubmitButton>
        </div>
        <p className="mt-1.5 text-xs text-muted">
          El total desde que la pagás vos. Cuando cambie en Meta, poné el número
          nuevo: reemplaza al anterior, no se suma.
          {client.ad_spent_on && ` Actualizado ${relativeDay(client.ad_spent_on, today)}.`}
        </p>
      </form>

      <details className="mt-3">
        <summary className="cursor-pointer text-sm font-semibold text-brand">
          + Anotar transferencia
        </summary>
        <form action={addAdMovement.bind(null, client.id)} className="mt-2 grid grid-cols-2 gap-2">
          <label>
            <span className="label">Te transfirió</span>
            <input
              name="amount"
              type="number"
              min={0.01}
              step="0.01"
              inputMode="decimal"
              required
              placeholder={svc?.ad_budget != null ? String(svc.ad_budget) : "300"}
              className="field"
            />
          </label>
          <label>
            <span className="label">Moneda</span>
            <select name="currency" defaultValue={cur} className="field">
              <option value="USD">US$ (dólares)</option>
              <option value="UYU">$U (pesos)</option>
            </select>
          </label>
          <label className="col-span-2">
            <span className="label">Fecha</span>
            <input name="moved_on" type="date" defaultValue={today} className="field" />
          </label>
          <label className="col-span-2">
            <span className="label">Nota (opcional)</span>
            <input name="note" placeholder="Transferencia BROU, Mi Dinero…" className="field" />
          </label>
          <div className="col-span-2">
            <SubmitButton className="btn btn-primary w-full" pendingLabel="Anotando…">
              Anotar
            </SubmitButton>
          </div>
        </form>
        <p className="mt-1.5 text-xs text-muted">
          Es plata del cliente para Meta, no ingreso tuyo: no suma al MRR ni al total cobrado.
        </p>
      </details>

      {list.length > 0 && (
        <>
          <h3 className="mb-2 mt-4 text-xs font-bold uppercase tracking-wide text-muted">
            Transferencias
          </h3>
          <ul className="grid gap-1.5">
            {list.map((m) => (
              <li
                key={m.id}
                className="flex min-w-0 items-center justify-between gap-2 rounded-lg bg-bg px-2.5 py-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">Te transfirió</p>
                  <p className="truncate text-xs text-muted">
                    {shortDate(m.moved_on)}
                    {m.note ? ` · ${m.note}` : ""}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-bold tabular-nums text-ok">
                  + {formatMoney(m.amount, m.currency)}
                </span>
                <ActionButton
                  action={deleteAdMovement.bind(null, m.id)}
                  className="btn !min-h-[1.9rem] !px-2 !text-xs text-muted"
                  confirm="¿Borrar esta transferencia?"
                  pendingLabel="…"
                  title="Deshacer esta transferencia"
                >
                  ✕
                </ActionButton>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
