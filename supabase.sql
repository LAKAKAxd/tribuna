-- Base de datos de Tribuna en Supabase (plan gratuito).
-- Pegar entero en Supabase > SQL Editor > New query > Run.

-- 1. Estadísticas: una fila con todo lo que sube el script cada mañana.
create table if not exists public.snapshots (
  id          text primary key,
  data        jsonb not null,
  updated_at  timestamptz not null default now()
);

-- 2. Líneas y cuotas que pega el administrador cada día.
create table if not exists public.odds (
  player_id   text not null,
  stat        text not null,          -- pts, reb, ast, fg3m, pra...
  line        numeric not null,
  over_odd    numeric,
  under_odd   numeric,
  game_date   date not null default (now() at time zone 'America/New_York')::date,
  updated_at  timestamptz not null default now(),
  primary key (player_id, stat, game_date)
);

-- 3. Quién es administrador (solo podrá escribir cuotas quien esté aquí).
create table if not exists public.admins (
  email text primary key
);
-- Cambia el correo por el tuyo:
insert into public.admins (email) values ('CAMBIA-ESTO@ejemplo.com') on conflict do nothing;

-- 4. Seguridad: solo usuarios con sesión iniciada (tus amigos invitados) pueden leer;
--    solo el administrador puede escribir cuotas. El script usa la service key y no necesita reglas.
alter table public.snapshots enable row level security;
alter table public.odds      enable row level security;
alter table public.admins    enable row level security;

drop policy if exists "leer estadisticas" on public.snapshots;
create policy "leer estadisticas" on public.snapshots
  for select to authenticated using (true);

drop policy if exists "leer cuotas" on public.odds;
create policy "leer cuotas" on public.odds
  for select to authenticated using (true);

drop policy if exists "admin escribe cuotas" on public.odds;
create policy "admin escribe cuotas" on public.odds
  for all to authenticated
  using      (exists (select 1 from public.admins a where a.email = auth.jwt() ->> 'email'))
  with check (exists (select 1 from public.admins a where a.email = auth.jwt() ->> 'email'));

drop policy if exists "ver si soy admin" on public.admins;
create policy "ver si soy admin" on public.admins
  for select to authenticated using (email = auth.jwt() ->> 'email');

-- 5. Fondos animados de la ficha de jugador (enlace a un GIF o MP4). Todos leen, el admin escribe.
create table if not exists public.fondos (
  player_id text primary key,
  url       text not null check (url like 'https://%')
);
alter table public.fondos enable row level security;
drop policy if exists "leer fondos" on public.fondos;
create policy "leer fondos" on public.fondos
  for select to authenticated using (true);
drop policy if exists "admin escribe fondos" on public.fondos;
create policy "admin escribe fondos" on public.fondos
  for all to authenticated
  using      (exists (select 1 from public.admins a where a.email = auth.jwt() ->> 'email'))
  with check (exists (select 1 from public.admins a where a.email = auth.jwt() ->> 'email'));

-- 6. Mis apuestas: cada usuario solo ve y modifica las suyas.
create table if not exists public.apuestas (
  id         text primary key,
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  data       jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.apuestas enable row level security;
drop policy if exists "mis apuestas" on public.apuestas;
create policy "mis apuestas" on public.apuestas
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
