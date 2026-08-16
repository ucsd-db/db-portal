-- ============================================================
-- Dragon boat team portal — core schema
-- Multi-tenant: organizations ↔ memberships (admin | member)
-- ============================================================

create extension if not exists pgcrypto;

-- ---------- profiles (1:1 with auth.users) ----------
create table public.profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  email           text not null,
  full_name       text not null default '',
  phone           text,
  -- paddling attributes (used by lineup builder)
  weight_kg       numeric(5,1),
  gender          text check (gender in ('male','female','other')),
  side_preference text check (side_preference in ('left','right','either')),
  can_steer       boolean not null default false,
  can_drum        boolean not null default false,
  -- carpool attributes
  address         text,
  lat             double precision,
  lon             double precision,
  can_drive       boolean not null default false,
  car_seats       int check (car_seats between 1 and 15),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', ''));
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- organizations ----------
create table public.organizations (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  join_code  text not null unique,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table public.memberships (
  org_id     uuid not null references public.organizations(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  role       text not null default 'member' check (role in ('admin','member')),
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);
create index on public.memberships (user_id);

-- ---------- role helpers (security definer so RLS policies can call them
--            without recursing into memberships' own policies) ----------
create or replace function public.is_org_member(org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from memberships where org_id = org and user_id = auth.uid());
$$;

create or replace function public.is_org_admin(org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from memberships where org_id = org and user_id = auth.uid() and role = 'admin');
$$;

create or replace function public.shares_org_with(other uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from memberships a join memberships b on a.org_id = b.org_id
    where a.user_id = auth.uid() and b.user_id = other
  );
$$;

-- ---------- announcements ----------
create table public.announcements (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations(id) on delete cascade,
  author_id  uuid references public.profiles(id) on delete set null,
  title      text not null,
  body       text not null default '',
  pinned     boolean not null default false,
  created_at timestamptz not null default now()
);
create index on public.announcements (org_id, pinned desc, created_at desc);

-- ---------- practices / events + attendance (rsvps) ----------
create table public.practices (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references public.organizations(id) on delete cascade,
  title          text not null,
  starts_at      timestamptz not null,
  ends_at        timestamptz,
  location_name  text,
  location_lat   double precision,
  location_lon   double precision,
  notes          text,
  rsvp_deadline  timestamptz,
  created_by     uuid references public.profiles(id) on delete set null,
  created_at     timestamptz not null default now()
);
create index on public.practices (org_id, starts_at);

create table public.rsvps (
  practice_id uuid not null references public.practices(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  status      text not null check (status in ('yes','no','maybe')),
  -- ride coordination for this specific practice
  ride        text not null default 'none' check (ride in ('none','driver','needs_ride')),
  seats       int check (seats between 1 and 15),
  note        text,
  updated_at  timestamptz not null default now(),
  primary key (practice_id, user_id)
);

-- ---------- lineups & carpools (algorithm state stored as jsonb) ----------
create table public.lineups (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  practice_id uuid references public.practices(id) on delete set null,
  name        text not null,
  boat_type   text not null default 'open' check (boat_type in ('open','womens','mixed')),
  data        jsonb not null default '{}'::jsonb,   -- @db/lineup Lineup shape
  published   boolean not null default false,       -- visible to members when true
  created_by  uuid references public.profiles(id) on delete set null,
  updated_at  timestamptz not null default now()
);
create index on public.lineups (org_id, practice_id);

create table public.carpools (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  practice_id uuid not null references public.practices(id) on delete cascade,
  data        jsonb not null default '{}'::jsonb,   -- @db/carpool { cars, unassigned, mode }
  published   boolean not null default false,
  updated_at  timestamptz not null default now(),
  unique (practice_id)
);

-- ---------- RPCs ----------
create or replace function public.create_organization(org_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare new_id uuid; code text;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  code := upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 8));
  insert into organizations (name, join_code, created_by) values (org_name, code, auth.uid()) returning id into new_id;
  insert into memberships (org_id, user_id, role) values (new_id, auth.uid(), 'admin');
  return new_id;
end $$;

create or replace function public.join_organization(code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare oid uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select id into oid from organizations where join_code = upper(trim(code));
  if oid is null then raise exception 'invalid join code'; end if;
  insert into memberships (org_id, user_id, role) values (oid, auth.uid(), 'member')
    on conflict do nothing;
  return oid;
end $$;

-- ---------- RLS ----------
alter table public.profiles      enable row level security;
alter table public.organizations enable row level security;
alter table public.memberships   enable row level security;
alter table public.announcements enable row level security;
alter table public.practices     enable row level security;
alter table public.rsvps         enable row level security;
alter table public.lineups       enable row level security;
alter table public.carpools      enable row level security;

-- profiles: self full access; teammates can read (needed for lineups/rsvp lists)
create policy "profiles self" on public.profiles
  for all using (id = auth.uid()) with check (id = auth.uid());
create policy "profiles teammates read" on public.profiles
  for select using (public.shares_org_with(id));

-- organizations: members read; admins update
create policy "orgs member read" on public.organizations
  for select using (public.is_org_member(id));
create policy "orgs admin update" on public.organizations
  for update using (public.is_org_admin(id));

-- memberships: members see their org's roster; admins manage roles / remove
create policy "memberships member read" on public.memberships
  for select using (public.is_org_member(org_id));
create policy "memberships admin write" on public.memberships
  for update using (public.is_org_admin(org_id));
create policy "memberships admin delete" on public.memberships
  for delete using (public.is_org_admin(org_id));
create policy "memberships self leave" on public.memberships
  for delete using (user_id = auth.uid());

-- announcements: members read; admins write
create policy "announcements member read" on public.announcements
  for select using (public.is_org_member(org_id));
create policy "announcements admin write" on public.announcements
  for all using (public.is_org_admin(org_id)) with check (public.is_org_admin(org_id));

-- practices: members read; admins write
create policy "practices member read" on public.practices
  for select using (public.is_org_member(org_id));
create policy "practices admin write" on public.practices
  for all using (public.is_org_admin(org_id)) with check (public.is_org_admin(org_id));

-- rsvps: members read all rsvps in their org's practices; write own
create policy "rsvps member read" on public.rsvps
  for select using (exists (select 1 from practices p where p.id = practice_id and public.is_org_member(p.org_id)));
create policy "rsvps self write" on public.rsvps
  for all using (user_id = auth.uid()) with check (
    user_id = auth.uid()
    and exists (select 1 from practices p where p.id = practice_id and public.is_org_member(p.org_id))
  );

-- lineups: admins full; members read published
create policy "lineups admin all" on public.lineups
  for all using (public.is_org_admin(org_id)) with check (public.is_org_admin(org_id));
create policy "lineups member read published" on public.lineups
  for select using (published and public.is_org_member(org_id));

-- carpools: admins full; members read published
create policy "carpools admin all" on public.carpools
  for all using (public.is_org_admin(org_id)) with check (public.is_org_admin(org_id));
create policy "carpools member read published" on public.carpools
  for select using (published and public.is_org_member(org_id));

-- ---------- updated_at triggers ----------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();
create trigger rsvps_touch    before update on public.rsvps    for each row execute function public.touch_updated_at();
create trigger lineups_touch  before update on public.lineups  for each row execute function public.touch_updated_at();
create trigger carpools_touch before update on public.carpools for each row execute function public.touch_updated_at();
