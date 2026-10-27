/**
 * Lo tachado se sigue viendo una semana, abajo de todo, por si lo tachaste
 * sin querer. Después queda guardado pero ya no aparece.
 */
export const DONE_VISIBLE_DAYS = 7;

export function doneSince(now = Date.now()): string {
  return new Date(now - DONE_VISIBLE_DAYS * 86_400_000).toISOString();
}

/** Títulos listos para guardar: sin viñetas ni espacios de más, sin vacíos. */
export function cleanTitles(raw: string[]): string[] {
  return raw
    .map((t) =>
      t
        .replace(/\s+/g, " ")
        .replace(/^\s*[-•*·]\s*/, "")
        .slice(0, 200)
        .trim(),
    )
    .filter(Boolean);
}
