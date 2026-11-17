-- Registro del valor y grupo (ranking y tickets compartidos).
-- Pegar entero en Supabase > SQL Editor > New query > Run (una sola vez). Necesita supabase_grupo.sql.

-- 1. Registro de las apuestas que la app marca con valor (y las demás con cuota), para saber si aciertan.
--    Lo escribe la app del administrador antes de cada partido; solo él lo ve.
create table if not exists public.valor (
  fecha       date not null,
  liga        text not null,
  clave       text not null,           -- jugador|estadística o mercado de partido
  datos       jsonb not null,          -- lado, línea, cuota, probabilidad del modelo y de la cuota, valor
  actualizado timestamptz not null default now(),
  primary key (fecha, liga, clave)
);
alter table public.valor enable row level security;
drop policy if exists "admin valor" on public.valor;
create policy "admin valor" on public.valor
  for all to authenticated using (public.es_admin()) with check (public.es_admin());

-- 2. Perfil para el grupo: nombre visible y si comparte sus apuestas. Nunca se enseña el correo.
create table if not exists public.perfiles (
  user_id     uuid primary key default auth.uid() references auth.users on delete cascade,
  nombre      text not null check (char_length(trim(nombre)) between 2 and 24),
  compartir   boolean not null default false,
  moneda      text not null default 'EUR',
  actualizado timestamptz not null default now()
);
alter table public.perfiles enable row level security;
drop policy if exists "ver perfiles del grupo" on public.perfiles;
create policy "ver perfiles del grupo" on public.perfiles
  for select to authenticated using (public.es_miembro());
drop policy if exists "mi perfil" on public.perfiles;
create policy "mi perfil" on public.perfiles
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 3. Los miembros pueden LEER las apuestas de quien ha decidido compartirlas (no cambiarlas).
--    La política "mis apuestas" de supabase.sql sigue igual: cada uno escribe solo las suyas.
drop policy if exists "apuestas compartidas" on public.apuestas;
create policy "apuestas compartidas" on public.apuestas
  for select to authenticated using (
    public.es_miembro() and exists (select 1 from public.perfiles p where p.user_id = apuestas.user_id and p.compartir)
  );
