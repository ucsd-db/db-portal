-- Admin-managed roster: add members before they sign up, edit member fields, city/zip columns.

alter table public.profiles add column if not exists city text;
alter table public.profiles add column if not exists zipcode text;

-- Members added by an admin who haven't signed up yet. Claimed automatically on sign-up (by email).
create table public.pending_members (
  org_id     uuid not null references public.organizations(id) on delete cascade,
  email      text not null,
  full_name  text not null default '',
  address    text, city text, zipcode text,
  lat        double precision, lon double precision,
  can_drive  boolean not null default false,
  car_seats  int,
  gender     text check (gender in ('male','female','other')),
  weight_lb  numeric(5,1),
  created_at timestamptz not null default now(),
  primary key (org_id, email)
);
alter table public.pending_members enable row level security;
create policy "pending admin all" on public.pending_members
  for all using (public.is_org_admin(org_id)) with check (public.is_org_admin(org_id));

-- Is the caller an admin of some org the other user belongs to?
create or replace function public.admin_of_user(other uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from memberships a join memberships b on a.org_id = b.org_id
    where a.user_id = auth.uid() and a.role = 'admin' and b.user_id = other
  );
$$;
create policy "profiles admin update" on public.profiles
  for update using (public.admin_of_user(id)) with check (public.admin_of_user(id));

-- Add (or link) a member. Returns 'linked' if the email already has an account, else 'pending'.
create or replace function public.admin_add_member(
  p_org uuid, p_email text, p_full_name text default '', p_address text default null, p_city text default null,
  p_zipcode text default null, p_lat double precision default null, p_lon double precision default null,
  p_can_drive boolean default false, p_gender text default null, p_weight_lb numeric default null, p_car_seats int default null
) returns text language plpgsql security definer set search_path = public as $$
declare uid uuid; em text := lower(trim(p_email));
begin
  if not public.is_org_admin(p_org) then raise exception 'not an admin of this org'; end if;
  if em = '' then raise exception 'email required'; end if;
  select id into uid from profiles where lower(email) = em limit 1;
  if uid is not null then
    insert into memberships (org_id, user_id, role) values (p_org, uid, 'member') on conflict do nothing;
    update profiles set
      full_name = case when coalesce(full_name,'') = '' then coalesce(p_full_name, full_name) else full_name end,
      address = coalesce(p_address, address), city = coalesce(p_city, city), zipcode = coalesce(p_zipcode, zipcode),
      lat = coalesce(p_lat, lat), lon = coalesce(p_lon, lon),
      can_drive = coalesce(p_can_drive, can_drive), car_seats = coalesce(p_car_seats, car_seats),
      gender = coalesce(p_gender, gender), weight_lb = coalesce(p_weight_lb, weight_lb)
    where id = uid;
    delete from pending_members where org_id = p_org and email = em;
    return 'linked';
  end if;
  insert into pending_members (org_id, email, full_name, address, city, zipcode, lat, lon, can_drive, car_seats, gender, weight_lb)
  values (p_org, em, coalesce(p_full_name,''), p_address, p_city, p_zipcode, p_lat, p_lon, coalesce(p_can_drive,false), p_car_seats, p_gender, p_weight_lb)
  on conflict (org_id, email) do update set
    full_name = excluded.full_name, address = excluded.address, city = excluded.city, zipcode = excluded.zipcode,
    lat = excluded.lat, lon = excluded.lon, can_drive = excluded.can_drive, car_seats = excluded.car_seats,
    gender = excluded.gender, weight_lb = excluded.weight_lb;
  return 'pending';
end $$;

-- When someone signs up, claim any pending rows for their email: join the org(s) and prefill their profile.
create or replace function public.claim_pending_members()
returns trigger language plpgsql security definer set search_path = public as $$
declare pm record;
begin
  for pm in select * from pending_members where email = lower(new.email) loop
    insert into memberships (org_id, user_id, role) values (pm.org_id, new.id, 'member') on conflict do nothing;
    update profiles set
      full_name = case when coalesce(full_name,'') = '' then pm.full_name else full_name end,
      address = coalesce(address, pm.address), city = coalesce(city, pm.city), zipcode = coalesce(zipcode, pm.zipcode),
      lat = coalesce(lat, pm.lat), lon = coalesce(lon, pm.lon),
      can_drive = can_drive or pm.can_drive, car_seats = coalesce(car_seats, pm.car_seats),
      gender = coalesce(gender, pm.gender), weight_lb = coalesce(weight_lb, pm.weight_lb)
    where id = new.id;
    delete from pending_members where org_id = pm.org_id and email = pm.email;
  end loop;
  return new;
end $$;
drop trigger if exists claim_pending_on_profile on public.profiles;
create trigger claim_pending_on_profile
  after insert on public.profiles
  for each row execute function public.claim_pending_members();
