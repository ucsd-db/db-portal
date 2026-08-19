-- Passwordless (email-only) sign-in. The app signs members in server-side with the service role
-- (generateLink + verifyOtp, no email sent). Admins who have set a password are still asked for it;
-- this helper lets the server tell whether a user has one.
create or replace function public.user_has_password(uid uuid)
returns boolean language sql stable security definer set search_path = auth as $$
  select coalesce(encrypted_password, '') <> '' from auth.users where id = uid;
$$;
revoke execute on function public.user_has_password(uuid) from public, anon, authenticated;
grant execute on function public.user_has_password(uuid) to service_role;
