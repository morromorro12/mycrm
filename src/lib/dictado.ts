import Anthropic from "@anthropic-ai/sdk";
import { cleanTitles } from "./pendientes";

/**
 * Del audio de Telegram a la lista de pendientes, en dos pasos:
 *
 *   1. transcribir()  audio → texto. OpenAI, como en los bots de GoPet y
 *                     Tankin: Claude no escucha audio.
 *   2. separar()      texto → pendientes. Claude saca las muletillas y parte
 *                     un audio con tres cosas en tres pendientes.
 *
 * Sin ANTHROPIC_API_KEY el paso 2 se saltea: el audio entero queda como un
 * solo pendiente, tal cual lo transcribió OpenAI.
 */

/**
 * `nombres` (clientes y prospectos) va como pista: sin eso, "Uruclub" sale
 * "uru club" o "Ruclub".
 */
export async function transcribir(audio: ArrayBuffer, archivo: string, nombres: string[]) {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) throw new Error("Falta OPENAI_API_KEY en Vercel: sin eso no puedo escuchar audios.");

  const fd = new FormData();
  fd.append("file", new Blob([audio]), archivo);
  fd.append("model", "gpt-4o-transcribe");
  fd.append("language", "es");
  if (nombres.length) fd.append("prompt", `Nombres que pueden aparecer: ${nombres.join(", ")}.`);

  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: fd,
  });
  if (!res.ok) throw new Error(`OpenAI no pudo transcribir el audio (${res.status}).`);
  const { text } = (await res.json()) as { text?: string };
  return (text ?? "").trim();
}

const SISTEMA = `Sos el asistente de un freelancer uruguayo que anota sus pendientes mandándole audios a un bot de Telegram. Te paso la transcripción de un audio: devolvé las cosas que tiene que hacer, una por pendiente, en el orden en que las dijo.

Cada pendiente es una línea corta que se lee de un vistazo en el celular y arranca con un verbo en infinitivo ("Llamar a…", "Mandarle el presupuesto a…"). Sacá las muletillas y el relleno ("eh", "acordate de", "tengo que"), pero dejá los nombres, montos, fechas y horarios tal como los dijo, y no agregues nada que no esté en el audio. Si nombra a alguien de la lista de clientes y prospectos con otra grafía, usá la de la lista.

Si en el audio no hay nada para hacer (un saludo, una prueba), devolvé la lista vacía.`;

const FORMATO = {
  type: "json_schema" as const,
  schema: {
    type: "object",
    properties: { pendientes: { type: "array", items: { type: "string" } } },
    required: ["pendientes"],
    additionalProperties: false,
  },
};

/** Parte la transcripción en pendientes. Puede devolver una lista vacía. */
export async function separar(texto: string, nombres: string[]): Promise<string[]> {
  if (!process.env.ANTHROPIC_API_KEY?.trim()) return cleanTitles([texto]);

  const client = new Anthropic();
  const res = await client.beta.messages.create({
    model: "claude-opus-5-5",
    max_tokens: 8000,
    // Si un clasificador de seguridad rechaza el pedido, lo reintenta otro
    // modelo en la misma llamada.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low", format: FORMATO },
    system: SISTEMA,
    messages: [
      {
        role: "user",
        content:
          (nombres.length ? `Clientes y prospectos: ${nombres.join(", ")}\n\n` : "") +
          `Transcripción del audio:\n\n${texto}`,
      },
    ],
  });

  // Rechazado igual, o cortado: mejor el audio entero que perderlo.
  const bloque = res.content.find((b) => b.type === "text");
  if (res.stop_reason !== "end_turn" || !bloque) return cleanTitles([texto]);
  const { pendientes } = JSON.parse(bloque.text) as { pendientes: string[] };
  return cleanTitles(pendientes);
}
