import Link from "next/link";
import type { PaymentStatus } from "@/lib/types";
import { prettyPhone, waLink } from "@/lib/whatsapp";
import { IconWhatsApp } from "./icons";

const STATUS_STYLE: Record<PaymentStatus, string> = {
  pagado: "bg-ok-bg text-ok",
  pendiente: "bg-warn-bg text-warn",
  vencido: "bg-bad-bg text-bad",
};

const STATUS_LABEL: Record<PaymentStatus, string> = {
  pagado: "Pagado",
  pendiente: "Pendiente",
  vencido: "Vencido",
};

/** Verde / amarillo / rojo. El punto ayuda si mirás la pantalla de reojo. */
export function StatusChip({ status }: { status: PaymentStatus }) {
  return (
    <span className={`chip ${STATUS_STYLE[status]}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
      {STATUS_LABEL[status]}
    </span>
  );
}

/** Abre wa.me con el número ya cargado. Si no hay teléfono válido, no aparece. */
export function WhatsAppButton({
  phone,
  text,
  compact = false,
  className = "",
}: {
  phone: string | null | undefined;
  text?: string;
  compact?: boolean;
  className?: string;
}) {
  const href = waLink(phone, text);
  if (!href) return null;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Escribir por WhatsApp al ${prettyPhone(phone)}`}
      title={`WhatsApp · ${prettyPhone(phone)}`}
      className={`btn btn-wa ${compact ? "!min-h-[2.2rem] !px-2.5" : ""} ${className}`}
    >
      <IconWhatsApp className="h-[18px] w-[18px]" />
      {!compact && "WhatsApp"}
    </a>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed border-line px-4 py-8 text-center text-sm text-muted">
      {children}
    </p>
  );
}

export function PageTitle({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div>
        <h1 className="text-xl font-bold tracking-tight md:text-2xl">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-ink">
      ← {children}
    </Link>
  );
}
