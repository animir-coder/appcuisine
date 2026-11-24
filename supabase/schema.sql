-- Cuisine du foyer : schéma Supabase. À coller dans SQL Editor > New query > Run.
create extension if not exists pgcrypto;

create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Foyer',
  invite_code text not null unique default upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 6)),
  created_at timestamptz not null default now()
);

create table if not exists public.members (
  household_id uuid not null references public.households on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

-- Une ligne par élément (recette, article de stock, de liste, récurrent, fiche produit).
-- Suppression "douce" (deleted) pour que les autres téléphones la reçoivent.
create table if not exists public.entries (
  household_id uuid not null references public.households on delete cascade,
  kind text not null check (kind in ('recipe', 'stock', 'shopping', 'recurrent', 'catalog')),
  id text not null,
  data jsonb,
  deleted boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid(),
  primary key (household_id, kind, id)
);
create index if not exists entries_sync_idx on public.entries (household_id, updated_at);

create or replace function public.touch_entry() returns trigger language plpgsql set search_path = public as $$
begin new.updated_at := clock_timestamp(); new.updated_by := auth.uid(); return new; end $$;
drop trigger if exists entries_touch on public.entries;
create trigger entries_touch before insert or update on public.entries for each row execute function public.touch_entry();

-- Sécurité : on ne voit que les données de son foyer
create or replace function public.is_member(h uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from members where household_id = h and user_id = auth.uid())
$$;

alter table public.households enable row level security;
alter table public.members enable row level security;
alter table public.entries enable row level security;

drop policy if exists hh_read on public.households;
create policy hh_read on public.households for select using (public.is_member(id));
drop policy if exists hh_update on public.households;
create policy hh_update on public.households for update using (public.is_member(id));
drop policy if exists mb_read on public.members;
create policy mb_read on public.members for select using (public.is_member(household_id));
drop policy if exists mb_leave on public.members;
create policy mb_leave on public.members for delete using (user_id = auth.uid());
drop policy if exists en_all on public.entries;
create policy en_all on public.entries for all using (public.is_member(household_id)) with check (public.is_member(household_id));

-- Créer un foyer / rejoindre avec le code d'invitation
create or replace function public.create_household(p_name text) returns public.households
language plpgsql security definer set search_path = public as $$
declare h households;
begin
  if auth.uid() is null then raise exception 'non connecté'; end if;
  insert into households (name) values (coalesce(nullif(trim(p_name), ''), 'Foyer')) returning * into h;
  insert into members (household_id, user_id) values (h.id, auth.uid());
  return h;
end $$;

create or replace function public.join_household(p_code text) returns public.households
language plpgsql security definer set search_path = public as $$
declare h households;
begin
  if auth.uid() is null then raise exception 'non connecté'; end if;
  select * into h from households where invite_code = upper(trim(p_code));
  if h.id is null then raise exception 'code inconnu'; end if;
  if (select count(*) from members where household_id = h.id) >= 6 then raise exception 'foyer complet'; end if;
  insert into members (household_id, user_id) values (h.id, auth.uid()) on conflict do nothing;
  return h;
end $$;

revoke execute on function public.create_household(text), public.join_household(text), public.is_member(uuid) from anon, public;
grant execute on function public.create_household(text), public.join_household(text), public.is_member(uuid) to authenticated;

-- Temps réel : les changements arrivent instantanément sur les autres téléphones
do $$ begin
  alter publication supabase_realtime add table public.entries;
exception when duplicate_object then null; end $$;
