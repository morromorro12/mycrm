"use client";

import Link from "next/link";
import { deleteProspect, saveProspect } from "@/lib/actions";
import { todayISO } from "@/lib/dates";
import {
  INTEREST_LABEL,
  SOURCE_LABEL,
  STAGES,
  STAGE_LABEL,
  type LeadSource,
  type Prospect,
  type ServiceInterest,
} from "@/lib/types";
import { ActionButton, SubmitButton } from "./ActionButton";

const INTERESTS: ServiceInterest[] = ["web", "ads", "ambos"];
const SOURCES: LeadSource[] = ["frio", "in_person", "referido"];

export function ProspectForm({ prospect }: { prospect?: Prospect }) {
  const p = prospect;
  const today = todayISO();

  return (
    <>
      <form action={saveProspect.bind(null, p?.id ?? null)} className="grid gap-3">
        <label>
          <span className="label">Nombre del negocio *</span>
          <input
            name="business_name"
            required
            defaultValue={p?.business_name ?? ""}
            placeholder="Parrilla El Fogón"
            autoFocus={!p}
            className="field"
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label>
            <span className="label">Contacto</span>
            <input name="contact_name" defaultValue={p?.contact_name ?? ""} placeholder="Martín" className="field" />
          </label>
          <label>
            <span className="label">WhatsApp</span>
            <input
              name="phone"
              type="tel"
              inputMode="tel"
              defaultValue={p?.phone ?? ""}
              placeholder="099 123 456"
              className="field"
            />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label>
            <span className="label">Interés</span>
            <select name="service_interest" defaultValue={p?.service_interest ?? "web"} className="field">
              {INTERESTS.map((i) => (
                <option key={i} value={i}>
                  {INTEREST_LABEL[i]}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="label">Fuente</span>
            <select name="source" defaultValue={p?.source ?? "frio"} className="field">
              {SOURCES.map((s) => (
                <option key={s} value={s}>
                  {SOURCE_LABEL[s]}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label>
            <span className="label">Etapa</span>
            <select name="stage" defaultValue={p?.stage ?? "contactado"} className="field">
              {STAGES.map((s) => (
                <option key={s} value={s}>
                  {STAGE_LABEL[s]}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="label">Último contacto</span>
            <input
              name="last_contact_at"
              type="date"
              defaultValue={p?.last_contact_at ?? today}
              className="field"
            />
          </label>
        </div>

        {/* El bloque clave: lo que hace que el CRM te avise. */}
        <fieldset className="rounded-xl border border-brand/40 bg-brand/5 p-3">
          <legend className="px-1 text-xs font-bold uppercase tracking-wide text-brand">
            Próxima acción
          </legend>
          <label className="block">
            <span className="label">¿Qué hay que hacer?</span>
            <input
              name="next_action"
              defaultValue={p?.next_action ?? ""}
              placeholder="Llamar para cerrar la propuesta"
              className="field"
            />
          </label>
          <label className="mt-2 block">
            <span className="label">¿Cuándo?</span>
            <input
              name="next_action_at"
              type="date"
              defaultValue={p?.next_action_at ?? ""}
              className="field"
            />
          </label>
          <p className="mt-1.5 text-xs text-muted">
            Con fecha de hoy o anterior, aparece en “Atención hoy”.
          </p>
        </fieldset>

        <label>
          <span className="label">Notas</span>
          <textarea
            name="notes"
            rows={3}
            defaultValue={p?.notes ?? ""}
            placeholder="Qué le interesa, objeciones, contexto…"
            className="field resize-y"
          />
        </label>

        <div className="mt-1 flex gap-2">
          <SubmitButton className="btn btn-primary flex-1">
            {p ? "Guardar cambios" : "Crear prospecto"}
          </SubmitButton>
          <Link href="/pipeline" className="btn">
            Cancelar
          </Link>
        </div>
      </form>

      {p && (
        <div className="mt-4 flex justify-end">
          <ActionButton
            action={deleteProspect.bind(null, p.id)}
            className="btn !text-sm text-bad"
            confirm={`¿Borrar "${p.business_name}"? No se puede deshacer.`}
          >
            Borrar prospecto
          </ActionButton>
        </div>
      )}
    </>
  );
}
