import { RoutineEditor } from "@/components/semana/RoutineEditor";
import { WeekView } from "@/components/semana/WeekView";
import { PageTitle } from "@/components/ui";
import { repo } from "@/lib/data";
import { addDays, isISODate, todayISO, weekRangeLabel, weekStart } from "@/lib/dates";
import { rutina } from "@/lib/rutina";

export const dynamic = "force-dynamic";

export default async function SemanaPage({
  searchParams,
}: {
  searchParams: Promise<{ semana?: string }>;
}) {
  const { semana } = await searchParams;
  const today = todayISO();
  const thisMonday = weekStart(today);
  const monday = weekStart(isISODate(semana) ? semana : today);

  const r = repo();
  const [habits, checks, cold] = await Promise.all([
    r.listHabits(),
    r.listHabitChecks(),
    r.listColdContacts(),
  ]);
  const rt = rutina(habits, checks, cold, { today, weekOf: monday });

  const href = (m: string) => (m === thisMonday ? "/semana" : `/semana?semana=${m}`);

  return (
    <div className="mx-auto max-w-2xl">
      <PageTitle title="Semana" subtitle={weekRangeLabel(monday)} />
      {/* key: al cambiar de semana se vuelve a elegir el día. */}
      <WeekView
        key={monday}
        rt={rt}
        monday={monday}
        thisMonday={thisMonday}
        prevHref={href(addDays(monday, -7))}
        nextHref={href(addDays(monday, 7))}
      />
      <RoutineEditor habits={rt.habits} />
    </div>
  );
}
