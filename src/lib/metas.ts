import { addDays, isWeekend, todayISO } from "./dates";
import type { RutinaStats } from "./rutina";
import type { ColdContactDay } from "./types";

// ============================================================================
// Metas estilo Clash of Clans. Lo único que se carga es cuántos negocios
// contactaste en frío cada día (un número, sin nombres); los logros, la racha
// y el nivel salen de ahí y de la rutina semanal, y la meta final de lo
// cobrado en pesos. Son ACCIONES que dependen de vos, no resultados como
// cerrar clientes, que llegan solos a partir de eso.
// ============================================================================

/** Contactados en frío por día. */
export const DAILY_TARGET = 10;

/** La meta final, sólo en pesos: lo cobrado en dólares no suma acá. */
export const MILLION_UYU = 1_000_000;
const MILLION_STEPS = [100_000, 250_000, 500_000, MILLION_UYU];

interface TrackDef {
  id: string;
  title: string;
  /** El objetivo de un escalón: "Contactar 50 negocios en frío". */
  goal: (n: number) => string;
  tiers: number[];
}

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

const TRACKS: TrackDef[] = [
  {
    id: "contactados",
    title: "Contactados en frío",
    goal: (n) => `Contactar ${n} negocios en frío`,
    tiers: [10, 50, 100, 250, 500, 1000, 2500],
  },
  {
    id: "dias",
    title: "Días con la meta cumplida",
    goal: (n) => `Cumplir la meta diaria ${n} ${plural(n, "día", "días")}`,
    tiers: [1, 3, 7, 15, 30, 60, 100],
  },
  {
    id: "racha",
    title: "Mejor racha",
    goal: (n) => `Racha de ${n} días seguidos`,
    tiers: [2, 3, 5, 10, 20, 40, 60],
  },
  {
    id: "rutina",
    title: "Rutina completa, días seguidos",
    goal: (n) => `Tachar toda la rutina ${n} días seguidos`,
    tiers: [3, 7, 14, 30, 60, 100, 200],
  },
  {
    id: "semanas",
    title: "Semanas perfectas",
    goal: (n) => `${n} ${plural(n, "semana perfecta", "semanas perfectas")} de rutina`,
    tiers: [1, 2, 4, 8, 12, 26, 52],
  },
];

/**
 * Rangos por estrellas. El último nivel, Millonario, no se gana con
 * estrellas: sólo llegando a $U 1.000.000 cobrados. Si se suman objetivos
 * nuevos (y con ellos estrellas), estos cortes se pueden estirar.
 */
const RANKS = [
  { name: "Novato", stars: 0 },
  { name: "Vendedor", stars: 2 },
  { name: "Cazador", stars: 4 },
  { name: "Imparable", stars: 7 },
  { name: "Agencia", stars: 10 },
  { name: "Empresario", stars: 14 },
  { name: "Magnate", stars: 18 },
];
const MILLIONAIRE = "Millonario";

export interface TrackProgress {
  id: string;
  title: string;
  value: number;
  tiers: number[];
  /** Escalones pasados = estrellas ganadas en este objetivo. */
  stars: number;
  /** El próximo escalón, o null si está completo. */
  next: number | null;
  nextGoal: string | null;
}

export interface Unlocked {
  /** Estable entre visitas: es lo que se guarda como "ya festejado". */
  key: string;
  label: string;
}

export interface Metas {
  today: {
    count: number;
    target: number;
    done: boolean;
  };
  streak: { current: number; best: number };
  tracks: TrackProgress[];
  stars: number;
  maxStars: number;
  level: {
    n: number;
    name: string;
    /** Rango siguiente; null si ya sos Millonario. */
    nextName: string | null;
    /** Estrellas que faltan para el siguiente; null si el siguiente es por plata. */
    starsToNext: number | null;
    /** Cuánto del camino al siguiente nivel hiciste, 0–100. */
    pct: number;
  };
  million: {
    collected: number;
    /** Próximo hito en el camino al millón; null si ya llegaste. */
    next: number | null;
  };
  unlocked: Unlocked[];
}

/**
 * Racha de días cumpliendo la meta. Los fines de semana suman si los
 * cumplís, pero no la cortan si no. Hoy tampoco la corta mientras no termine.
 */
function streaks(metDays: Set<string>, today: string): { current: number; best: number } {
  if (metDays.size === 0) return { current: 0, best: 0 };

  let day = [...metDays].sort()[0];
  let current = 0;
  let best = 0;
  for (; day <= today; day = addDays(day, 1)) {
    if (metDays.has(day)) current++;
    else if (day !== today && !isWeekend(day)) current = 0;
    best = Math.max(best, current);
  }
  return { current, best };
}

export function metas(
  days: ColdContactDay[],
  collectedUYU: number,
  routine: RutinaStats,
  today = todayISO(),
): Metas {
  const todayCount = days.find((d) => d.contacted_on === today)?.contacts ?? 0;
  const metDays = new Set(
    days.filter((d) => d.contacts >= DAILY_TARGET).map((d) => d.contacted_on),
  );
  const streak = streaks(metDays, today);

  const values: Record<string, number> = {
    contactados: days.reduce((sum, d) => sum + d.contacts, 0),
    dias: metDays.size,
    racha: streak.best,
    rutina: routine.best,
    semanas: routine.perfectWeeks,
  };

  // En el orden en que se festejan: el día, los logros y, al final, el nivel.
  const unlocked: Unlocked[] = [];
  const done = todayCount >= DAILY_TARGET;
  if (done) {
    unlocked.push({
      key: `dia:${today}`,
      label: `Meta del día cumplida: ${DAILY_TARGET} contactados en frío`,
    });
  }

  const tracks = TRACKS.map((t): TrackProgress => {
    const value = values[t.id];
    const reached = t.tiers.filter((n) => value >= n);
    for (const n of reached) unlocked.push({ key: `${t.id}:${n}`, label: t.goal(n) });
    const next = t.tiers.find((n) => value < n) ?? null;
    return {
      id: t.id,
      title: t.title,
      value,
      tiers: t.tiers,
      stars: reached.length,
      next,
      nextGoal: next === null ? null : t.goal(next),
    };
  });

  const stars = tracks.reduce((sum, t) => sum + t.stars, 0);
  const maxStars = TRACKS.reduce((sum, t) => sum + t.tiers.length, 0);

  const millionaire = collectedUYU >= MILLION_UYU;
  const rankIdx = RANKS.findLastIndex((r) => stars >= r.stars);
  const rank = RANKS[rankIdx];
  const nextRank = RANKS[rankIdx + 1];
  const level = millionaire
    ? { n: RANKS.length + 1, name: MILLIONAIRE, nextName: null, starsToNext: null, pct: 100 }
    : {
        n: rankIdx + 1,
        name: rank.name,
        nextName: nextRank?.name ?? MILLIONAIRE,
        starsToNext: nextRank ? nextRank.stars - stars : null,
        // Del último rango a Millonario se avanza con plata, no con estrellas.
        pct: Math.floor(
          nextRank
            ? ((stars - rank.stars) / (nextRank.stars - rank.stars)) * 100
            : (collectedUYU / MILLION_UYU) * 100,
        ),
      };
  if (level.n > 1) {
    unlocked.push({ key: `nivel:${level.n}`, label: `Subiste a nivel ${level.n}: ${level.name}` });
  }

  return {
    today: { count: todayCount, target: DAILY_TARGET, done },
    streak,
    tracks,
    stars,
    maxStars,
    level,
    million: {
      collected: collectedUYU,
      next: MILLION_STEPS.find((n) => collectedUYU < n) ?? null,
    },
    unlocked,
  };
}
