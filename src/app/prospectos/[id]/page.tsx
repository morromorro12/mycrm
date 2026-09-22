import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionButton } from "@/components/ActionButton";
import { ProspectForm } from "@/components/ProspectForm";
import { BackLink, PageTitle, WhatsAppButton } from "@/components/ui";
import { restoreProspect } from "@/lib/actions";
import { repo } from "@/lib/data";
import { shortDate } from "@/lib/dates";
import { STAGE_LABEL } from "@/lib/types";
import { prettyPhone } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";

export default async function ProspectDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = await repo().getProspect(id);
  if (!p) notFound();

  return (
    <div className="mx-auto max-w-lg">
      <BackLink href={p.archived ? "/archivados" : "/pipeline"}>
        {p.archived ? "Archivados" : "Pipeline"}
      </BackLink>

      {p.archived && (
        <div className="card mb-3 flex flex-wrap items-center justify-between gap-2 border-warn/40 bg-warn-bg p-3">
          <p className="text-sm font-semibold text-warn">Archivado. No aparece en el pipeline.</p>
          <ActionButton
            action={restoreProspect.bind(null, p.id)}
            className="btn btn-primary !min-h-[2.2rem] !text-sm"
            pendingLabel="…"
          >
            Restaurar
          </ActionButton>
        </div>
      )}

      <PageTitle
        title={p.business_name}
        subtitle={`${STAGE_LABEL[p.stage]}${p.last_contact_at ? ` · último contacto ${shortDate(p.last_contact_at)}` : ""}`}
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <WhatsAppButton
          phone={p.phone}
          className="flex-1 md:flex-none"
          text={`Hola ${p.contact_name ?? ""}!`.replace("  ", " ")}
        />
        {p.phone && (
          <a href={`tel:${p.phone.replace(/\s/g, "")}`} className="btn">
            Llamar {prettyPhone(p.phone)}
          </a>
        )}
      </div>

      {/* Ganado y todavía sin ficha de cliente: el paso siguiente obvio. */}
      {p.stage === "ganado" && !p.converted_client_id && (
        <div className="card mb-4 border-ok/40 bg-ok-bg p-3">
          <p className="text-sm font-semibold text-ok">¡Ganado! Falta darlo de alta como cliente.</p>
          <Link href={`/prospectos/${p.id}/convertir`} className="btn btn-primary mt-2 w-full">
            Convertir a cliente
          </Link>
        </div>
      )}
      {p.converted_client_id && (
        <div className="card mb-4 p-3">
          <p className="text-sm text-muted">Ya es cliente activo.</p>
          <Link href={`/clientes/${p.converted_client_id}`} className="btn mt-2 w-full">
            Ver ficha del cliente →
          </Link>
        </div>
      )}

      <ProspectForm prospect={p} />
    </div>
  );
}
