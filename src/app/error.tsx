"use client";

import { useEffect } from "react";

/**
 * Pantalla de error de la app. En producción Next oculta el mensaje real del
 * servidor, así que en vez de dejar un "server error" pelado se nombra la
 * causa que explica casi todos los casos acá: el código pide una columna que
 * la base todavía no tiene.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-md py-10 text-center">
      <h1 className="text-xl font-extrabold">Algo falló al leer los datos</h1>

      <p className="mt-2 text-sm text-muted">
        Casi siempre es lo mismo: se actualizó el código y falta correr la
        migración en Supabase.
      </p>

      <ol className="mx-auto mt-4 grid max-w-sm gap-1.5 text-left text-sm text-muted">
        <li>1. Abrí Supabase → SQL Editor → New query</li>
        <li>
          2. Pegá el contenido de <code className="font-mono text-ink">supabase/schema.sql</code>
        </li>
        <li>3. Run. Es idempotente: no toca tus datos</li>
      </ol>

      <button onClick={reset} className="btn btn-primary mt-5">
        Reintentar
      </button>

      {error.digest && (
        <p className="mt-4 font-mono text-xs text-muted">
          Referencia: {error.digest}
        </p>
      )}
      {error.message && !error.message.startsWith("An error occurred") && (
        <p className="mt-2 break-words text-left text-xs text-muted">{error.message}</p>
      )}
    </div>
  );
}
