import type { NextRequest } from "next/server";
import { repo } from "@/lib/data";
import { separar, transcribir } from "@/lib/dictado";
import { cleanTitles } from "@/lib/pendientes";
import { botToken, downloadFile, sendMessage, telegram, webhookSecret } from "@/lib/telegram";

/**
 * El bot de Telegram de "Por hacer".
 *
 *   POST  Telegram manda acá cada mensaje que le escribís al bot. Un audio se
 *         transcribe y se parte en pendientes; un texto entra tal cual, un
 *         pendiente por renglón.
 *   GET   Conecta el bot con la app. Se abre una vez, después de cargar las
 *         variables en Vercel, y muestra qué falta.
 */
export const dynamic = "force-dynamic";
// Bajar, transcribir y separar un audio lleva unos segundos.
export const maxDuration = 60;

interface Message {
  chat: { id: number };
  text?: string;
  voice?: { file_id: string };
  audio?: { file_id: string };
}

const AYUDA =
  "Mandame un audio o un texto con lo que tenés que hacer y lo anoto en Por hacer, en el CRM. " +
  "En un mismo audio podés decir varias cosas: las anoto por separado.";

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

  const file = msg.voice ?? msg.audio;
  if (!file && (!msg.text || msg.text.startsWith("/"))) {
    await sendMessage(chat, AYUDA);
    return;
  }

  let titles: string[];
  if (file) {
    const names = await businessNames();
    const { audio, path } = await downloadFile(file.file_id);
    // Las notas de voz llegan como .oga; OpenAI las reconoce como .ogg.
    const heard = await transcribir(audio, path.split("/").pop()!.replace(/\.oga$/, ".ogg"), names);
    if (!heard) {
      await sendMessage(chat, "No escuché nada en el audio.");
      return;
    }
    titles = await separar(heard, names);
    if (!titles.length) {
      await sendMessage(chat, `No encontré nada para anotar. Entendí: «${heard}»`);
      return;
    }
  } else {
    titles = cleanTitles(msg.text!.split("\n"));
  }

  await repo().addTodos(titles);
  const host = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  await sendMessage(
    chat,
    `Anotado:\n${titles.map((t) => `• ${t}`).join("\n")}` +
      (host ? `\n\nhttps://${host}/pendientes` : ""),
  );
}

/** Clientes y prospectos, para que el audio los escriba bien. */
async function businessNames() {
  const [clients, prospects] = await Promise.all([repo().listClients(), repo().listProspects()]);
  const names = [...clients, ...prospects].map((x) => x.business_name.trim()).filter(Boolean);
  return [...new Set(names)].slice(0, 80);
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
      ? "✓ ANTHROPIC_API_KEY: parte cada audio en pendientes"
      : "· Sin ANTHROPIC_API_KEY: cada audio entra entero, como un solo pendiente",
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
