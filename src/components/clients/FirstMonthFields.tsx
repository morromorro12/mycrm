import type { ClientService } from "@/lib/types";

type Mode = "normal" | "gratis" | "descuento";

/**
 * La promo de cierre del servicio: el primer mes a precio normal, gratis, o
 * con descuento. Con descuento aparece el monto de ese mes (por CSS, en
 * globals.css), así que no necesita estado y sirve en server y client.
 * `suffix` distingue las filas cuando hay varios servicios en el mismo form.
 */
export function FirstMonthFields({
  suffix = "",
  service,
  fieldClass = "field",
}: {
  suffix?: string;
  service?: Pick<ClientService, "first_month_free" | "first_month_amount">;
  fieldClass?: string;
}) {
  const mode: Mode = service?.first_month_free
    ? "gratis"
    : service?.first_month_amount != null
      ? "descuento"
      : "normal";

  return (
    <div className="first-month col-span-2 grid grid-cols-2 gap-2">
      <label>
        <span className="label">Primer mes</span>
        <select name={`first_month${suffix}`} defaultValue={mode} className={fieldClass}>
          <option value="normal">Precio normal</option>
          <option value="gratis">Gratis</option>
          <option value="descuento">Con descuento</option>
        </select>
      </label>
      <label className="discount-only">
        <span className="label">Ese mes le cobrás</span>
        <input
          name={`first_month_amount${suffix}`}
          type="number"
          min={0}
          step="1"
          inputMode="numeric"
          defaultValue={service?.first_month_amount ?? ""}
          placeholder="3250"
          className={fieldClass}
        />
      </label>
    </div>
  );
}
