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

-- ---------- pickup locations (e.g. campus colleges) ----------
create table public.pickup_locations (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations(id) on delete cascade,
  name       text not null,
  lat        double precision,
  lon        double precision,
  sort_order int not null default 0,
  active     boolean not null default true
);
create index on public.pickup_locations (org_id, sort_order);

-- ---------- events (practices, races, socials) + attendance (rsvps) ----------
create table public.events (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references public.organizations(id) on delete cascade,
  kind           text not null default 'practice' check (kind in ('practice','race','social','other')),
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
create index on public.events (org_id, starts_at);

-- ---------- forms (weekly practice form, race logistics form, ...) ----------
-- A form bundles: a description, a due date, one or more events (each gets the
-- standard attendance+ride question), and custom questions (jsonb array of
-- { id, type: short_text|long_text|single_choice|multi_choice|yes_no|number,
--   label, help?, required?, options?[] }).
create table public.forms (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  title       text not null,
  description text not null default '',
  due_at      timestamptz,
  status      text not null default 'draft' check (status in ('draft','open','closed')),
  questions   jsonb not null default '[]'::jsonb,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index on public.forms (org_id, status, due_at);

create table public.form_events (
  form_id    uuid not null references public.forms(id) on delete cascade,
  event_id   uuid not null references public.events(id) on delete cascade,
  sort_order int not null default 0,
  prompt     text,          -- optional override for "Will you be attending X?"
  primary key (form_id, event_id)
);

-- One response per user per form; resubmitting overwrites (latest wins).
create table public.form_responses (
  form_id      uuid not null references public.forms(id) on delete cascade,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  answers      jsonb not null default '{}'::jsonb,   -- { [questionId]: value }
  submitted_at timestamptz not null default now(),
  primary key (form_id, user_id)
);

create table public.rsvps (
  event_id    uuid not null references public.events(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  status      text not null check (status in ('yes','no','maybe')),
  -- ride coordination for this specific event
  --   driver = drives self AND others; self = own ride, no passengers; needs_ride
  ride        text not null default 'none' check (ride in ('none','driver','self','needs_ride')),
  seats       int check (seats between 1 and 15),
  pickup_location_id uuid references public.pickup_locations(id) on delete set null,
  pickup_address text,       -- custom pickup spot (falls back to profile address if null)
  note        text,
  form_id     uuid references public.forms(id) on delete set null,   -- which form it came through
  updated_at  timestamptz not null default now(),
  primary key (event_id, user_id)
);

-- ---------- lineups & carpools (algorithm state stored as jsonb) ----------
create table public.lineups (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  event_id    uuid references public.events(id) on delete set null,
  name        text not null,
  boat_type   text not null default 'open' check (boat_type in ('open','womens','mixed')),
  data        jsonb not null default '{}'::jsonb,   -- @db/lineup Lineup shape
  published   boolean not null default false,       -- visible to members when true
  created_by  uuid references public.profiles(id) on delete set null,
  updated_at  timestamptz not null default now()
);
create index on public.lineups (org_id, event_id);

create table public.carpools (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  event_id    uuid not null references public.events(id) on delete cascade,
  data        jsonb not null default '{}'::jsonb,   -- @db/carpool { cars, unassigned, mode }
  published   boolean not null default false,
  updated_at  timestamptz not null default now(),
  unique (event_id)
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
alter table public.pickup_locations enable row level security;
alter table public.events        enable row level security;
alter table public.forms         enable row level security;
alter table public.form_events   enable row level security;
alter table public.form_responses enable row level security;
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

-- pickup locations: members read; admins write
create policy "pickups member read" on public.pickup_locations
  for select using (public.is_org_member(org_id));
create policy "pickups admin write" on public.pickup_locations
  for all using (public.is_org_admin(org_id)) with check (public.is_org_admin(org_id));

-- events: members read; admins write
create policy "events member read" on public.events
  for select using (public.is_org_member(org_id));
create policy "events admin write" on public.events
  for all using (public.is_org_admin(org_id)) with check (public.is_org_admin(org_id));

-- forms: members read open/closed forms; admins everything
create policy "forms member read" on public.forms
  for select using (status <> 'draft' and public.is_org_member(org_id));
create policy "forms admin all" on public.forms
  for all using (public.is_org_admin(org_id)) with check (public.is_org_admin(org_id));

create policy "form_events member read" on public.form_events
  for select using (exists (select 1 from forms f where f.id = form_id and public.is_org_member(f.org_id)));
create policy "form_events admin write" on public.form_events
  for all using (exists (select 1 from forms f where f.id = form_id and public.is_org_admin(f.org_id)))
  with check (exists (select 1 from forms f where f.id = form_id and public.is_org_admin(f.org_id)));

-- form responses: own read/write (only while form is open); admins read all
create policy "responses self" on public.form_responses
  for all using (user_id = auth.uid()) with check (
    user_id = auth.uid()
    and exists (select 1 from forms f where f.id = form_id and f.status = 'open' and public.is_org_member(f.org_id))
  );
create policy "responses admin read" on public.form_responses
  for select using (exists (select 1 from forms f where f.id = form_id and public.is_org_admin(f.org_id)));

-- rsvps: members read all rsvps in their org's events; write own; admins can edit any
create policy "rsvps member read" on public.rsvps
  for select using (exists (select 1 from events e where e.id = event_id and public.is_org_member(e.org_id)));
create policy "rsvps self write" on public.rsvps
  for all using (user_id = auth.uid()) with check (
    user_id = auth.uid()
    and exists (select 1 from events e where e.id = event_id and public.is_org_member(e.org_id))
  );
create policy "rsvps admin write" on public.rsvps
  for all using (exists (select 1 from events e where e.id = event_id and public.is_org_admin(e.org_id)))
  with check (exists (select 1 from events e where e.id = event_id and public.is_org_admin(e.org_id)));

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
create trigger forms_touch    before update on public.forms    for each row execute function public.touch_updated_at();
create trigger lineups_touch  before update on public.lineups  for each row execute function public.touch_updated_at();
create trigger carpools_touch before update on public.carpools for each row execute function public.touch_updated_at();
