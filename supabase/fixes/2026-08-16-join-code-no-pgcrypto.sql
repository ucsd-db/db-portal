-- One-off fix for projects that already ran 0001_init.sql before this change.
-- (0001_init.sql itself is updated; fresh projects don't need this.)
create or replace function public.create_organization(org_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare new_id uuid; code text;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
  insert into organizations (name, join_code, created_by) values (org_name, code, auth.uid()) returning id into new_id;
  insert into memberships (org_id, user_id, role) values (new_id, auth.uid(), 'admin');
  return new_id;
end $$;
