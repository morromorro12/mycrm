import { notFound } from "next/navigation";
import { SubmitButton } from "@/components/ActionButton";
import { ServicesFieldset } from "@/components/clients/ServicesFieldset";
import { BackLink, PageTitle } from "@/components/ui";
import { convertProspect } from "@/lib/actions";
import { repo } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function ConvertProspect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = await repo().getProspect(id);
  if (!p) notFound();

  return (
    <div className="mx-auto max-w-lg">
      <BackLink href={`/prospectos/${p.id}`}>{p.business_name}</BackLink>
      <PageTitle
        title="Convertir a cliente"
        subtitle="Nombre y contacto vienen del prospecto. Cargá los servicios y montos."
      />

      <form action={convertProspect.bind(null, p.id)} className="grid gap-3">
        <label>
          <span className="label">Nombre del negocio *</span>
          <input name="business_name" required defaultValue={p.business_name} className="field" />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label>
            <span className="label">Contacto</span>
            <input name="contact_name" defaultValue={p.contact_name ?? ""} className="field" />
          </label>
          <label>
            <span className="label">WhatsApp</span>
            <input name="phone" type="tel" inputMode="tel" defaultValue={p.phone ?? ""} className="field" />
          </label>
        </div>

        <ServicesFieldset />

        <label>
          <span className="label">Notas de cuenta</span>
          <textarea name="notes" rows={3} defaultValue={p.notes ?? ""} className="field resize-y" />
        </label>

        <SubmitButton className="btn btn-primary" pendingLabel="Creando…">
          Crear cliente
        </SubmitButton>
      </form>
    </div>
  );
}
