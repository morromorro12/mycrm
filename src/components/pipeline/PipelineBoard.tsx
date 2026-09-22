"use client";

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useOptimistic, useState, useTransition } from "react";
import { moveProspect } from "@/lib/actions";
import { STAGES, STAGE_LABEL, type Prospect, type ProspectStage } from "@/lib/types";
import { ProspectCard } from "./ProspectCard";

export function PipelineBoard({ prospects }: { prospects: Prospect[] }) {
  const [, startTransition] = useTransition();
  const [activeId, setActiveId] = useState<string | null>(null);

  // La tarjeta se mueve en pantalla al instante; el guardado va atrás.
  const [items, applyMove] = useOptimistic(
    prospects,
    (state: Prospect[], move: { id: string; stage: ProspectStage }) =>
      state.map((p) => (p.id === move.id ? { ...p, stage: move.stage } : p)),
  );

  const sensors = useSensors(
    // En desktop: hay que mover 6px para que arranque el drag, así el click
    // en el nombre o en WhatsApp sigue funcionando.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    // En el celular: mantener apretado 220ms. Con menos, no se podría
    // scrollear la columna con el dedo.
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
  );

  function move(id: string, stage: ProspectStage) {
    const current = items.find((p) => p.id === id);
    if (!current || current.stage === stage) return;
    startTransition(async () => {
      applyMove({ id, stage });
      await moveProspect(id, stage);
    });
  }

  function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const stage = e.over?.id as ProspectStage | undefined;
    if (stage) move(String(e.active.id), stage);
  }

  const active = activeId ? items.find((p) => p.id === activeId) : null;

  return (
    <DndContext
      // id fijo: sin esto dnd-kit numera sus aria-describedby con un contador
      // global y el HTML del servidor no coincide con el del cliente.
      id="pipeline"
      sensors={sensors}
      onDragStart={(e: DragStartEvent) => setActiveId(String(e.active.id))}
      onDragCancel={() => setActiveId(null)}
      onDragEnd={onDragEnd}
    >
      <div className="snap-cols -mx-3 flex gap-3 overflow-x-auto px-3 pb-2 md:mx-0 md:px-0">
        {STAGES.map((stage) => (
          <Column
            key={stage}
            stage={stage}
            prospects={items.filter((p) => p.stage === stage)}
            onMove={move}
          />
        ))}
      </div>

      <DragOverlay dropAnimation={null}>
        {active ? (
          <div className="w-[min(78vw,17rem)]">
            <ProspectCard prospect={active} dragging />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function Column({
  stage,
  prospects,
  onMove,
}: {
  stage: ProspectStage;
  prospects: Prospect[];
  onMove: (id: string, stage: ProspectStage) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  const tone = stage === "ganado" ? "text-ok" : stage === "perdido" ? "text-muted" : "text-ink";

  return (
    <section
      ref={setNodeRef}
      className={`flex w-[78vw] shrink-0 flex-col rounded-xl border p-2 transition-colors sm:w-64 ${
        isOver ? "border-brand bg-brand/5" : "border-line bg-surface/60"
      }`}
    >
      <header className="mb-2 flex items-center justify-between px-1">
        <h2 className={`text-xs font-bold uppercase tracking-wide ${tone}`}>
          {STAGE_LABEL[stage]}
        </h2>
        <span className="rounded-full bg-bg px-1.5 text-xs font-bold tabular-nums text-muted">
          {prospects.length}
        </span>
      </header>

      <div className="grid min-h-16 content-start gap-2">
        {prospects.map((p) => (
          <DraggableCard key={p.id} prospect={p} onMove={(s) => onMove(p.id, s)} />
        ))}
        {prospects.length === 0 && <p className="px-1 py-3 text-center text-xs text-muted">Vacío</p>}
        {stage === "ganado" && prospects.some((p) => !p.converted_client_id) && (
          <p className="px-1 text-center text-[0.68rem] text-muted">
            Abrí la ficha para convertirlos a cliente
          </p>
        )}
      </div>
    </section>
  );
}

function DraggableCard({
  prospect,
  onMove,
}: {
  prospect: Prospect;
  onMove: (stage: ProspectStage) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: prospect.id });

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      // touch-none evita que el navegador se quede el gesto antes que dnd-kit.
      className={`touch-none ${isDragging ? "opacity-30" : ""}`}
    >
      <ProspectCard prospect={prospect} onMove={onMove} />
    </div>
  );
}
