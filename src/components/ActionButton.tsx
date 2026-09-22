"use client";

import { useFormStatus } from "react-dom";

/**
 * Botón que dispara una server action sin argumentos, con estado "haciendo…".
 * Se usa para las acciones de un solo toque (marcar pagado, posponer, etc.).
 */
function Inner({
  children,
  className,
  pendingLabel,
  title,
}: {
  children: React.ReactNode;
  className: string;
  pendingLabel?: string;
  title?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={className} title={title} aria-busy={pending}>
      {pending ? (pendingLabel ?? "…") : children}
    </button>
  );
}

export function ActionButton({
  action,
  children,
  className = "btn",
  pendingLabel,
  confirm,
  title,
}: {
  action: () => Promise<void>;
  children: React.ReactNode;
  className?: string;
  pendingLabel?: string;
  confirm?: string;
  title?: string;
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
      className="contents"
    >
      <Inner className={className} pendingLabel={pendingLabel} title={title}>
        {children}
      </Inner>
    </form>
  );
}

/** Botón de submit para formularios largos. */
export function SubmitButton({
  children,
  className = "btn btn-primary",
  pendingLabel = "Guardando…",
}: {
  children: React.ReactNode;
  className?: string;
  pendingLabel?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={className} aria-busy={pending}>
      {pending ? pendingLabel : children}
    </button>
  );
}
