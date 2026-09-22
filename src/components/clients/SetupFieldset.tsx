import { todayISO } from "@/lib/dates";

/**
 * Pago inicial en el alta del cliente. Dejarlo vacío es lo normal: no todos
 * los clientes tienen cobro de arranque.
 */
export function SetupFieldset() {
  return (
    <fieldset className="rounded-xl border border-line p-3">
      <legend className="px-1 text-xs font-bold uppercase tracking-wide text-muted">
        Pago inicial (opcional)
      </legend>

      <div className="grid grid-cols-2 gap-2">
        <label>
          <span className="label">Monto</span>
          <input
            name="setup_amount"
            type="number"
            min={0}
            step="1"
            inputMode="numeric"
            placeholder="28000"
            className="field !min-h-[2.5rem]"
          />
        </label>
        <label>
          <span className="label">Moneda</span>
          <select name="setup_currency" defaultValue="UYU" className="field !min-h-[2.5rem]">
            <option value="UYU">$U (pesos)</option>
            <option value="USD">US$ (dólares)</option>
          </select>
        </label>
        <label className="col-span-2">
          <span className="label">¿Para cuándo?</span>
          <input name="setup_due_on" type="date" defaultValue={todayISO()} className="field !min-h-[2.5rem]" />
        </label>
        <label className="col-span-2">
          <span className="label">Qué incluye</span>
          <input
            name="setup_note"
            placeholder="Armado del sitio + integración a WhatsApp"
            className="field !min-h-[2.5rem]"
          />
        </label>
      </div>

      <p className="mt-2 text-xs text-muted">
        El cobro de arranque, por única vez. No cuenta para el MRR. Si no hay, dejalo vacío.
      </p>
    </fieldset>
  );
}
