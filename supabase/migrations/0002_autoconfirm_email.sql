-- Auto-confirm email on sign-up so a small team doesn't depend on Supabase's
-- rate-limited built-in mailer (2 emails/hour) or the dashboard "Confirm email" toggle.
-- Accounts are useless without an org join code anyway.
create or replace function public.autoconfirm_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.email_confirmed_at is null then
    new.email_confirmed_at := now();
  end if;
  return new;
end $$;

drop trigger if exists autoconfirm_email on auth.users;
create trigger autoconfirm_email
  before insert on auth.users
  for each row execute function public.autoconfirm_new_user();

-- Also unblock anyone who signed up before this trigger existed.
update auth.users set email_confirmed_at = now() where email_confirmed_at is null;
