-- Saved locations: named places with coordinates that pop up when creating events.
-- Managed by admins in Team settings; seeded below with the team's usual spots.

create table public.saved_locations (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations(id) on delete cascade,
  name       text not null,
  address    text,
  city       text,
  zipcode    text,
  lat        double precision,
  lon        double precision,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (org_id, name)
);
create index on public.saved_locations (org_id, sort_order);

alter table public.saved_locations enable row level security;
create policy "saved_locations member read" on public.saved_locations
  for select using (public.is_org_member(org_id));
create policy "saved_locations admin write" on public.saved_locations
  for all using (public.is_org_admin(org_id)) with check (public.is_org_admin(org_id));

-- ---------- seed: usual venues + campus pickup spots (added to every existing org) ----------
insert into public.saved_locations (org_id, name, address, city, zipcode, lat, lon, sort_order)
select o.id, l.name, l.address, l.city, l.zipcode, l.lat, l.lon, l.sort_order
from public.organizations o
cross join (values
  ('🛶 Mission Bay',                      '1750 Fiesta Island Rd',  'San Diego',  '92109', 32.7784362, -117.2154320,  0),
  ('🌵 Tempe Town Lake',                  '550 East Tempe Townlake','Tempe',      '85281', 33.4344494, -111.9325081,  1),
  ('👶 Marine Stadium',                   '5255 E Paoli Way',       'Long Beach', '90803', 33.7682307, -118.1298836,  2),
  ('Eighth College',                      '9500 Gilman Dr',         'La Jolla',   '92161', 32.8726699, -117.2424597,  3),
  ('Thurgood Marshall Residence Halls',   'Scholars Dr N',          'San Diego',  '92121', 32.8829967, -117.2426633,  4),
  ('Sixth College',                       '9500 Gilman Dr',         'La Jolla',   '92093', 32.8807011, -117.2420455,  5),
  ('John Muir College',                   '9500 Gilman Dr',         'La Jolla',   '92093', 32.8791351, -117.2430896,  6),
  ('Revelle College',                     '9500 Gilman Dr',         'La Jolla',   '92093', 32.8753781, -117.2418523,  7),
  ('Seventh College',                     '7-3 Scholars Dr N',      'La Jolla',   '92093', 32.8880403, -117.2425438,  8),
  ('Earl Warren College',                 '9500 Gilman Dr #0422',   'La Jolla',   '92093', 32.8822443, -117.2341198,  9),
  ('Rita Atkinson Residences',            '9165 Pharmacy Ln',       'La Jolla',   '92093', 32.8728980, -117.2353067, 10),
  ('Pepper Canyon West (Vela)',           '9610 Gilman Dr',         'La Jolla',   '92093', 32.8771667, -117.2330451, 11)
) as l(name, address, city, zipcode, lat, lon, sort_order)
on conflict (org_id, name) do nothing;
