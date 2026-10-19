// Todo el CRM trabaja con fechas como string 'YYYY-MM-DD'.
// Evita por completo los líos de zona horaria: Vercel corre en UTC y vos
// estás en UTC-3, así que "hoy" se calcula siempre en hora uruguaya.

export const TZ = "America/Montevideo";

/** Hoy en Montevideo, como 'YYYY-MM-DD'. */
export function todayISO(): string {
  // 'en-CA' formatea justo como YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** Fecha corrida N días: addDays('2026-10-16', -1) → '2026-10-15'. */
export function addDays(iso: string, days: number): string {
  const t = Date.parse(`${iso}T00:00:00Z`) + days * 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
}

/** Sábado o domingo. */
export function isWeekend(iso: string): boolean {
  const d = new Date(`${iso}T12:00:00Z`).getUTCDay();
  return d === 0 || d === 6;
}

/** Día de la semana: 1 = lunes … 7 = domingo. */
export function isoWeekday(iso: string): number {
  const d = new Date(`${iso}T12:00:00Z`).getUTCDay();
  return d === 0 ? 7 : d;
}

/** El lunes de la semana de una fecha. */
export function weekStart(iso: string): string {
  return addDays(iso, 1 - isoWeekday(iso));
}

/** Que sea una fecha 'YYYY-MM-DD' de verdad, no cualquier texto. */
export function isISODate(s: unknown): s is string {
  return (
    typeof s === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(s) &&
    new Date(`${s}T12:00:00Z`).toISOString().slice(0, 10) === s
  );
}

/** Primer día del mes de una fecha: '2026-09-17' → '2026-09-01'. */
export function periodOf(iso: string): string {
  return `${iso.slice(0, 7)}-01`;
}

/** El período (mes) actual. */
export function currentPeriod(): string {
  return periodOf(todayISO());
}

export function daysInMonth(iso: string): number {
  const [y, m] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/**
 * Día de cobro real para el mes de `iso`.
 * Si cobrás el 31 y el mes tiene 30 días, vence el 30.
 */
export function effectiveBillingDay(billingDay: number, iso: string): number {
  return Math.min(billingDay, daysInMonth(iso));
}

export function dayOfMonth(iso: string): number {
  return Number(iso.slice(8, 10));
}

/** Diferencia en días entre dos fechas ISO (b - a). */
export function daysBetween(a: string, b: string): number {
  const ms = Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}

const MONTHS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "setiembre", "octubre", "noviembre", "diciembre",
];

/** '2026-09-17' → '17 set'. */
export function shortDate(iso: string): string {
  const d = dayOfMonth(iso);
  const m = MONTHS[Number(iso.slice(5, 7)) - 1].slice(0, 3);
  return `${d} ${m}`;
}

const WEEKDAY_NAMES = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];

/** '2026-10-19' → 'lunes 19'. */
export function weekdayDate(iso: string): string {
  return `${WEEKDAY_NAMES[isoWeekday(iso) - 1]} ${dayOfMonth(iso)}`;
}

/** Lunes '2026-10-19' → '19 al 25 de octubre'; si cruza de mes, con los dos. */
export function weekRangeLabel(monday: string): string {
  const sunday = addDays(monday, 6);
  const month = (iso: string) => MONTHS[Number(iso.slice(5, 7)) - 1];
  return month(monday) === month(sunday)
    ? `${dayOfMonth(monday)} al ${dayOfMonth(sunday)} de ${month(sunday)}`
    : `${dayOfMonth(monday)} de ${month(monday)} al ${dayOfMonth(sunday)} de ${month(sunday)}`;
}

/** '2026-09-01' → 'setiembre 2026'. */
export function periodLabel(iso: string): string {
  return `${MONTHS[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;
}

/**
 * Texto relativo para la lista de Atención hoy: 'hoy', 'mañana',
 * 'hace 3 días', 'en 5 días'.
 */
export function relativeDay(iso: string, today = todayISO()): string {
  const d = daysBetween(today, iso);
  if (d === 0) return "hoy";
  if (d === 1) return "mañana";
  if (d === -1) return "ayer";
  if (d < 0) return `hace ${-d} días`;
  return `en ${d} días`;
}
