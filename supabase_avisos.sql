-- Avisos en el móvil (notificaciones push con la app cerrada).
-- 1) Antes, crea la función «avisos» en Supabase > Edge Functions (código en supabase/functions/avisos/index.ts),
--    con «Verify JWT» DESACTIVADO (la función comprueba su propia clave).
-- 2) Después pega esto entero en Supabase > SQL Editor > New query > Run (una sola vez). Necesita supabase_grupo.sql.

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

-- Ajustes de los avisos. La clave pública la leen los miembros (hace falta para activar los avisos);
-- la privada y la del cron solo las ve la función (que entra con la clave de servicio).
create table if not exists public.avisos_config (
  clave text primary key,
  valor text not null
);
alter table public.avisos_config enable row level security;
drop policy if exists "clave publica de avisos" on public.avisos_config;
create policy "clave publica de avisos" on public.avisos_config
  for select to authenticated using (clave = 'vapid_public' and public.es_miembro());
insert into public.avisos_config (clave, valor)
  values ('cron', md5(random()::text || clock_timestamp()::text) || md5(clock_timestamp()::text || random()::text))
  on conflict do nothing;

-- Móviles con los avisos activados (uno por móvil). Cada uno solo ve y borra los suyos.
create table if not exists public.avisos_subs (
  endpoint text primary key,
  user_id  uuid not null default auth.uid() references auth.users on delete cascade,
  p256dh   text not null,
  auth     text not null,
  lang     text not null default 'es',
  creado   timestamptz not null default now()
);
alter table public.avisos_subs enable row level security;
drop policy if exists "mis avisos" on public.avisos_subs;
create policy "mis avisos" on public.avisos_subs
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Avisos ya enviados (para no repetir). Solo la función.
create table if not exists public.avisos_enviados (
  clave   text primary key,
  enviado timestamptz not null default now()
);
alter table public.avisos_enviados enable row level security;

-- Cada 2 minutos se llama a la función con la clave del cron.
select cron.schedule('tribuna-avisos', '*/2 * * * *', $$
  select net.http_post(
    url := 'https://ulfxhbkoabqfyljteyab.supabase.co/functions/v1/avisos',
    headers := jsonb_build_object('Content-Type', 'application/json',
                                  'x-cron', (select valor from public.avisos_config where clave = 'cron')),
    body := '{}'::jsonb,
    timeout_milliseconds := 25000);
$$);
