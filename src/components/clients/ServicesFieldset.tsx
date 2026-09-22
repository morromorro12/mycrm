"use client";

import { useState } from "react";
import { KIND_LABEL, type ServiceKind } from "@/lib/types";

const KINDS: ServiceKind[] = ["web", "retainer", "ads"];

interface Row {
  key: number;
  kind: ServiceKind;
  amount: string;
  currency: "UYU" | "USD";
  day: string;
  startsOn: string;
  free: boolean;
}

const blank = (key: number, today: string): Row => ({
  key,
  kind: "retainer",
  amount: "",
  currency: "UYU",
  day: "1",
  startsOn: today,
  free: false,
});

/**
 * Filas de servicios contratados. Cada una con su monto, su moneda y su día
 * de cobro — un cliente puede tener web + retainer + ads al mismo tiempo.
 */
export function ServicesFieldset({ today }: { today: string }) {
  const [rows, setRows] = useState<Row[]>([blank(0, today)]);
  const [seq, setSeq] = useState(1);

  const patch = (key: number, p: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...p } : r)));

  return (
    <fieldset className="rounded-xl border border-line p-3">
      <legend className="px-1 text-xs font-bold uppercase tracking-wide text-muted">
        Servicios contratados
      </legend>

      <div className="grid gap-3">
        {rows.map((r, i) => (
          <div key={r.key} className="grid grid-cols-2 gap-2 border-t border-line pt-3 first:border-0 first:pt-0">
            <label>
              <span className="label">Servicio</span>
              <select
                name="svc_kind"
                value={r.kind}
                onChange={(e) => patch(r.key, { kind: e.target.value as ServiceKind })}
                className="field !min-h-[2.5rem]"
              >
                {KINDS.map((k) => (
                  <option key={k} value={k}>
                    {KIND_LABEL[k]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="label">Día de cobro</span>
              <input
                name="svc_day"
                type="number"
                min={1}
                max={31}
                value={r.day}
                onChange={(e) => patch(r.key, { day: e.target.value })}
                className="field !min-h-[2.5rem]"
              />
            </label>
            <label>
              <span className="label">Monto mensual</span>
              <input
                name="svc_amount"
                type="number"
                min={0}
                step="1"
                inputMode="numeric"
                value={r.amount}
                onChange={(e) => patch(r.key, { amount: e.target.value })}
                placeholder="6500"
                className="field !min-h-[2.5rem]"
              />
            </label>
            <label>
              <span className="label">Moneda</span>
              <select
                name="svc_currency"
                value={r.currency}
                onChange={(e) => patch(r.key, { currency: e.target.value as "UYU" | "USD" })}
                className="field !min-h-[2.5rem]"
              >
                <option value="UYU">$U (pesos)</option>
                <option value="USD">US$ (dólares)</option>
              </select>
            </label>

            <label className="col-span-2">
              <span className="label">Arranca el</span>
              <input
                name="svc_starts_on"
                type="date"
                value={r.startsOn}
                onChange={(e) => patch(r.key, { startsOn: e.target.value })}
                className="field !min-h-[2.5rem]"
              />
            </label>
            <label className="col-span-2 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={r.free}
                onChange={(e) => patch(r.key, { free: e.target.checked })}
                className="h-4 w-4"
              />
              Primer mes gratis
              {/* El valor es el índice: así el server sabe qué fila va gratis. */}
              {r.free && <input type="hidden" name="svc_free" value={i} />}
            </label>

            {rows.length > 1 && (
              <button
                type="button"
                onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}
                className="col-span-2 justify-self-start text-xs font-semibold text-bad"
              >
                Quitar servicio {i + 1}
              </button>
            )}
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => {
          setRows((rs) => [...rs, blank(seq, today)]);
          setSeq((s) => s + 1);
        }}
        className="mt-3 text-sm font-semibold text-brand"
      >
        + Otro servicio
      </button>
      <p className="mt-1 text-xs text-muted">
        Las filas sin monto se ignoran. Después podés agregar más desde la ficha.
      </p>
    </fieldset>
  );
}
