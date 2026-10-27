import { TodoList } from "@/components/pendientes/TodoList";
import { PageTitle } from "@/components/ui";
import { repo } from "@/lib/data";
import { todayISO } from "@/lib/dates";
import { doneSince } from "@/lib/pendientes";

export const dynamic = "force-dynamic";

export default async function PorHacerPage() {
  const todos = await repo().listTodos(doneSince());
  const open = todos.filter((t) => !t.done_at).length;
  const count = open === 0 ? "Sin pendientes" : open === 1 ? "1 pendiente" : `${open} pendientes`;

  return (
    <div className="mx-auto max-w-2xl">
      <PageTitle title="Por hacer" subtitle={`${count} · también por audio al bot de Telegram`} />
      <TodoList todos={todos} today={todayISO()} />
    </div>
  );
}
