-- Cuotas automáticas: distingue las que pones tú a mano de las que trae el script,
-- para que el script nunca pise las tuyas. Pegar en Supabase > SQL Editor > Run.
alter table public.odds add column if not exists fuente text not null default 'manual';
alter table public.odds alter column line drop not null;
