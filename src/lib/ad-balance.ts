import { ZERO, addMoney, type MoneyByCurrency } from "./money";
import type { AdMovement, ClientFull, CurrencyCode } from "./types";

// ============================================================================
// Pauta con tu tarjeta. Cuando Meta le cobra la pauta de un cliente a TU
// tarjeta, el cliente te la va transfiriendo. Esto lleva esa cuenta: la suma
// de lo que te pasó menos lo que lleva gastado la campaña. Lo gastado NO es
// una suma: es un solo número que vas pisando con lo que dice Meta
// (`ad_spent`). Es plata del cliente, no ingreso tuyo: no toca el MRR, ni el
// total cobrado, ni el estado de pago de los honorarios.
// ============================================================================

type AdAccountFields = Pick<ClientFull, "ad_movements" | "ad_spent" | "ad_spent_currency">;

export interface AdBalance {
  transferred: MoneyByCurrency;
  /** Lo gastado, en su única moneda; la otra va en cero. */
  spent: MoneyByCurrency;
  /**
   * transferred − spent, por moneda. Positivo: tenés plata del cliente sin
   * gastar. Negativo: pusiste de tu bolsillo y te lo debe.
   */
  balance: MoneyByCurrency;
}

// Los montos tienen centavos: sin redondear, 800 − 862,3 da −62,30000000000007
// y un saldo saldado podría no dar cero justo.
const cents = (n: number) => Math.round(n * 100) / 100;
const round = (m: MoneyByCurrency): MoneyByCurrency => ({ UYU: cents(m.UYU), USD: cents(m.USD) });

export function adBalance(client: AdAccountFields): AdBalance {
  let transferred = ZERO;
  for (const m of transfers(client)) transferred = addMoney(transferred, m.currency, m.amount);
  const spent = addMoney(ZERO, client.ad_spent_currency, client.ad_spent ?? 0);
  return {
    transferred: round(transferred),
    spent: round(spent),
    balance: {
      UYU: cents(transferred.UYU - spent.UYU),
      USD: cents(transferred.USD - spent.USD),
    },
  };
}

/** ¿Algún servicio de Ads activo se paga con tu tarjeta? */
export function paysAdsWithMyCard(client: ClientFull): boolean {
  return client.services.some((s) => s.active && s.kind === "ads" && s.ad_card === "mia");
}

/**
 * ¿Este cliente lleva cuenta de pauta? Sí si se paga con tu tarjeta. Si pasó a
 * pagar con la suya, la cuenta sigue a la vista mientras quede saldo: lo que
 * te debía no desaparece por cambiar de tarjeta.
 */
export function hasAdAccount(client: ClientFull): boolean {
  if (paysAdsWithMyCard(client)) return true;
  if (client.ad_movements.length === 0 && client.ad_spent == null) return false;
  const { balance } = adBalance(client);
  return balance.UYU !== 0 || balance.USD !== 0;
}

/** La pauta acordada del servicio que va con tu tarjeta, para tener de referencia. */
export function myCardAdService(client: ClientFull) {
  return client.services.find((s) => s.active && s.kind === "ads" && s.ad_card === "mia");
}

/**
 * Moneda con la que se anota por defecto: la de lo gastado si ya está
 * cargado, y si no la de esa pauta.
 */
export function adCurrency(client: ClientFull): CurrencyCode {
  if (client.ad_spent != null) return client.ad_spent_currency;
  return myCardAdService(client)?.ad_currency ?? "USD";
}

/** Las transferencias del cliente. Los `gasto` de la primera versión no cuentan. */
function transfers(client: Pick<ClientFull, "ad_movements">): AdMovement[] {
  return client.ad_movements.filter((m) => m.kind === "transferencia");
}

/** Del más nuevo al más viejo. A igual fecha, la última anotada arriba. */
export function sortedTransfers(client: ClientFull): AdMovement[] {
  return transfers(client)
    .reverse()
    .sort((a, b) => b.moved_on.localeCompare(a.moved_on));
}

export interface AdOverview {
  /** Lo que te deben entre todos: la suma de los saldos negativos, en positivo. */
  owed: MoneyByCurrency;
  /** Plata de clientes que tenés sin gastar: la suma de los saldos positivos. */
  held: MoneyByCurrency;
  /** Cuántos clientes te deben algo, en cualquier moneda. */
  owing: number;
  /** Los clientes con cuenta de pauta, los que más deben primero. */
  rows: { client: ClientFull; balance: MoneyByCurrency }[];
}

/**
 * La foto de todos juntos para el dashboard. Incluye a los pausados: pausar a
 * un cliente no salda lo que te debe.
 */
export function adOverview(clients: ClientFull[]): AdOverview {
  let owed = ZERO;
  let held = ZERO;
  let owing = 0;
  const rows: AdOverview["rows"] = [];

  for (const c of clients) {
    if (!hasAdAccount(c)) continue;
    const { balance } = adBalance(c);
    let owes = false;
    for (const cur of ["UYU", "USD"] as CurrencyCode[]) {
      if (balance[cur] < 0) {
        owed = addMoney(owed, cur, -balance[cur]);
        owes = true;
      } else if (balance[cur] > 0) {
        held = addMoney(held, cur, balance[cur]);
      }
    }
    if (owes) owing++;
    rows.push({ client: c, balance });
  }

  // Sin convertir monedas: primero los que deben en alguna, después el resto.
  const debt = (b: MoneyByCurrency) => (b.UYU < 0 || b.USD < 0 ? 0 : 1);
  rows.sort(
    (a, b) =>
      debt(a.balance) - debt(b.balance) ||
      a.client.business_name.localeCompare(b.client.business_name, "es"),
  );

  return { owed: round(owed), held: round(held), owing, rows };
}
