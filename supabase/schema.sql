-- ============================================================================
-- CRM — esquema completo
-- Pegá TODO este archivo en Supabase → SQL Editor → Run.
-- Es idempotente: lo podés correr de nuevo sin romper nada.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ── Enums ───────────────────────────────────────────────────────────────────
do $$ begin
  create type prospect_stage as enum
    ('contactado','demo_enviada','propuesta_enviada','negociacion','ganado','perdido');
exception when duplicate_object then null; end $$;

do $$ begin
  create type service_interest as enum ('web','ads','ambos');
exception when duplicate_object then null; end $$;

do $$ begin
  create type lead_source as enum ('frio','in_person','referido');
exception when duplicate_object then null; end $$;

do $$ begin
  create type currency_code as enum ('UYU','USD');
exception when duplicate_object then null; end $$;

do $$ begin
  create type service_kind as enum ('web','retainer','ads');
exception when duplicate_object then null; end $$;

-- 'mensual' = la cuota del mes. 'inicial' = el cobro de arranque del proyecto.
do $$ begin
  create type payment_kind as enum ('mensual','inicial');
exception when duplicate_object then null; end $$;

-- Con qué tarjeta se paga la pauta de un servicio de Ads.
do $$ begin
  create type ad_card as enum ('cliente','mia');
exception when duplicate_object then null; end $$;

-- Movimientos de la pauta que pagás con tu tarjeta: 'transferencia' = el
-- cliente te pasó plata. 'gasto' quedó de la primera versión y ya no se usa:
-- lo gastado ahora es un solo número por cliente (clients.ad_spent).
do $$ begin
  create type ad_movement_kind as enum ('transferencia','gasto');
exception when duplicate_object then null; end $$;

-- ── Clientes activos ────────────────────────────────────────────────────────
create table if not exists clients (
  id            uuid primary key default gen_random_uuid(),
  business_name text        not null,
  contact_name  text,
  phone         text,                       -- como lo escribís vos; se normaliza para wa.me
  notes         text,                       -- notas de cuenta
  active        boolean     not null default true,  -- false = pausado (sigue siendo cliente)
  archived      boolean     not null default false, -- true = archivado (fuera de las listas)
  -- Pago inicial: el cobro de arranque (armado de la web, setup de ads…).
  -- Es UNO por cliente y no entra en el MRR: no es recurrente.
  -- setup_amount null = este cliente no tiene pago inicial.
  setup_amount    numeric(12,2) check (setup_amount is null or setup_amount >= 0),
  setup_currency  currency_code not null default 'UYU',
  setup_due_on    date,                     -- para cuándo lo esperás (opcional)
  setup_note      text,
  -- Pauta con tu tarjeta: lo que lleva gastado la campaña en Meta. Es UN
  -- número que vas pisando con lo que dice Meta, no una suma de cobros.
  -- null = sin cargar.
  ad_spent          numeric(12,2) check (ad_spent is null or ad_spent >= 0),
  ad_spent_currency currency_code not null default 'USD',
  ad_spent_on       date,                   -- cuándo lo actualizaste por última vez
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ── Servicios contratados (1 cliente → N servicios, cada uno con su monto) ──
create table if not exists client_services (
  id          uuid          primary key default gen_random_uuid(),
  client_id   uuid          not null references clients(id) on delete cascade,
  kind        service_kind  not null,
  amount      numeric(12,2) not null default 0 check (amount >= 0),
  currency    currency_code not null default 'UYU',
  billing_day smallint      not null default 1 check (billing_day between 1 and 31),
  active      boolean       not null default true,
  -- Desde cuándo corre el servicio. Define cuál es "el primer mes".
  starts_on   date          not null default current_date,
  -- Promo de cierre: el mes de starts_on no se cobra.
  first_month_free boolean  not null default false,
  -- O con descuento: lo que se cobra el mes de starts_on en vez de amount.
  -- null = sin descuento. Nunca junto con first_month_free.
  first_month_amount numeric(12,2) check (first_month_amount is null or first_month_amount >= 0),
  -- Sólo Ads: la pauta en Meta. Es plata del cliente, aparte de tus
  -- honorarios (amount), así que no entra en el MRR. null = sin cargar.
  ad_budget   numeric(12,2) check (ad_budget is null or ad_budget >= 0),
  ad_currency currency_code not null default 'USD',
  ad_card     ad_card,                      -- 'cliente' | 'mia'
  created_at  timestamptz   not null default now(),
  updated_at  timestamptz   not null default now()
);
create index if not exists client_services_client_idx on client_services (client_id);

-- ── Historial de pagos ──────────────────────────────────────────────────────
-- `period` es SIEMPRE el día 1 del mes que el pago cubre (ej: 2026-09-01).
-- El estado de pago del mes NO se guarda: se deriva de si existe o no la fila
-- del período actual. Por eso "se resetea solo" el 1° de cada mes.
create table if not exists payments (
  id         uuid          primary key default gen_random_uuid(),
  client_id  uuid          not null references clients(id) on delete cascade,
  service_id uuid          references client_services(id) on delete set null,
  period     date          not null,
  kind       payment_kind  not null default 'mensual',
  amount     numeric(12,2) not null,
  currency   currency_code not null,
  paid_at    date          not null default current_date,
  note       text,
  created_at timestamptz   not null default now()
);
create index if not exists payments_client_period_idx on payments (client_id, period desc);
-- Un solo pago por servicio por mes: hace idempotente el botón "marcar pagado"
-- (tocarlo dos veces no duplica la fila).
--
-- A propósito NO es un índice parcial: el upsert de la app usa
-- ON CONFLICT (service_id, period), y Postgres no puede inferir un índice
-- parcial sin repetir su predicado. Los pagos con service_id NULL (servicios
-- borrados) quedan fuera del índice igual, porque en Postgres cada NULL cuenta
-- como distinto.
create unique index if not exists payments_service_period_key
  on payments (service_id, period);

-- Y un solo pago inicial por cliente. Este sí puede ser parcial: el upsert con
-- ON CONFLICT es sólo para los mensuales, el inicial se consulta antes de
-- insertar.
create unique index if not exists payments_setup_key
  on payments (client_id) where kind = 'inicial';

-- ── Pauta con tu tarjeta ────────────────────────────────────────────────────
-- Cuando la pauta de Meta sale de TU tarjeta, el cliente te la va
-- transfiriendo. Acá van esas transferencias; el saldo es su suma menos lo
-- gastado (clients.ad_spent). No es ingreso tuyo, así que no toca `payments`
-- ni el MRR. Va por cliente y no por servicio: si el servicio de Ads se borra
-- o se rearma, el saldo no se pierde.
create table if not exists ad_movements (
  id         uuid             primary key default gen_random_uuid(),
  client_id  uuid             not null references clients(id) on delete cascade,
  kind       ad_movement_kind not null,
  amount     numeric(12,2)    not null check (amount > 0),
  currency   currency_code    not null,
  moved_on   date             not null default current_date,
  note       text,
  created_at timestamptz      not null default now()
);
create index if not exists ad_movements_client_idx on ad_movements (client_id, moved_on desc);

-- ── Prospectos ──────────────────────────────────────────────────────────────
create table if not exists prospects (
  id                  uuid             primary key default gen_random_uuid(),
  business_name       text             not null,
  contact_name        text,
  phone               text,
  service_interest    service_interest not null default 'web',
  stage               prospect_stage   not null default 'contactado',
  source              lead_source      not null default 'frio',
  last_contact_at     date,
  next_action         text,             -- qué tenés que hacer
  next_action_at      date,             -- cuándo. Esto alimenta "Atención hoy".
  notes               text,
  converted_client_id uuid             references clients(id) on delete set null,
  archived            boolean          not null default false,
  created_at          timestamptz      not null default now(),
  updated_at          timestamptz      not null default now()
);
create index if not exists prospects_stage_idx      on prospects (stage);
create index if not exists prospects_next_action_idx on prospects (next_action_at)
  where next_action_at is not null;

-- ── Contactados en frío ─────────────────────────────────────────────────────
-- La meta del día de Metas: cuántos negocios contactaste en frío. Un número
-- por día y sin nombres, a propósito: anotar a cada uno lleva más tiempo que
-- escribirle a uno nuevo.
create table if not exists cold_contacts (
  contacted_on date        primary key,
  contacts     integer     not null default 0 check (contacts >= 0),
  updated_at   timestamptz not null default now()
);

-- ── Rutina semanal ──────────────────────────────────────────────────────────
-- Las tareas fijas de cada día (las que se repiten siempre, no las puntuales)
-- y cuáles tachaste. De ahí sale la racha de días con todo tachado.
--
-- Cambiar los días de una tarea no reescribe el pasado: la versión vieja
-- termina hoy (ends_on) y arranca otra con los días nuevos. Así una racha
-- nunca se corta por acomodar la rutina.
do $$ begin
  -- 'check' = se tacha a mano. 'frio' = se tacha sola cuando los
  -- contactados en frío del día (cold_contacts) llegan a la meta.
  create type habit_kind as enum ('check','frio');
exception when duplicate_object then null; end $$;

create table if not exists habits (
  id         uuid        primary key default gen_random_uuid(),
  title      text        not null check (length(btrim(title)) between 1 and 80),
  kind       habit_kind  not null default 'check',
  -- Qué días toca: 1 = lunes … 7 = domingo.
  weekdays   smallint[]  not null default '{1,2,3,4,5}'
             check (cardinality(weekdays) > 0 and weekdays <@ '{1,2,3,4,5,6,7}'),
  -- null = días fijos. Un número = tantas veces por semana, el día que
  -- quieras (salir a correr 3 veces); ahí weekdays no importa.
  per_week   smallint    check (per_week between 1 and 7),
  position   integer     not null default 0,
  starts_on  date        not null default current_date,
  ends_on    date,       -- el primer día en que ya no toca; null = vigente
  created_at timestamptz not null default now(),
  check (ends_on is null or ends_on > starts_on)
);

create table if not exists habit_checks (
  habit_id   uuid        not null references habits(id) on delete cascade,
  done_on    date        not null,
  created_at timestamptz not null default now(),
  primary key (habit_id, done_on)
);
create index if not exists habit_checks_day_idx on habit_checks (done_on);

-- ── Migración ───────────────────────────────────────────────────────────────
-- Si creaste las tablas con una versión anterior de este archivo, esto agrega
-- la columna `archived` sin tocar tus datos. Si ya la tenés, no hace nada.
alter table clients   add column if not exists archived boolean not null default false;
alter table prospects add column if not exists archived boolean not null default false;

-- Índices parciales: las listas del día a día filtran por archived = false,
-- y el archivo se consulta de vez en cuando.
create index if not exists clients_archived_idx   on clients (archived)   where archived;
create index if not exists prospects_archived_idx on prospects (archived) where archived;

-- Pago inicial y primer mes gratis.
alter table clients add column if not exists setup_amount   numeric(12,2);
alter table clients add column if not exists setup_currency currency_code not null default 'UYU';
alter table clients add column if not exists setup_due_on   date;
alter table clients add column if not exists setup_note     text;
alter table client_services add column if not exists starts_on        date    not null default current_date;
alter table client_services add column if not exists first_month_free boolean not null default false;
alter table payments        add column if not exists kind             payment_kind not null default 'mensual';

-- Pauta de los servicios de Ads.
alter table client_services add column if not exists ad_budget   numeric(12,2)
  check (ad_budget is null or ad_budget >= 0);
alter table client_services add column if not exists ad_currency currency_code not null default 'USD';
alter table client_services add column if not exists ad_card     ad_card;

-- Primer mes con descuento.
alter table client_services add column if not exists first_month_amount numeric(12,2)
  check (first_month_amount is null or first_month_amount >= 0);

-- Pauta con tu tarjeta: lo gastado pasa a ser un número por cliente.
alter table clients add column if not exists ad_spent numeric(12,2)
  check (ad_spent is null or ad_spent >= 0);
alter table clients add column if not exists ad_spent_currency currency_code not null default 'USD';
alter table clients add column if not exists ad_spent_on date;

-- Los 'gasto' anotados con la primera versión se pasan a ese número (su suma)
-- y recién ahí se borran, para no contarlos dos veces. Sólo si el cliente no
-- tiene el número cargado y todos sus 'gasto' son de una misma moneda: si no,
-- quedan como estaban. Una vez pasados no queda ninguno, así que volver a
-- correr esto no hace nada.
with g as (
  select client_id, min(currency) as currency, sum(amount) as total, max(moved_on) as last_on
  from ad_movements
  where kind = 'gasto'
  group by client_id
  having count(distinct currency) = 1
), moved as (
  update clients c
     set ad_spent = g.total, ad_spent_currency = g.currency, ad_spent_on = g.last_on
    from g
   where c.id = g.client_id and c.ad_spent is null
  returning c.id
)
delete from ad_movements m
 using moved
 where m.client_id = moved.id and m.kind = 'gasto';

-- Rutina: tareas "X veces por semana", sin día fijo.
alter table habits add column if not exists per_week smallint
  check (per_week between 1 and 7);

-- ── updated_at automático ───────────────────────────────────────────────────
create or replace function touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists clients_touch         on clients;
drop trigger if exists client_services_touch on client_services;
drop trigger if exists prospects_touch       on prospects;
drop trigger if exists cold_contacts_touch   on cold_contacts;

create trigger clients_touch         before update on clients
  for each row execute function touch_updated_at();
create trigger client_services_touch before update on client_services
  for each row execute function touch_updated_at();
create trigger prospects_touch       before update on prospects
  for each row execute function touch_updated_at();
create trigger cold_contacts_touch   before update on cold_contacts
  for each row execute function touch_updated_at();

-- ── Row Level Security ──────────────────────────────────────────────────────
-- Elegiste una app SIN login, así que la anon key necesita acceso completo.
-- Consecuencia: cualquiera que tenga tu anon key puede leer y escribir estas
-- tablas. La anon key viaja al navegador, o sea que es pública de hecho.
--
-- Si más adelante querés cerrarlo, tenés dos caminos:
--   a) Poné CRM_PASSWORD en las variables de entorno (candado a nivel app, ya
--      viene implementado en src/middleware.ts), y además
--   b) Reemplazá las políticas de abajo por `using (auth.uid() is not null)`
--      y pasá a Supabase Auth con un único usuario.
alter table clients         enable row level security;
alter table client_services enable row level security;
alter table payments        enable row level security;
alter table prospects       enable row level security;
alter table ad_movements    enable row level security;
alter table cold_contacts   enable row level security;
alter table habits          enable row level security;
alter table habit_checks    enable row level security;

do $$
declare t text;
begin
  foreach t in array array[
    'clients','client_services','payments','prospects','ad_movements','cold_contacts',
    'habits','habit_checks'
  ] loop
    execute format('drop policy if exists %I on %I', t || '_anon_all', t);
    execute format(
      'create policy %I on %I for all to anon, authenticated using (true) with check (true)',
      t || '_anon_all', t);
  end loop;
end $$;

-- Que la API de Supabase vea enseguida las tablas nuevas (sin esto, la app
-- puede tardar en encontrar ad_movements y fallar al leer los clientes).
notify pgrst, 'reload schema';
