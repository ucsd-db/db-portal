-- Security hardening (identity + authz), from the 2026-09 security audit.
--
-- 1) profiles.email is the identity key for sign-in and roster linking, but the
--    "profiles self" RLS policy let users update ANY column — including email —
--    via PostgREST, enabling impersonation of rostered emails and a permanent
--    signup DoS. Lock it: users can no longer change their own email.
-- 2) Unique on lower(email) so two accounts can never claim the same address.
-- 3) Images bucket: writes were open to any authenticated user of the whole
--    project. Scope upload + delete to org admins (only admin editors upload).
-- 4) join_organization: throttle bad join-code guesses (20/hour per user) and
--    add a rotate RPC so a leaked code can be retired.

-- ---------- email lockdown ----------
update public.profiles set email = lower(email) where email <> lower(email);
update public.pending_members set email = lower(email) where email <> lower(email);

-- Will fail if two profiles already share an email (case-insensitively);
-- resolve duplicates manually first if so.
create unique index profiles_email_lower_key on public.profiles (lower(email));

create or replace function public.lock_profile_email()
returns trigger language plpgsql as $$
begin
  -- Block PostgREST clients (anon/authenticated); service role and direct SQL stay free.
  if new.email is distinct from old.email
     and coalesce(auth.role(), '') in ('anon', 'authenticated') then
    raise exception 'email cannot be changed';
  end if;
  return new;
end $$;

create trigger profiles_email_lock before update on public.profiles
  for each row execute function public.lock_profile_email();

-- ---------- images bucket: admin-only writes ----------
drop policy "images auth upload" on storage.objects;
drop policy "images auth delete" on storage.objects;

create policy "images admin upload" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'images'
    and exists (select 1 from public.memberships m where m.user_id = auth.uid() and m.role = 'admin')
  );
create policy "images admin delete" on storage.objects
  for delete to authenticated using (
    bucket_id = 'images'
    and exists (select 1 from public.memberships m where m.user_id = auth.uid() and m.role = 'admin')
  );

-- ---------- join-code guessing throttle + rotation ----------
create table public.join_attempts (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  count        int not null default 0,
  window_start timestamptz not null default now()
);
alter table public.join_attempts enable row level security;  -- no policies: RPC-only

create or replace function public.join_organization(code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare oid uuid; att record;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;

  insert into join_attempts (user_id) values (auth.uid()) on conflict (user_id) do nothing;
  select * into att from join_attempts where user_id = auth.uid() for update;
  if att.window_start < now() - interval '1 hour' then
    update join_attempts set count = 0, window_start = now() where user_id = auth.uid();
    att.count := 0;
  end if;
  if att.count >= 20 then raise exception 'too many attempts — try again later'; end if;

  select id into oid from organizations where join_code = upper(trim(code));
  if oid is null then
    update join_attempts set count = count + 1 where user_id = auth.uid();
    raise exception 'invalid join code';
  end if;
  insert into memberships (org_id, user_id, role) values (oid, auth.uid(), 'member')
    on conflict do nothing;
  return oid;
end $$;

create or replace function public.rotate_join_code(org uuid)
returns text language plpgsql security definer set search_path = public as $$
declare code text;
begin
  if not public.is_org_admin(org) then raise exception 'not an admin of this org'; end if;
  code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
  update organizations set join_code = code where id = org;
  return code;
end $$;
