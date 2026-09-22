import { todayISO } from "../dates";
import type { ClientFull, Payment, Prospect } from "../types";

/** Fecha desplazada N días respecto de hoy, como 'YYYY-MM-DD'. */
function shift(days: number): string {
  const t = Date.parse(`${todayISO()}T00:00:00Z`) + days * 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
}

function period(monthsBack: number): string {
  const [y, m] = todayISO().split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 - monthsBack, 1));
  return d.toISOString().slice(0, 10);
}

/** Día `day` del mes actual, como 'YYYY-MM-DD'. */
function thisMonth(day: number): string {
  return `${todayISO().slice(0, 7)}-${String(day).padStart(2, "0")}`;
}

// Datos de ejemplo para el MODO DEMO. Las fechas son relativas a hoy, así que
// el dashboard siempre muestra algo vivo en "Atención hoy".
export function seedProspects(): Prospect[] {
  return [
    {
      id: "p1",
      business_name: "Parrilla El Fogón",
      contact_name: "Martín Rodríguez",
      phone: "099 412 883",
      service_interest: "web",
      stage: "propuesta_enviada",
      source: "referido",
      last_contact_at: shift(-4),
      next_action: "Llamar para cerrar la propuesta",
      next_action_at: shift(-2),
      notes: "Le interesa el sistema de pedidos por WhatsApp. Tiene 2 locales.",
      converted_client_id: null,
    },
    {
      id: "p2",
      business_name: "Café Aurora",
      contact_name: "Lucía Methol",
      phone: "091 220 574",
      service_interest: "ambos",
      stage: "demo_enviada",
      source: "in_person",
      last_contact_at: shift(-7),
      next_action: "Pedir feedback de la demo",
      next_action_at: todayISO(),
      notes: "Pasé por el local. Quiere ver la demo funcionando en el celular.",
      converted_client_id: null,
    },
    {
      id: "p3",
      business_name: "Pizzería La Nonna",
      contact_name: "Andrés Peña",
      phone: "094 771 209",
      service_interest: "ads",
      stage: "negociacion",
      source: "frio",
      last_contact_at: shift(-1),
      next_action: "Mandar presupuesto ajustado a $U 9.000",
      next_action_at: shift(1),
      notes: "Le pareció caro el primer número. Negociando el retainer.",
      converted_client_id: null,
    },
    {
      id: "p4",
      business_name: "Sushi Kai",
      contact_name: "Camila Sosa",
      phone: "098 336 102",
      service_interest: "web",
      stage: "contactado",
      source: "frio",
      last_contact_at: shift(-3),
      next_action: "Mandar ejemplos de otros restaurantes",
      next_action_at: shift(-1),
      notes: "Contactada por Instagram. Respondió que le mande info.",
      converted_client_id: null,
    },
    {
      id: "p5",
      business_name: "Bodegón Tres Cruces",
      contact_name: "Jorge Bentancur",
      phone: "099 018 445",
      service_interest: "ambos",
      stage: "contactado",
      source: "referido",
      last_contact_at: shift(-2),
      next_action: "Coordinar reunión presencial",
      next_action_at: shift(3),
      notes: "Referido por El Fogón.",
      converted_client_id: null,
    },
    {
      id: "p6",
      business_name: "Heladería Crema del Sur",
      contact_name: "Valentina Cabrera",
      phone: "092 554 781",
      service_interest: "ads",
      stage: "perdido",
      source: "frio",
      last_contact_at: shift(-25),
      next_action: null,
      next_action_at: null,
      notes: "Cerró por temporada. Reintentar en primavera.",
      converted_client_id: null,
    },
  ];
}

export function seedClients(): ClientFull[] {
  const pay = (
    id: string,
    client_id: string,
    service_id: string,
    monthsBack: number,
    amount: number,
    currency: Payment["currency"],
  ): Payment => ({
    id,
    client_id,
    service_id,
    period: period(monthsBack),
    amount,
    currency,
    paid_at: period(monthsBack).slice(0, 8) + "08",
    note: null,
  });

  return [
    {
      id: "c1",
      business_name: "Resto La Pasiva Centro",
      contact_name: "Gabriela Núñez",
      phone: "099 745 220",
      notes: "Cobra siempre puntual. Pide cambios de menú una vez por mes.",
      active: true,
      services: [
        { id: "s1", client_id: "c1", kind: "retainer", amount: 6500, currency: "UYU", billing_day: 5, active: true },
        { id: "s2", client_id: "c1", kind: "ads", amount: 250, currency: "USD", billing_day: 5, active: true },
      ],
      payments: [
        pay("pay1", "c1", "s1", 0, 6500, "UYU"),
        pay("pay2", "c1", "s2", 0, 250, "USD"),
        pay("pay3", "c1", "s1", 1, 6500, "UYU"),
        pay("pay4", "c1", "s2", 1, 250, "USD"),
        pay("pay5", "c1", "s1", 2, 6500, "UYU"),
      ],
    },
    {
      id: "c2",
      business_name: "Empanadas Doña Rosa",
      contact_name: "Rosa Ferreira",
      phone: "094 112 668",
      notes: "Prefiere que le escriba de mañana. Paga por transferencia.",
      active: true,
      services: [
        { id: "s3", client_id: "c2", kind: "web", amount: 4200, currency: "UYU", billing_day: 1, active: true },
      ],
      payments: [pay("pay6", "c2", "s3", 1, 4200, "UYU"), pay("pay7", "c2", "s3", 2, 4200, "UYU")],
    },
    {
      id: "c3",
      business_name: "Burger Station",
      contact_name: "Nicolás Duarte",
      phone: "091 903 337",
      notes: "Escala el presupuesto de ads en fin de semana largo.",
      active: true,
      services: [
        { id: "s4", client_id: "c3", kind: "retainer", amount: 5000, currency: "UYU", billing_day: 10, active: true },
        { id: "s5", client_id: "c3", kind: "ads", amount: 400, currency: "USD", billing_day: 10, active: true },
      ],
      payments: [pay("pay8", "c3", "s4", 1, 5000, "UYU"), pay("pay9", "c3", "s5", 1, 400, "USD")],
    },
    {
      id: "c4",
      business_name: "Cantina del Puerto",
      contact_name: "Federico Olivera",
      phone: "098 220 914",
      notes: "Temporada alta en verano. Pidió pausar ads en julio.",
      active: true,
      services: [
        { id: "s6", client_id: "c4", kind: "web", amount: 3800, currency: "UYU", billing_day: 20, active: true },
      ],
      payments: [pay("pay10", "c4", "s6", 1, 3800, "UYU")],
    },
    {
      id: "c5",
      business_name: "Panadería La Espiga",
      contact_name: "Silvia Márquez",
      phone: "099 667 013",
      notes: "Cliente desde el año pasado. Muy conforme.",
      active: true,
      services: [
        { id: "s7", client_id: "c5", kind: "retainer", amount: 3500, currency: "UYU", billing_day: 28, active: true },
      ],
      payments: [pay("pay11", "c5", "s7", 1, 3500, "UYU")],
    },
  ];
}

export { shift as demoShift, thisMonth as demoThisMonth };
