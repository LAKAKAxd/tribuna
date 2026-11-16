-- Registro con código de grupo. Pegar entero en Supabase > SQL Editor > New query > Run.
-- Tus amigos crean su cuenta en la app y escriben el código; sin él no ven nada.
-- El código se genera solo y lo ves (y cambias) en la app, pestaña Cuotas.

create table if not exists public.ajustes (
  clave text primary key,
  valor text not null
);
insert into public.ajustes (clave, valor)
  values ('codigo_grupo', upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8)))
  on conflict do nothing;

create table if not exists public.miembros (
  user_id    uuid primary key references auth.users on delete cascade,
  email      text,
  created_at timestamptz not null default now()
);

alter table public.ajustes  enable row level security;
alter table public.miembros enable row level security;

create or replace function public.es_admin() returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins a where lower(a.email) = lower(auth.jwt() ->> 'email'));
$$;

create or replace function public.es_miembro() returns boolean
  language sql stable security definer set search_path = public as $$
  select public.es_admin() or exists (select 1 from public.miembros m where m.user_id = auth.uid());
$$;

-- Comprueba el código y, si es correcto, apunta al usuario como miembro.
create or replace function public.unirse(codigo text) returns boolean
  language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return false; end if;
  if public.es_miembro() then return true; end if;
  if upper(trim(codigo)) = (select upper(trim(valor)) from public.ajustes where clave = 'codigo_grupo') then
    insert into public.miembros (user_id, email) values (auth.uid(), auth.jwt() ->> 'email') on conflict do nothing;
    return true;
  end if;
  perform pg_sleep(1);  -- frena a quien pruebe códigos al azar
  return false;
end $$;

revoke all on function public.unirse(text), public.es_miembro(), public.es_admin() from public, anon;
grant execute on function public.unirse(text), public.es_miembro(), public.es_admin() to authenticated;

-- Solo el administrador ve y cambia el código, y ve la lista de miembros.
drop policy if exists "admin ajustes" on public.ajustes;
create policy "admin ajustes" on public.ajustes
  for all to authenticated using (public.es_admin()) with check (public.es_admin());
drop policy if exists "admin ve miembros" on public.miembros;
create policy "admin ve miembros" on public.miembros
  for select to authenticated using (public.es_admin() or user_id = auth.uid());
drop policy if exists "admin quita miembros" on public.miembros;
create policy "admin quita miembros" on public.miembros
  for delete to authenticated using (public.es_admin());

-- Estadísticas, cuotas y fondos: ahora solo los leen los miembros del grupo.
drop policy if exists "leer estadisticas" on public.snapshots;
create policy "leer estadisticas" on public.snapshots
  for select to authenticated using (public.es_miembro());
drop policy if exists "leer cuotas" on public.odds;
create policy "leer cuotas" on public.odds
  for select to authenticated using (public.es_miembro());
drop policy if exists "leer fondos" on public.fondos;
create policy "leer fondos" on public.fondos
  for select to authenticated using (public.es_miembro());
