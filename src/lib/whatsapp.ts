/**
 * Convierte un teléfono escrito a mano en un link de wa.me.
 * Acepta '099 123 456', '+598 99 123 456', '099123456', etc.
 *
 * Celulares uruguayos: 09X XXX XXX (9 dígitos con el 0 adelante).
 * wa.me necesita código de país sin '+' ni '0': 598 9X XXX XXX.
 */
export function waNumber(phone: string | null | undefined): string | null {
  if (!phone) return null;
  let d = phone.replace(/\D/g, "");
  if (!d) return null;

  if (d.startsWith("00")) d = d.slice(2); // 00598... → 598...
  if (d.startsWith("598")) return d.length >= 11 ? d : null;
  if (d.startsWith("0")) d = d.slice(1); // 099... → 99...
  if (d.length === 8) return `598${d}`; // celular uruguayo sin el 0
  if (d.length >= 10) return d; // ya trae código de país de otro país
  return null;
}

export function waLink(phone: string | null | undefined, text?: string): string | null {
  const n = waNumber(phone);
  if (!n) return null;
  const q = text ? `?text=${encodeURIComponent(text)}` : "";
  return `https://wa.me/${n}${q}`;
}

/** Cómo se ve el teléfono en pantalla: '099123456' → '099 123 456'. */
export function prettyPhone(phone: string | null | undefined): string {
  if (!phone) return "—";
  const d = phone.replace(/\D/g, "");
  if (d.length === 9 && d.startsWith("0")) {
    return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`;
  }
  return phone;
}
