import { demoRepo } from "./demo-repo";
import { supabaseConfig, supabaseRepo } from "./supabase-repo";
import type { Repo } from "./types";

/**
 * Elige el backend según haya o no claves de Supabase en el entorno.
 * No hay nada que cambiar en el código cuando conectes la base: poné las
 * variables en .env.local (o en Vercel) y listo.
 */
export function repo(): Repo {
  return supabaseConfig() ? supabaseRepo : demoRepo;
}

export const isDemoMode = () => supabaseConfig() === null;
export type { Repo } from "./types";
