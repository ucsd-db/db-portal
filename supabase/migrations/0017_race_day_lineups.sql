-- Race-day lineups: a day can hold free-form divisions ("Mixed 500m", validated
-- via boat_type), each with boats ("A", "B"), each boat with one lineup row per
-- race ("Qualifying", "Final"). division null => practice/custom lineup (name =
-- boat name, exactly as before). RLS unchanged: existing lineups policies apply.

alter table public.lineups
  add column division   text,          -- display name of the division; null = practice/custom
  add column boat_label text,          -- "A", "B", ... within the division
  add column created_at timestamptz not null default now();

-- Best-guess backfill so existing rows sort sensibly.
update public.lineups set created_at = updated_at;

alter table public.lineups
  add constraint lineups_boat_label_requires_division
  check (boat_label is null or division is not null);
