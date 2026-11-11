import type { NextRequest } from "next/server";
import { anotarProspectos, textoAnotado, textoAviso, textoSeguimiento } from "@/lib/anotar";
import { repo } from "@/lib/data";
import { todayISO } from "@/lib/dates";
import { interpretar, transcribir } from "@/lib/dictado";
import { DEFAULT_FOLLOW_UP_DAYS } from "@/lib/seguimiento";
import { botToken, downloadFile, sendMessage, sendTyping, telegram, webhookSecret } from "@/lib/telegram";

/**
 * El bot de Telegram del CRM.
 *
 *   POST  Telegram manda acá cada mensaje que le escribís al bot. Un audio se
 *         transcribe; después Claude separa lo que es de un prospecto (va al
 *         Pipeline) de los pendientes sueltos (van a Por hacer).
 *   GET   Conecta el bot con la app. Se abre una vez, después de cargar las
 *         variables en Vercel, y muestra qué falta.
 */
export const dynamic = "force-dynamic";
// Bajar, transcribir e interpretar un audio lleva unos segundos.
export const maxDuration = 60;

interface Message {
  chat: { id: number };
  text?: string;
  voice?: { file_id: string };
  audio?: { file_id: string };
}

/** Lo que aparece en el menú "/" del chat. */
const COMMANDS = [
  { command: "seguimiento", description: "A quién tenés que escribirle" },
  { command: "ayuda", description: "Cómo contarle las cosas al bot" },
];

const AYUDA = `Mandame un audio o un texto y lo anoto en el CRM.

PROSPECTOS → Pipeline. Decí el negocio, qué pasó y qué sigue:
«La Pasiva: le mandé la demo, le gustó. Llamarlo el jueves.»
«Nuevo: Parrilla El Fogón, el dueño es Martín, 099 123 456, quiere web. Le escribí por Instagram.»
«Sushi Kai me pidió el precio, le mandé la propuesta.»
«Pasame La Nonna al lunes.»
«Café Aurora cerró» / «Café Aurora dijo que no.»

Las etapas se dicen como te salgan: lo contacté · le mandé la demo · le mandé la propuesta · lo está pensando · cerró · dijo que no.
Si no decís cuándo seguir, te lo pongo para dentro de ${DEFAULT_FOLLOW_UP_DAYS} días: así ninguno queda sin fecha y no se te pierde.

LO DEMÁS → Por hacer: «Comprar tóner y llamar al contador.»

En un mismo audio podés mezclar varias cosas: las separo.

/seguimiento — a quién tenés que escribirle (o preguntámelo en un audio)`;

export async function POST(req: NextRequest) {
  const token = botToken();
  if (!token || req.headers.get("x-telegram-bot-api-secret-token") !== webhookSecret(token)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const update = (await req.json().catch(() => null)) as { message?: Message } | null;
  const msg = update?.message;
  // Siempre 200: con cualquier otra cosa Telegram reintenta, y el mismo
  // audio se anotaría dos veces.
  if (!msg) return Response.json({ ok: true });
  try {
    await answer(msg);
  } catch (e) {
    const why = e instanceof Error ? e.message : String(e);
    await sendMessage(msg.chat.id, `No pude anotarlo. ${why}`).catch(() => {});
  }
  return Response.json({ ok: true });
}

async function answer(msg: Message) {
  const chat = msg.chat.id;
  const owner = process.env.TELEGRAM_CHAT_ID?.trim();
  if (!owner) {
    await sendMessage(
      chat,
      `Tu chat id es ${chat}. Cargalo en Vercel como TELEGRAM_CHAT_ID, hacé un redeploy y volvé a mandarme el audio.`,
    );
    return;
  }
  // Cualquiera puede encontrar el bot y escribirle: sólo anota lo tuyo.
  if (String(chat) !== owner) return;

  const today = todayISO();
  const file = msg.voice ?? msg.audio;
  const text = msg.text?.trim();

  if (!file) {
    if (!text) return void (await sendMessage(chat, AYUDA));
    if (text.startsWith("/")) {
      // "/seguimiento" o "/seguimiento@Micrm7107_bot" desde un grupo.
      const cmd = text.slice(1).split(/[\s@]/)[0].toLowerCase();
      if (["seguimiento", "pipeline", "hoy"].includes(cmd)) {
        await sendMessage(chat, textoSeguimiento(await repo().listProspects(), today));
      } else {
        await sendMessage(chat, AYUDA);
      }
      return;
    }
  }

  // Transcribir y pensar lleva unos segundos: que se vea que está en eso.
  await sendTyping(chat).catch(() => {});
  const [prospects, clients] = await Promise.all([repo().listProspects(), repo().listClients()]);

  let mensaje = text ?? "";
  if (file) {
    const names = [...new Set([...clients, ...prospects].map((x) => x.business_name.trim()).filter(Boolean))];
    const { audio, path } = await downloadFile(file.file_id);
    // Las notas de voz llegan como .oga; OpenAI las reconoce como .ogg.
    mensaje = await transcribir(
      audio,
      path.split("/").pop()!.replace(/\.oga$/, ".ogg"),
      names.slice(0, 80),
    );
    if (!mensaje) return void (await sendMessage(chat, "No escuché nada en el audio."));
  }

  const interp = await interpretar(
    mensaje,
    {
      today,
      prospects: prospects.slice(0, 200),
      clients: clients.map((c) => c.business_name),
    },
    file ? "audio" : "texto",
  );

  const anotados = await anotarProspectos(interp.prospectos, today);
  if (interp.pendientes.length) await repo().addTodos(interp.pendientes);

  if (!anotados.length && !interp.pendientes.length && !interp.ver_seguimiento) {
    await sendMessage(chat, `No encontré nada para anotar. Entendí: «${mensaje}»`);
    return;
  }

  // Después de anotar, para que lo que se acaba de cargar ya cuente.
  const ahora = anotados.length ? await repo().listProspects() : prospects;
  const host = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  const parts: string[] = [];
  if (anotados.length) {
    parts.push(["Pipeline:", ...anotados.map((a) => textoAnotado(a, today))].join("\n"));
  }
  if (interp.pendientes.length) {
    parts.push(
      ["Por hacer:", ...interp.pendientes.map((t) => `• ${t}`)].join("\n") +
        (host ? `\nhttps://${host}/pendientes` : ""),
    );
  }
  if (interp.ver_seguimiento) {
    parts.push(textoSeguimiento(ahora, today));
  } else {
    const aviso = textoAviso(ahora, today);
    if (aviso) parts.push(aviso);
  }
  await sendMessage(chat, parts.join("\n\n"));
}

export async function GET(req: NextRequest) {
  const token = botToken();
  if (!token) {
    return plain(
      "Falta TELEGRAM_BOT_TOKEN en Vercel. Creá un bot con @BotFather en Telegram, " +
        "cargá el token y volvé a abrir esta página después del redeploy.",
    );
  }

  const host = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? req.nextUrl.host;
  const url = new URL(`https://${host}/api/telegram`);
  // Con la protección de Vercel prendida, Telegram rebotaría contra el login.
  const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET?.trim();
  if (bypass) url.searchParams.set("x-vercel-protection-bypass", bypass);

  const lines: string[] = [];
  try {
    await telegram("setWebhook", {
      url: url.toString(),
      secret_token: webhookSecret(token),
      allowed_updates: ["message"],
    });
    await telegram("setMyCommands", { commands: COMMANDS });
    const me = await telegram<{ username: string }>("getMe");
    lines.push(`✓ Bot @${me.username} conectado: lo que le mandes llega a https://${host}/api/telegram`);
  } catch (e) {
    lines.push(`✗ No pude conectar el bot. ${e instanceof Error ? e.message : e}`);
  }

  const has = (k: string) => Boolean(process.env[k]?.trim());
  lines.push(
    has("TELEGRAM_CHAT_ID")
      ? "✓ TELEGRAM_CHAT_ID: sólo anota lo que le mandes vos"
      : "✗ Falta TELEGRAM_CHAT_ID: escribile algo al bot y te contesta cuál es el tuyo",
    has("OPENAI_API_KEY")
      ? "✓ OPENAI_API_KEY: entiende audios"
      : "✗ Falta OPENAI_API_KEY: sin eso no entiende audios (los textos sí)",
    has("ANTHROPIC_API_KEY")
      ? "✓ ANTHROPIC_API_KEY: entiende qué va al Pipeline y qué a Por hacer"
      : "· Sin ANTHROPIC_API_KEY: todo va a Por hacer (cada audio entero, como un solo pendiente) y el Pipeline no se toca",
  );
  if (process.env.VERCEL && !bypass) {
    lines.push(
      "· Si la app tiene la protección de Vercel prendida, Telegram no llega: activá " +
        "Settings → Deployment Protection → Protection Bypass for Automation y volvé a abrir esta página.",
    );
  }
  return plain(lines.join("\n\n"));
}

function plain(text: string) {
  return new Response(text, { headers: { "content-type": "text/plain; charset=utf-8" } });
}
