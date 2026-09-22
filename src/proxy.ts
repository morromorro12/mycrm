import { NextResponse, type NextRequest } from "next/server";

/**
 * Candado OPCIONAL, apagado por defecto.
 *
 * Elegiste tener la app abierta, así que mientras CRM_PASSWORD esté vacía este
 * middleware no hace absolutamente nada. Si alguna vez querés cerrarla, poné
 * CRM_PASSWORD en Vercel → Settings → Environment Variables y listo: la app
 * pide esa clave una vez por dispositivo y se acuerda por un año.
 */
const COOKIE = "crm_ok";

export default function proxy(req: NextRequest) {
  const password = process.env.CRM_PASSWORD?.trim();
  if (!password) return NextResponse.next();

  if (req.cookies.get(COOKIE)?.value === password) return NextResponse.next();

  // Se puede desbloquear con ?clave=... una sola vez; después queda la cookie.
  const given = req.nextUrl.searchParams.get("clave");
  if (given === password) {
    const url = req.nextUrl.clone();
    url.searchParams.delete("clave");
    const res = NextResponse.redirect(url);
    res.cookies.set(COOKIE, password, {
      httpOnly: true,
      sameSite: "lax",
      secure: req.nextUrl.protocol === "https:",
      maxAge: 60 * 60 * 24 * 365,
      path: "/",
    });
    return res;
  }

  return new NextResponse(
    `<!doctype html><html lang="es"><head><meta charset="utf-8">
     <meta name="viewport" content="width=device-width,initial-scale=1">
     <title>CRM</title></head>
     <body style="font-family:system-ui;display:grid;place-items:center;height:100dvh;margin:0;background:#f6f7f9">
       <form style="display:grid;gap:.6rem;width:min(20rem,90vw)">
         <label for="clave" style="font-weight:600">Clave</label>
         <input id="clave" name="clave" type="password" autofocus
                style="padding:.7rem;border:1px solid #ccc;border-radius:.5rem;font-size:16px">
         <button style="padding:.7rem;border:0;border-radius:.5rem;background:#1f6feb;color:#fff;font-weight:600;font-size:16px">
           Entrar
         </button>
       </form>
     </body></html>`,
    { status: 401, headers: { "content-type": "text/html; charset=utf-8" } },
  );
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
