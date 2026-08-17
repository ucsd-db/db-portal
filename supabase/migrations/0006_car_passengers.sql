-- "Drives" checkbox + seats → single number: how many passengers a member can take (0 = doesn't drive).
alter table public.profiles rename column car_seats to car_passengers;
alter table public.profiles drop constraint if exists profiles_car_seats_check;
alter table public.profiles alter column car_passengers set default 0;
update public.profiles set car_passengers = case when can_drive then greatest(coalesce(car_passengers,4) - 1, 1) else 0 end;
alter table public.profiles alter column car_passengers set not null;
alter table public.profiles add constraint profiles_car_passengers_check check (car_passengers between 0 and 14);
alter table public.profiles drop column can_drive;

alter table public.pending_members rename column car_seats to car_passengers;
alter table public.pending_members alter column car_passengers set default 0;
update public.pending_members set car_passengers = case when can_drive then greatest(coalesce(car_passengers,4) - 1, 1) else 0 end;
alter table public.pending_members alter column car_passengers set not null;
alter table public.pending_members drop column can_drive;

drop function if exists public.admin_add_member(uuid, text, text, text, text, text, double precision, double precision, boolean, text, numeric, int);
create or replace function public.admin_add_member(
  p_org uuid, p_email text, p_full_name text default '', p_address text default null, p_city text default null,
  p_zipcode text default null, p_lat double precision default null, p_lon double precision default null,
  p_car_passengers int default null, p_gender text default null, p_weight_lb numeric default null
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
      car_passengers = coalesce(p_car_passengers, car_passengers),
      gender = coalesce(p_gender, gender), weight_lb = coalesce(p_weight_lb, weight_lb)
    where id = uid;
    delete from pending_members where org_id = p_org and email = em;
    return 'linked';
  end if;
  insert into pending_members (org_id, email, full_name, address, city, zipcode, lat, lon, car_passengers, gender, weight_lb)
  values (p_org, em, coalesce(p_full_name,''), p_address, p_city, p_zipcode, p_lat, p_lon, coalesce(p_car_passengers,0), p_gender, p_weight_lb)
  on conflict (org_id, email) do update set
    full_name = excluded.full_name, address = excluded.address, city = excluded.city, zipcode = excluded.zipcode,
    lat = excluded.lat, lon = excluded.lon, car_passengers = excluded.car_passengers,
    gender = excluded.gender, weight_lb = excluded.weight_lb;
  return 'pending';
end $$;

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
      car_passengers = greatest(car_passengers, pm.car_passengers),
      gender = coalesce(gender, pm.gender), weight_lb = coalesce(weight_lb, pm.weight_lb)
    where id = new.id;
    delete from pending_members where org_id = pm.org_id and email = pm.email;
  end loop;
  return new;
end $$;
