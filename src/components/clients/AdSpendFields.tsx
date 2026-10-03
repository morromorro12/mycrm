import type { AdCard, CurrencyCode } from "@/lib/types";

/**
 * La pauta en Meta de un servicio de Ads: cuánto quiere invertir el cliente
 * por mes y con qué tarjeta se paga. Va aparte de tus honorarios.
 *
 * Sin estado propio, así que sirve tanto en el alta (componente de cliente)
 * como en la ficha (componente de servidor). `suffix` distingue las filas
 * cuando hay varios servicios en el mismo form.
 */
export function AdSpendFields({
  suffix = "",
  budget,
  currency = "USD",
  card,
  requireCard = false,
  onlyWhenAds = false,
  fieldClass = "field",
}: {
  suffix?: string;
  budget?: number | null;
  currency?: CurrencyCode;
  card?: AdCard | null;
  /** En el alta se pide sí o sí: es lo que define si te toca cobrarla. */
  requireCard?: boolean;
  /** Forms de un solo servicio: se muestra sólo si el tipo elegido es Ads. */
  onlyWhenAds?: boolean;
  fieldClass?: string;
}) {
  return (
    <div
      className={`col-span-2 grid grid-cols-2 gap-2 rounded-lg border border-line p-2.5 ${onlyWhenAds ? "ads-only" : ""}`}
    >
      <p className="col-span-2 text-xs font-bold uppercase tracking-wide text-muted">
        Pauta en Meta
      </p>
      <label>
        <span className="label">Quiere invertir por mes</span>
        <input
          name={`ad_budget${suffix}`}
          type="number"
          min={0}
          step="1"
          inputMode="numeric"
          defaultValue={budget ?? ""}
          placeholder="300"
          className={fieldClass}
        />
      </label>
      <label>
        <span className="label">Moneda</span>
        <select name={`ad_currency${suffix}`} defaultValue={currency} className={fieldClass}>
          <option value="USD">US$ (dólares)</option>
          <option value="UYU">$U (pesos)</option>
        </select>
      </label>

      <fieldset className="col-span-2">
        <legend className="label">¿Con qué tarjeta se paga?</legend>
        <div className="grid grid-cols-2 gap-2">
          {(["cliente", "mia"] as const).map((v) => (
            <label
              key={v}
              className="flex items-center gap-2 rounded-lg border border-line bg-surface px-2.5 py-2 text-sm has-[:checked]:border-brand has-[:checked]:font-semibold"
            >
              <input
                type="radio"
                name={`ad_card${suffix}`}
                value={v}
                defaultChecked={card === v}
                required={requireCard}
                className="h-4 w-4"
              />
              {v === "cliente" ? "La del cliente" : "La mía"}
            </label>
          ))}
        </div>
      </fieldset>

      <p className="col-span-2 text-xs text-muted">
        Es plata del cliente, aparte de tus honorarios: no suma al MRR.
      </p>
    </div>
  );
}
