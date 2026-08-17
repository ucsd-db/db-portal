-- Event groups: a wrapper around several day-events (e.g. "Spring Week 8 Practice" = Sat + Sun),
-- so lineups / rides / attendance for the whole thing can be viewed on one screen.
create table public.event_groups (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations(id) on delete cascade,
  name       text not null,
  kind       text not null default 'practice' check (kind in ('practice','race','social','other')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index on public.event_groups (org_id, created_at desc);

alter table public.events add column group_id uuid references public.event_groups(id) on delete set null;
create index on public.events (group_id);

alter table public.event_groups enable row level security;
create policy "event_groups member read" on public.event_groups
  for select using (public.is_org_member(org_id));
create policy "event_groups admin write" on public.event_groups
  for all using (public.is_org_admin(org_id)) with check (public.is_org_admin(org_id));
