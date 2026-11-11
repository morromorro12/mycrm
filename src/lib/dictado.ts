import Anthropic from "@anthropic-ai/sdk";
import { addDays, weekdayName } from "./dates";
import { cleanTitles } from "./pendientes";
import { STAGE_LABEL, type LeadSource, type ProspectStage, type ServiceInterest } from "./types";

/**
 * Del mensaje de Telegram a lo que se anota, en dos pasos:
 *
 *   1. transcribir()  audio → texto. OpenAI, como en los bots de GoPet y
 *                     Tankin: Claude no escucha audio.
 *   2. interpretar()  texto → novedades de prospectos (van al Pipeline) y
 *                     pendientes sueltos (van a Por hacer). Claude saca las
 *                     muletillas, reconoce a qué prospecto te referís y pasa
 *                     "el jueves" a una fecha.
 *
 * Sin ANTHROPIC_API_KEY el paso 2 se saltea: un audio entra entero como un
 * solo pendiente, y un texto, un pendiente por renglón. El Pipeline no se toca.
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

/** Lo que contaste de un prospecto. null = no lo dijiste. */
export interface Novedad {
  negocio: string;
  nuevo: boolean;
  /** Hubo contacto hoy: le escribiste, lo llamaste, le mandaste algo. */
  hablo: boolean;
  etapa: ProspectStage | null;
  /** Qué pasó, para las notas del prospecto. */
  novedad: string | null;
  proximo_paso: string | null;
  /** YYYY-MM-DD. */
  fecha: string | null;
  contacto: string | null;
  telefono: string | null;
  interes: ServiceInterest | null;
  fuente: LeadSource | null;
}

export interface Interpretacion {
  pendientes: string[];
  prospectos: Novedad[];
  /** Preguntaste a quién tenés que escribirle. */
  ver_seguimiento: boolean;
}

/** Lo que Claude necesita saber para entenderte. */
export interface Contexto {
  today: string;
  prospects: { business_name: string; contact_name: string | null; stage: ProspectStage }[];
  clients: string[];
}

const SISTEMA = `Sos el asistente de un freelancer uruguayo que vende páginas web y manejo de anuncios de Instagram a negocios, sobre todo restaurantes. Él te manda audios o textos a un bot de Telegram, y vos ordenás lo que dice en dos lugares:

1. prospectos → su Pipeline. Un prospecto es un negocio al que le está vendiendo y que todavía no es cliente. Va acá todo lo que cuente de uno: que lo contactó, cómo respondió, en qué etapa está, qué tiene que hacer con él y cuándo. Una entrada por negocio, aunque lo nombre varias veces.
2. pendientes → su lista de Por hacer. Todo lo demás: trámites, compras, cosas de los que ya son clientes (cobrarles, cambiarles algo en la web). Cada pendiente es una línea corta que arranca con un verbo en infinitivo ("Llamar a…", "Mandarle la factura a…").

Lo de un prospecto va sólo en prospectos, nunca repetido en pendientes: "acordate de llamar a La Pasiva el jueves" es el próximo paso de La Pasiva. La excepción: si el prospecto cerró (ganado) o lo perdió, lo que tenga que hacer después con él va a pendientes.

Para cada prospecto:
- negocio: si está en la lista de prospectos, escribilo exactamente como en la lista, aunque lo diga distinto o lo nombre por el contacto ("Diego de La Pasiva", o sólo "Diego" si no hay dudas de quién es). Si no está, escribilo como lo dijo y poné nuevo = true.
- hablo: true si cuenta que hoy hubo contacto (le escribió, lo llamó, fue al local, le mandó algo, le contestó). false si sólo anota algo para más adelante o cambia un dato.
- etapa: sólo si la dice o se deduce sin dudas; si no cambia, null. contactado = primer contacto, todavía sin demo. demo_enviada = le mandó o le mostró la demo o un ejemplo de la web. propuesta_enviada = le pasó el presupuesto o la propuesta con precio. negociacion = lo está pensando, lo ve con el socio, pide descuento, ajustan condiciones. ganado = dijo que sí, cerró. perdido = dijo que no, no le interesa, o él lo da por perdido. A un prospecto nuevo sin etapa clara, poné contactado.
- novedad: qué pasó, en una frase corta como la anotaría él ("Le mandé la demo; le gustó y lo ve con el socio"). null si no contó nada que haya pasado.
- proximo_paso: lo que tiene que hacer después con ese negocio, con verbo en infinitivo ("Llamarlo", "Mandarle la propuesta"). null si no lo dijo.
- fecha: cuándo hacer ese próximo paso, como YYYY-MM-DD, sacada del calendario que te paso: "el jueves" es el próximo jueves, "la semana que viene" es el lunes que viene, "en unos días" es dentro de 3 días. Si no dijo cuándo, null: no la inventes.
- contacto, telefono, interes (web, ads o ambos), fuente (frio = le escribió sin conocerlo, in_person = fue al local o lo conoció en persona, referido = se lo pasó alguien): sólo si los dice; si no, null.

ver_seguimiento: true si pregunta a quién tiene que escribirle, con quién tiene que hacer seguimiento o qué tiene pendiente con los prospectos. Puede venir sin nada para anotar.

Sacá las muletillas y el relleno ("eh", "tengo que", "acordate de"), dejá nombres, montos, fechas y horarios como los dijo, y no agregues nada que no esté en el mensaje. Si no hay nada que anotar (un saludo, una prueba), devolvé las listas vacías.`;

const nullable = (schema: object) => ({ anyOf: [schema, { type: "null" }] });
const texto = { type: "string" };

const FORMATO = {
  type: "json_schema" as const,
  schema: {
    type: "object",
    properties: {
      pendientes: { type: "array", items: texto },
      prospectos: {
        type: "array",
        items: {
          type: "object",
          properties: {
            negocio: texto,
            nuevo: { type: "boolean" },
            hablo: { type: "boolean" },
            etapa: nullable({ type: "string", enum: Object.keys(STAGE_LABEL) }),
            novedad: nullable(texto),
            proximo_paso: nullable(texto),
            fecha: nullable({ type: "string", format: "date" }),
            contacto: nullable(texto),
            telefono: nullable(texto),
            interes: nullable({ type: "string", enum: ["web", "ads", "ambos"] }),
            fuente: nullable({ type: "string", enum: ["frio", "in_person", "referido"] }),
          },
          required: [
            "negocio", "nuevo", "hablo", "etapa", "novedad", "proximo_paso", "fecha",
            "contacto", "telefono", "interes", "fuente",
          ],
          additionalProperties: false,
        },
      },
      ver_seguimiento: { type: "boolean" },
    },
    required: ["pendientes", "prospectos", "ver_seguimiento"],
    additionalProperties: false,
  },
};

/** Sin Claude: todo a Por hacer, como antes del Pipeline. */
function soloPendientes(mensaje: string, origen: "audio" | "texto"): Interpretacion {
  return {
    pendientes: cleanTitles(origen === "texto" ? mensaje.split("\n") : [mensaje]),
    prospectos: [],
    ver_seguimiento: false,
  };
}

/**
 * Hoy, los próximos 14 días con su nombre, y a quiénes conocés. El
 * calendario va escrito para que "el jueves" no dependa de hacer cuentas.
 */
function datos(ctx: Contexto): string {
  const dias = Array.from({ length: 14 }, (_, i) => addDays(ctx.today, i + 1))
    .map((d) => `${weekdayName(d)} ${d}`)
    .join(", ");
  const prospectos = ctx.prospects.length
    ? ctx.prospects
        .map((p) => `- ${p.business_name}${p.contact_name ? ` · ${p.contact_name}` : ""} · ${STAGE_LABEL[p.stage]}`)
        .join("\n")
    : "(ninguno todavía)";
  return [
    `Hoy es ${weekdayName(ctx.today)} ${ctx.today} (hora de Uruguay).`,
    `Próximos días: ${dias}.`,
    `Prospectos (negocio · contacto · etapa):\n${prospectos}`,
    `Clientes (ya cerrados: lo de ellos va a pendientes): ${ctx.clients.join(", ") || "(ninguno)"}`,
  ].join("\n\n");
}

/** Ordena el mensaje en prospectos y pendientes. Puede no encontrar nada. */
export async function interpretar(
  mensaje: string,
  ctx: Contexto,
  origen: "audio" | "texto",
): Promise<Interpretacion> {
  if (!process.env.ANTHROPIC_API_KEY?.trim()) return soloPendientes(mensaje, origen);

  const client = new Anthropic();
  const res = await client.beta.messages.create({
    model: "claude-opus-5-5",
    max_tokens: 16000,
    // Si un clasificador de seguridad rechaza el pedido, lo reintenta otro
    // modelo en la misma llamada.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    // medium y no low: reconocer al prospecto y pasar "el jueves" a una
    // fecha es justo lo que no se puede equivocar.
    output_config: { effort: "medium", format: FORMATO },
    system: SISTEMA,
    messages: [
      {
        role: "user",
        content:
          `${datos(ctx)}\n\n` +
          (origen === "audio"
            ? `Transcripción del audio:\n\n${mensaje}`
            : `Texto que escribió (en los pendientes respetá sus palabras):\n\n${mensaje}`),
      },
    ],
  });

  // Rechazado igual, o cortado: mejor como pendiente que perderlo.
  const bloque = res.content.find((b) => b.type === "text");
  if (res.stop_reason !== "end_turn" || !bloque) return soloPendientes(mensaje, origen);
  const out = JSON.parse(bloque.text) as Interpretacion;
  return { ...out, pendientes: cleanTitles(out.pendientes) };
}
