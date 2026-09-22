import Link from "next/link";
import { PipelineBoard } from "@/components/pipeline/PipelineBoard";
import { PageTitle } from "@/components/ui";
import { repo } from "@/lib/data";
import { todayISO } from "@/lib/dates";

export const dynamic = "force-dynamic";

export default async function PipelinePage() {
  const prospects = await repo().listProspects();
  const today = todayISO();

  const open = prospects.filter((p) => p.stage !== "ganado" && p.stage !== "perdido");
  const late = open.filter((p) => p.next_action_at && p.next_action_at <= today).length;

  return (
    <>
      <PageTitle
        title="Pipeline"
        subtitle={
          open.length === 0
            ? "Sin prospectos abiertos"
            : `${open.length} abiertos${late > 0 ? ` · ${late} para hoy o atrasados` : ""}`
        }
        action={
          <Link href="/prospectos/nuevo" className="btn btn-primary shrink-0">
            + Prospecto
          </Link>
        }
      />

      {prospects.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line px-4 py-10 text-center">
          <p className="text-sm text-muted">Todavía no cargaste ningún prospecto.</p>
          <Link href="/prospectos/nuevo" className="btn btn-primary mt-3">
            Cargar el primero
          </Link>
        </div>
      ) : (
        <>
          <PipelineBoard prospects={prospects} />
          <p className="mt-2 text-center text-xs text-muted md:text-left">
            Arrastrá las tarjetas entre columnas, o cambiá la etapa desde el menú de cada una.{" "}
            <Link href="/archivados" className="font-semibold hover:text-ink hover:underline">
              Ver archivados
            </Link>
          </p>
        </>
      )}
    </>
  );
}
