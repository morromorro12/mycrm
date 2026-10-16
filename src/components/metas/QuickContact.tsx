"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { quickAddProspect, type QuickAddState } from "@/lib/actions";
import {
  INTEREST_LABEL,
  SOURCE_LABEL,
  type LeadSource,
  type ServiceInterest,
} from "@/lib/types";

const SOURCES: LeadSource[] = ["frio", "in_person", "referido"];
const INTERESTS: ServiceInterest[] = ["web", "ads", "ambos"];

/**
 * Anotar un negocio contactado en dos toques. Fuente e interés quedan como
 * los dejaste: si salís a recorrer locales, todos son "In-person" sin tocar
 * nada. Después de anotar, el cursor vuelve al nombre para el siguiente.
 */
export function QuickContact() {
  const [state, action, pending] = useActionState<QuickAddState, FormData>(
    quickAddProspect,
    null,
  );
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [source, setSource] = useState<LeadSource>("frio");
  const [interest, setInterest] = useState<ServiceInterest>("web");
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!state?.ok) return;
    setName("");
    setPhone("");
    nameRef.current?.focus();
  }, [state]);

  return (
    <form action={action} className="grid gap-2.5">
      <input
        ref={nameRef}
        name="business_name"
        required
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Nombre del negocio"
        autoComplete="off"
        enterKeyHint="send"
        aria-label="Nombre del negocio"
        className="field"
      />
      <input
        name="phone"
        type="tel"
        inputMode="tel"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        placeholder="WhatsApp (opcional)"
        aria-label="WhatsApp"
        className="field"
      />
      <Segmented
        name="source"
        label="Cómo llegaste"
        options={SOURCES}
        labels={SOURCE_LABEL}
        value={source}
        onChange={setSource}
      />
      <Segmented
        name="service_interest"
        label="Le interesa"
        options={INTERESTS}
        labels={INTEREST_LABEL}
        value={interest}
        onChange={setInterest}
      />
      <button type="submit" disabled={pending} aria-busy={pending} className="btn btn-primary">
        {pending ? "Anotando…" : "Anotar contactado"}
      </button>

      {state && (
        <p role="status" className={`text-sm font-semibold ${state.ok ? "text-ok" : "text-bad"}`}>
          {state.ok ? (
            <>✓ {state.name} anotado</>
          ) : (
            <>
              {state.error}{" "}
              {state.existingId && (
                <Link href={`/prospectos/${state.existingId}`} className="underline">
                  Ver ficha
                </Link>
              )}
            </>
          )}
        </p>
      )}
    </form>
  );
}

function Segmented<T extends string>({
  name,
  label,
  options,
  labels,
  value,
  onChange,
}: {
  name: string;
  label: string;
  options: T[];
  labels: Record<T, string>;
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <fieldset>
      <legend className="label">{label}</legend>
      <div className="grid grid-cols-3 gap-1 rounded-lg bg-bg p-1">
        {options.map((o) => (
          <label
            key={o}
            className={`flex cursor-pointer items-center justify-center rounded-md px-1 py-2 text-sm font-semibold has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-brand ${
              value === o ? "bg-surface text-ink shadow-sm" : "text-muted"
            }`}
          >
            <input
              type="radio"
              name={name}
              value={o}
              checked={value === o}
              onChange={() => onChange(o)}
              className="sr-only"
            />
            {labels[o]}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
