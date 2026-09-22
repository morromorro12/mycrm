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

-- ── Clientes activos ────────────────────────────────────────────────────────
create table if not exists clients (
  id            uuid primary key default gen_random_uuid(),
  business_name text        not null,
  contact_name  text,
  phone         text,                       -- como lo escribís vos; se normaliza para wa.me
  notes         text,                       -- notas de cuenta
  active        boolean     not null default true,
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
  created_at          timestamptz      not null default now(),
  updated_at          timestamptz      not null default now()
);
create index if not exists prospects_stage_idx      on prospects (stage);
create index if not exists prospects_next_action_idx on prospects (next_action_at)
  where next_action_at is not null;

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

create trigger clients_touch         before update on clients
  for each row execute function touch_updated_at();
create trigger client_services_touch before update on client_services
  for each row execute function touch_updated_at();
create trigger prospects_touch       before update on prospects
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

do $$
declare t text;
begin
  foreach t in array array['clients','client_services','payments','prospects'] loop
    execute format('drop policy if exists %I on %I', t || '_anon_all', t);
    execute format(
      'create policy %I on %I for all to anon, authenticated using (true) with check (true)',
      t || '_anon_all', t);
  end loop;
end $$;
