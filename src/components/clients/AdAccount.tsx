import { ActionButton, SubmitButton } from "@/components/ActionButton";
import { WhatsAppButton } from "@/components/ui";
import { addAdMovement, deleteAdMovement } from "@/lib/actions";
import {
  adBalance,
  adCurrency,
  myCardAdService,
  paysAdsWithMyCard,
  sortedMovements,
} from "@/lib/ad-balance";
import { shortDate } from "@/lib/dates";
import { formatMoney, formatTotals, type MoneyByCurrency } from "@/lib/money";
import { AD_MOVEMENT_LABEL, type ClientFull, type CurrencyCode } from "@/lib/types";

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
 * La pauta que sale de tu tarjeta: lo que el cliente te va transfiriendo y lo
 * que Meta te va cobrando, con el saldo entre los dos. Va en la ficha, debajo
 * de los servicios.
 */
export function AdAccountSection({ client, today }: { client: ClientFull; today: string }) {
  const { transferred, spent, balance } = adBalance(client);
  const movements = sortedMovements(client);
  const svc = myCardAdService(client);
  const owed = CURRENCIES.filter((c) => balance[c] < 0);

  // El mensaje para pedirle lo que falta, con las cuentas a la vista.
  const ask =
    owed.length > 0
      ? `Hola${client.contact_name ? ` ${client.contact_name}` : ""}! Te paso cómo viene la pauta de Meta: ` +
        `me transferiste ${formatTotals(transferred).join(" + ")} y Meta me cobró ` +
        `${formatTotals(spent).join(" + ")}, así que quedan ` +
        `${owed.map((c) => formatMoney(-balance[c], c)).join(" y ")} pendientes.`
      : undefined;

  return (
    <section className="card mb-3 p-4">
      <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">
        Pauta con tu tarjeta
      </h2>

      {movements.length === 0 ? (
        <p className="text-sm text-muted">
          Meta le cobra la pauta de este cliente a tu tarjeta. Anotá acá lo que te
          transfiere y lo que te cobra Meta, y te queda el saldo a la vista.
        </p>
      ) : (
        <>
          <div className="grid gap-0.5">
            {(nonZero(balance).length ? nonZero(balance) : [adCurrency(client)]).map((c) => (
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
            Te transfirió {formatTotals(transferred).join(" + ")} · Meta te cobró{" "}
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

      <details className="mt-3">
        <summary className="cursor-pointer text-sm font-semibold text-brand">
          + Anotar transferencia o cobro de Meta
        </summary>
        <form action={addAdMovement.bind(null, client.id)} className="mt-2 grid grid-cols-2 gap-2">
          <fieldset className="col-span-2">
            <legend className="label">¿Qué pasó?</legend>
            <div className="grid grid-cols-2 gap-2">
              {(["transferencia", "gasto"] as const).map((k) => (
                <label
                  key={k}
                  className="flex items-center gap-2 rounded-lg border border-line bg-surface px-2.5 py-2 text-sm has-[:checked]:border-brand has-[:checked]:font-semibold"
                >
                  <input
                    type="radio"
                    name="kind"
                    value={k}
                    defaultChecked={k === "transferencia"}
                    className="h-4 w-4"
                  />
                  {k === "transferencia" ? "Me transfirió" : "Meta me cobró"}
                </label>
              ))}
            </div>
          </fieldset>
          <label>
            <span className="label">Monto</span>
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
            <select name="currency" defaultValue={adCurrency(client)} className="field">
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
            <input name="note" placeholder="Transferencia BROU, cierre de Meta…" className="field" />
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

      {movements.length > 0 && (
        <>
          <h3 className="mb-2 mt-4 text-xs font-bold uppercase tracking-wide text-muted">
            Movimientos
          </h3>
          <ul className="grid gap-1.5">
            {movements.map((m) => (
              <li
                key={m.id}
                className="flex min-w-0 items-center justify-between gap-2 rounded-lg bg-bg px-2.5 py-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{AD_MOVEMENT_LABEL[m.kind]}</p>
                  <p className="truncate text-xs text-muted">
                    {shortDate(m.moved_on)}
                    {m.note ? ` · ${m.note}` : ""}
                  </p>
                </div>
                <span
                  className={`shrink-0 text-sm font-bold tabular-nums ${
                    m.kind === "transferencia" ? "text-ok" : ""
                  }`}
                >
                  {m.kind === "transferencia" ? "+" : "−"} {formatMoney(m.amount, m.currency)}
                </span>
                <ActionButton
                  action={deleteAdMovement.bind(null, m.id)}
                  className="btn !min-h-[1.9rem] !px-2 !text-xs text-muted"
                  confirm="¿Borrar este movimiento de la pauta?"
                  pendingLabel="…"
                  title="Deshacer este movimiento"
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
