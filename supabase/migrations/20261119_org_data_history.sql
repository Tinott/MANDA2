-- Historique des versions de org_data — à exécuter UNE FOIS dans
-- Supabase → SQL Editor → New query → coller → Run.
--
-- Effet : à chaque sauvegarde (UPDATE de org_data), la version PRÉCÉDENTE
-- est copiée dans org_data_history. L'application (Paramètres → Historique
-- des versions) permet de revenir à n'importe quel état antérieur. On
-- conserve les 300 dernières versions par organisation.

create table if not exists public.org_data_history (
  id          bigint generated always as identity primary key,
  org_id      uuid not null,
  data        jsonb not null,
  items_count integer,
  created_at  timestamptz not null default now()
);
create index if not exists org_data_history_org_created on public.org_data_history (org_id, created_at desc);

-- Compte les enregistrements d'un instantané (même règle que l'application).
create or replace function public.org_data_items_count(d jsonb) returns integer
language sql immutable as $$
  select coalesce(
    (select sum(jsonb_array_length(d -> k))::int
       from unnest(array['mandats','factures','notesFrais','dossiers','promesses','contacts','prospects','courriers','trash','documents']) as k
      where jsonb_typeof(d -> k) = 'array'), 0);
$$;

create or replace function public.org_data_keep_history() returns trigger
language plpgsql security definer as $$
begin
  if old.data is distinct from new.data then
    insert into public.org_data_history (org_id, data, items_count)
    values (old.org_id, coalesce(old.data, '{}'::jsonb), public.org_data_items_count(coalesce(old.data, '{}'::jsonb)));
    -- Ne garder que les 300 dernières versions de cette organisation.
    delete from public.org_data_history h
     where h.org_id = old.org_id
       and h.id not in (
         select id from public.org_data_history
          where org_id = old.org_id
          order by created_at desc
          limit 300);
  end if;
  return new;
end;
$$;

drop trigger if exists org_data_keep_history on public.org_data;
create trigger org_data_keep_history
  before update on public.org_data
  for each row execute function public.org_data_keep_history();

-- Lecture réservée aux membres de l'organisation (mêmes règles que org_data).
alter table public.org_data_history enable row level security;
drop policy if exists "membres lisent l'historique" on public.org_data_history;
create policy "membres lisent l'historique" on public.org_data_history
  for select using (
    exists (select 1 from public.memberships m where m.org_id = org_data_history.org_id and m.user_id = auth.uid())
  );
-- Aucune politique d'écriture : seules les sauvegardes (via le trigger) alimentent la table.
