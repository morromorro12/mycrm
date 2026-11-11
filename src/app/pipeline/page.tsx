import Link from "next/link";
import { AdriftList } from "@/components/pipeline/AdriftList";
import { PipelineBoard } from "@/components/pipeline/PipelineBoard";
import { PageTitle } from "@/components/ui";
import { repo } from "@/lib/data";
import { todayISO } from "@/lib/dates";
import { followUps, isOpenStage } from "@/lib/seguimiento";

export const dynamic = "force-dynamic";

export default async function PipelinePage() {
  const prospects = await repo().listProspects();
  const today = todayISO();

  const open = prospects.filter((p) => isOpenStage(p.stage));
  const { due, adrift } = followUps(prospects, today);
  const status = [
    `${open.length} abiertos`,
    due.length > 0 && `${due.length} para hoy o atrasados`,
    adrift.length > 0 && `${adrift.length} sin próximo paso`,
  ].filter(Boolean);

  return (
    <>
      <PageTitle
        title="Pipeline"
        subtitle={
          open.length === 0 ? "Sin prospectos abiertos" : status.join(" · ")
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
          <AdriftList prospects={adrift} today={today} />
          <PipelineBoard prospects={prospects} />
          <p className="mt-2 text-center text-xs text-muted md:text-left">
            Arrastrá las tarjetas entre columnas, o cambiá la etapa desde el menú de cada una.
            También podés contárselo al bot de Telegram: «La Pasiva: le mandé la demo, llamarlo
            el jueves».{" "}
            <Link href="/archivados" className="font-semibold hover:text-ink hover:underline">
              Ver archivados
            </Link>
          </p>
        </>
      )}
    </>
  );
}
