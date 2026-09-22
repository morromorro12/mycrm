// ============================================================================
// SECCIÓN ADS — MOCKUP. Nada de esto toca la API de Meta todavía.
//
// ┌──────────────────────────────────────────────────────────────────────────┐
// │ ACÁ VA LA INTEGRACIÓN REAL CON META                                      │
// │                                                                          │
// │ Cuando retomes esto, lo único que hay que reemplazar es la función       │
// │ `getAdsInsights()` de más abajo. El resto de la UI ya consume su         │
// │ resultado y no necesita cambios.                                         │
// │                                                                          │
// │ 1. Marketing API — insights por cuenta publicitaria:                     │
// │    GET https://graph.facebook.com/v23.0/act_{AD_ACCOUNT_ID}/insights     │
// │      ?fields=spend,reach,impressions,actions,cost_per_action_type        │
// │      &date_preset=this_month                                             │
// │      &level=account                                                      │
// │      &access_token={SYSTEM_USER_TOKEN}                                   │
// │                                                                          │
// │ 2. Para desglosar por campaña, cambiá level=campaign y sumá              │
// │    &fields=campaign_name a la lista.                                     │
// │                                                                          │
// │ 3. Las conversiones salen de `actions`: es un array de                   │
// │    { action_type, value }. Para restaurantes te va a interesar           │
// │    action_type = 'onsite_conversion.messaging_first_reply'               │
// │    (mensajes de WhatsApp) o 'lead'.                                      │
// │                                                                          │
// │ 4. Cada cliente necesita su ad_account_id. Cuando conectes, agregá una   │
// │    columna `meta_ad_account_id text` a la tabla `clients` y mapeá        │
// │    ClientFull.id → act_{id}.                                             │
// │                                                                          │
// │ 5. Token: usar un System User token de larga duración (Business          │
// │    Manager → System Users), guardado como env var del servidor           │
// │    META_ACCESS_TOKEN — nunca con prefijo NEXT_PUBLIC_.                   │
// │                                                                          │
// │ 6. Rate limits: conviene cachear la respuesta ~1h                        │
// │    (`next: { revalidate: 3600 }` en el fetch) en vez de pegarle en cada  │
// │    render.                                                               │
// └──────────────────────────────────────────────────────────────────────────┘
// ============================================================================

export interface AdsInsight {
  /** Debería ser el clients.id real una vez conectada la API. */
  clientId: string | null;
  businessName: string;
  /** Gasto del mes en USD (Meta reporta en la moneda de la cuenta). */
  spend: number;
  /** Personas únicas alcanzadas. */
  reach: number;
  impressions: number;
  /** Conversiones del objetivo principal (mensajes de WhatsApp, leads…). */
  results: number;
  resultLabel: string;
  /** Variación del gasto vs. el mes pasado, en %. */
  spendTrend: number;
  status: "activa" | "pausada";
}

/**
 * Datos de ejemplo. Los nombres coinciden con los clientes del modo demo para
 * que la pantalla se vea coherente con el resto del CRM.
 *
 * ── REEMPLAZAR POR LA LLAMADA REAL ──
 * export async function getAdsInsights(): Promise<AdsInsight[]> {
 *   const token = process.env.META_ACCESS_TOKEN;
 *   const clients = await repo().listClients();
 *   const withAds = clients.filter((c) => c.meta_ad_account_id);
 *
 *   return Promise.all(withAds.map(async (c) => {
 *     const url = new URL(
 *       `https://graph.facebook.com/v23.0/act_${c.meta_ad_account_id}/insights`
 *     );
 *     url.searchParams.set("fields", "spend,reach,impressions,actions");
 *     url.searchParams.set("date_preset", "this_month");
 *     url.searchParams.set("access_token", token!);
 *
 *     const res  = await fetch(url, { next: { revalidate: 3600 } });
 *     const json = await res.json();
 *     const row  = json.data?.[0] ?? {};
 *
 *     return {
 *       clientId: c.id,
 *       businessName: c.business_name,
 *       spend: Number(row.spend ?? 0),
 *       reach: Number(row.reach ?? 0),
 *       impressions: Number(row.impressions ?? 0),
 *       results: Number(
 *         row.actions?.find((a) => a.action_type === "lead")?.value ?? 0
 *       ),
 *       resultLabel: "Leads",
 *       spendTrend: 0,          // requiere una segunda llamada con date_preset=last_month
 *       status: "activa",
 *     };
 *   }));
 * }
 */
export async function getAdsInsights(): Promise<AdsInsight[]> {
  return [
    {
      clientId: "c1",
      businessName: "Resto La Pasiva Centro",
      spend: 248.4,
      reach: 18420,
      impressions: 52310,
      results: 96,
      resultLabel: "Mensajes WhatsApp",
      spendTrend: 12,
      status: "activa",
    },
    {
      clientId: "c3",
      businessName: "Burger Station",
      spend: 391.75,
      reach: 27890,
      impressions: 81440,
      results: 154,
      resultLabel: "Mensajes WhatsApp",
      spendTrend: -6,
      status: "activa",
    },
    {
      clientId: null,
      businessName: "Pizzería La Nonna",
      spend: 85.0,
      reach: 6210,
      impressions: 14980,
      results: 21,
      resultLabel: "Leads",
      spendTrend: 0,
      status: "pausada",
    },
  ];
}
