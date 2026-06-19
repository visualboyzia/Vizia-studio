-- ════════════════════════════════════════════════════════════════
-- VIZIA Finanzas — esquema de base de datos (Supabase / Postgres)
-- Pega TODO esto en Supabase → SQL Editor → Run.
-- ════════════════════════════════════════════════════════════════

create extension if not exists "uuid-ossp";

-- ── Tablas ───────────────────────────────────────────────────────
create table if not exists projects (
  id         uuid primary key default uuid_generate_v4(),
  nm         text not null,
  cl         text,
  total      numeric default 0,
  cobrado    numeric default 0,
  status     text default 'En curso',
  created_at timestamptz default now()
);

create table if not exists transactions (
  id         uuid primary key default uuid_generate_v4(),
  t          text not null check (t in ('in','out')),   -- ingreso / gasto
  amt        numeric not null,                          -- monto en USD (base)
  cur        text not null default 'USD',               -- moneda real: USD | PEN
  orig_amt   numeric,                                   -- monto en su moneda real
  descr      text,
  proj       text,                                      -- cliente/proyecto o categoría
  paid_from  text default 'Empresa',                    -- Empresa | Nicolás | Franco
  status     text default 'confirmado',                 -- confirmado | pendiente
  voided     boolean default false,                     -- anulado (no se borra: queda en historial)
  voided_by  text,
  ic         text,
  date       date not null,
  created_by text,
  created_at timestamptz default now()
);

create table if not exists team (
  id     uuid primary key default uuid_generate_v4(),
  nm     text not null,
  role   text,
  type   text default 'freelance',   -- socio | freelance
  share  numeric default 0,          -- % de ingresos (socios), ej. 0.20
  pay    numeric default 0,          -- pago fijo mensual USD (freelance)
  av     text
);

create table if not exists recurring (
  id  uuid primary key default uuid_generate_v4(),
  nm  text not null,
  amt numeric default 0,
  cur text default 'USD',
  day int default 1,                 -- día del mes en que se cobra
  ic  text default '◇'
);

create table if not exists activity (
  id         uuid primary key default uuid_generate_v4(),
  who        text,                               -- quién hizo el cambio
  action     text,                               -- agregó / eliminó / creó…
  detail     text,
  created_at timestamptz default now()
);

create table if not exists settings (
  id       int primary key default 1,
  display  text default 'USD',
  rate     numeric default 3.75,     -- S/ por USD
  igv_on   boolean default false,
  igv_rate numeric default 0.18,
  meta     numeric default 9000,
  accounts jsonb   default '{"Nicolás":0,"Franco":0,"Empresa":0}',  -- saldo por cuenta de banco (USD)
  constraint settings_singleton check (id = 1)
);

-- ── Seguridad (RLS) ──────────────────────────────────────────────
-- Estudio de 2 socios de confianza: cualquier usuario autenticado
-- puede leer y escribir todo. (Más adelante se puede afinar por rol.)
alter table projects     enable row level security;
alter table transactions enable row level security;
alter table team         enable row level security;
alter table recurring    enable row level security;
alter table settings     enable row level security;
alter table activity     enable row level security;

do $$
declare tbl text;
begin
  foreach tbl in array array['projects','transactions','team','recurring','settings','activity'] loop
    execute format('drop policy if exists "auth_all" on %I;', tbl);
    execute format(
      'create policy "auth_all" on %I for all to authenticated using (true) with check (true);', tbl);
  end loop;
end $$;

-- ── Tiempo real (para que ambos vean cambios al instante) ────────
alter publication supabase_realtime add table transactions;
alter publication supabase_realtime add table projects;
alter publication supabase_realtime add table team;
alter publication supabase_realtime add table recurring;
alter publication supabase_realtime add table settings;
alter publication supabase_realtime add table activity;

-- ── Datos iniciales ──────────────────────────────────────────────
insert into settings (id, accounts) values
  (1, '{"Nicolás":1722.24,"Franco":1589.58,"Empresa":0}')
  on conflict (id) do nothing;

-- Solo los 2 socios (datos reales). Proyectos, movimientos y suscripciones
-- arrancan vacíos: se agregan desde la app.
insert into team (nm, role, type, share, pay, av) values
  ('Nicolás',         'Socio · Dirección',  'socio', 0.20, 0, 'N'),
  ('Franco Otiniano', 'Socio · Producción', 'socio', 0.20, 0, 'F');
