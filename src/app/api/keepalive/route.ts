import type { NextRequest } from "next/server";
import { pingSupabase, supabaseConfig } from "@/lib/data/supabase-repo";

/**
 * Lo llama el cron de Vercel una vez por día (ver vercel.json) para que
 * Supabase no pause el proyecto por inactividad. No devuelve datos.
 */
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  // Si hay CRON_SECRET, Vercel la manda sola en cada llamada del cron.
  const secret = process.env.CRON_SECRET?.trim();
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  if (!supabaseConfig()) return Response.json({ ok: true, mode: "demo" });

  await pingSupabase();
  return Response.json({ ok: true });
}
