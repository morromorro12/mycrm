import { SubmitButton } from "@/components/ActionButton";
import { ServicesFieldset } from "@/components/clients/ServicesFieldset";
import { SetupFieldset } from "@/components/clients/SetupFieldset";
import { BackLink, PageTitle } from "@/components/ui";
import { createClient } from "@/lib/actions";
import { todayISO } from "@/lib/dates";

export default function NewClient() {
  return (
    <div className="mx-auto max-w-lg">
      <BackLink href="/clientes">Clientes</BackLink>
      <PageTitle title="Nuevo cliente" />

      <form action={createClient} className="grid gap-3">
        <label>
          <span className="label">Nombre del negocio *</span>
          <input
            name="business_name"
            required
            autoFocus
            placeholder="Resto La Pasiva Centro"
            className="field"
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label>
            <span className="label">Contacto</span>
            <input name="contact_name" placeholder="Gabriela" className="field" />
          </label>
          <label>
            <span className="label">WhatsApp</span>
            <input name="phone" type="tel" inputMode="tel" placeholder="099 123 456" className="field" />
          </label>
        </div>

        <SetupFieldset />

        <ServicesFieldset today={todayISO()} />

        <label>
          <span className="label">Notas de cuenta</span>
          <textarea
            name="notes"
            rows={3}
            placeholder="Cómo prefiere que le escribas, acuerdos, pendientes…"
            className="field resize-y"
          />
        </label>

        <SubmitButton className="btn btn-primary" pendingLabel="Creando…">
          Crear cliente
        </SubmitButton>
      </form>
    </div>
  );
}
