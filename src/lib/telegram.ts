import { createHash } from "node:crypto";

const API = "https://api.telegram.org";

export function botToken(): string | null {
  return process.env.TELEGRAM_BOT_TOKEN?.trim() || null;
}

export async function telegram<T = unknown>(method: string, body: object = {}): Promise<T> {
  const res = await fetch(`${API}/bot${botToken()}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as { ok: boolean; result?: T; description?: string };
  if (!data.ok) throw new Error(`Telegram ${method}: ${data.description ?? res.status}`);
  return data.result as T;
}

/** Texto plano, sin parse_mode: así un "<" o un "_" del audio no rompe el mensaje. */
export function sendMessage(chatId: number, text: string) {
  return telegram("sendMessage", { chat_id: chatId, text, link_preview_options: { is_disabled: true } });
}

/** Baja un audio que mandaste al bot. `path` trae la extensión del archivo. */
export async function downloadFile(fileId: string) {
  const { file_path } = await telegram<{ file_path: string }>("getFile", { file_id: fileId });
  const res = await fetch(`${API}/file/bot${botToken()}/${file_path}`);
  if (!res.ok) throw new Error(`No pude bajar el audio de Telegram (${res.status}).`);
  return { audio: await res.arrayBuffer(), path: file_path };
}

/**
 * Telegram la manda en cada pedido al webhook, y así se sabe que es él y no
 * cualquiera que encontró la URL. Sale del token del bot: quien tiene el
 * token ya maneja el bot, así que no hace falta otra variable.
 */
export function webhookSecret(token: string): string {
  return createHash("sha256").update(`crm-webhook:${token}`).digest("hex");
}
