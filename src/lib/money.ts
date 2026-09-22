import type { CurrencyCode } from "./types";

/** Montos por moneda. No se convierte entre monedas en ningún lado. */
export type MoneyByCurrency = Record<CurrencyCode, number>;

export const ZERO: MoneyByCurrency = { UYU: 0, USD: 0 };

export function addMoney(
  into: MoneyByCurrency,
  currency: CurrencyCode,
  amount: number,
): MoneyByCurrency {
  return { ...into, [currency]: into[currency] + amount };
}

const SYMBOL: Record<CurrencyCode, string> = { UYU: "$U", USD: "US$" };

export function formatMoney(amount: number, currency: CurrencyCode): string {
  // Los montos redondos van sin decimales ($U 6.500); los que tienen
  // centavos, siempre con dos (US$ 248,40).
  const decimals = Number.isInteger(amount) ? 0 : 2;
  const n = new Intl.NumberFormat("es-UY", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount);
  return `${SYMBOL[currency]} ${n}`;
}

/**
 * Muestra un total multimoneda. Omite las monedas en cero, salvo que todo
 * esté en cero (ahí muestra un solo '$U 0' para no dejar el hueco vacío).
 */
export function formatTotals(totals: MoneyByCurrency): string[] {
  const parts = (Object.keys(SYMBOL) as CurrencyCode[])
    .filter((c) => totals[c] !== 0)
    .map((c) => formatMoney(totals[c], c));
  return parts.length ? parts : [formatMoney(0, "UYU")];
}
