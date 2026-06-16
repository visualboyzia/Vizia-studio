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

create table if not exists settings (
  id       int primary key default 1,
  display  text default 'USD',
  rate     numeric default 3.75,     -- S/ por USD
  igv_on   boolean default false,
  igv_rate numeric default 0.18,
  meta     numeric default 9000,
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

do $$
declare tbl text;
begin
  foreach tbl in array array['projects','transactions','team','recurring','settings'] loop
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

-- ── Datos iniciales ──────────────────────────────────────────────
insert into settings (id) values (1) on conflict (id) do nothing;

insert into projects (nm, cl, total, cobrado, status) values
  ('Torre Miraflores',  'Estudio Arqué',      8000, 4000, 'En curso'),
  ('Casa Las Lomas',    'Bauen Arquitectos',  5200, 5200, 'Entregado'),
  ('Lobby Hotel Costa', 'Mirador SAC',        6500, 1950, 'En curso'),
  ('Máster Plan Surco', 'Estudio Arqué',      9800,    0, 'Propuesta');

insert into team (nm, role, type, share, pay, av) values
  ('Nicolás',          'Socio · Dirección',  'socio',     0.20,    0, 'N'),
  ('Franco Otiniano',  'Socio · Producción', 'socio',     0.20,    0, 'F'),
  ('Render freelance', '3D / Render',        'freelance', 0,    1200, 'R');

insert into recurring (nm, amt, cur, day, ic) values
  ('Octane Render',          20, 'USD', 16, '◇'),
  ('Chaos V-Ray',            45, 'USD', 18, '◇'),
  ('Render farm (créditos)',120, 'USD', 14, '☁'),
  ('Adobe Creative Cloud',   55, 'USD',  5, '◆');

insert into transactions (t, amt, cur, orig_amt, descr, proj, paid_from, status, ic, date) values
  ('in', 1950, 'USD', 1950, 'Adelanto 30% — Lobby Hotel Costa', 'Mirador SAC',       'Empresa',  'pendiente',  '◐', '2026-06-12'),
  ('out',-1200,'PEN', 4500, 'Freelance modelado 3D',            'Operación',         'Franco',   'confirmado', '◇', '2026-06-11'),
  ('in', 4000, 'USD', 4000, 'Adelanto 50% — Torre Miraflores',  'Estudio Arqué',     'Empresa',  'confirmado', '◑', '2026-06-08'),
  ('out',-180, 'USD',  180, 'Adobe + Chaos (render)',           'Software / Render', 'Nicolás',  'confirmado', '◇', '2026-06-05'),
  ('out',-540, 'PEN', 2025, 'Disco SSD + RAM workstation',      'Equipos',           'Nicolás',  'confirmado', '▢', '2026-06-03'),
  ('in', 5200, 'USD', 5200, 'Pago final — Casa Las Lomas',      'Bauen Arquitectos', 'Empresa',  'confirmado', '●', '2026-05-28');
