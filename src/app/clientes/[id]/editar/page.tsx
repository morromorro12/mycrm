import { notFound } from "next/navigation";
import { ActionButton, SubmitButton } from "@/components/ActionButton";
import { BackLink, PageTitle } from "@/components/ui";
import { deleteClient, updateClient } from "@/lib/actions";
import { repo } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function EditClient({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await repo().getClient(id);
  if (!c) notFound();

  return (
    <div className="mx-auto max-w-lg">
      <BackLink href={`/clientes/${c.id}`}>{c.business_name}</BackLink>
      <PageTitle title="Editar cliente" subtitle="Los servicios se editan desde la ficha." />

      <form action={updateClient.bind(null, c.id)} className="grid gap-3">
        <label>
          <span className="label">Nombre del negocio *</span>
          <input name="business_name" required defaultValue={c.business_name} className="field" />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label>
            <span className="label">Contacto</span>
            <input name="contact_name" defaultValue={c.contact_name ?? ""} className="field" />
          </label>
          <label>
            <span className="label">WhatsApp</span>
            <input name="phone" type="tel" inputMode="tel" defaultValue={c.phone ?? ""} className="field" />
          </label>
        </div>
        <label>
          <span className="label">Notas de cuenta</span>
          <textarea name="notes" rows={3} defaultValue={c.notes ?? ""} className="field resize-y" />
        </label>
        <SubmitButton className="btn btn-primary">Guardar cambios</SubmitButton>
      </form>

      <div className="mt-6 flex justify-end">
        <ActionButton
          action={deleteClient.bind(null, c.id)}
          className="btn !text-sm text-bad"
          confirm={`¿Borrar "${c.business_name}"? Se borra también su historial de pagos. No se puede deshacer.`}
        >
          Borrar cliente
        </ActionButton>
      </div>
    </div>
  );
}
