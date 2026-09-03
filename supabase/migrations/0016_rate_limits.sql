-- Rate limiting for the unauthenticated surfaces (sign-in, public form submit,
-- join-code checks). Postgres-backed fixed window: free tier, durable across
-- serverless instances. Called only via the service role from server code.

create table public.rate_limits (
  key          text primary key,
  count        int not null default 0,
  window_start timestamptz not null default now()
);
alter table public.rate_limits enable row level security;  -- no policies: service-role only

-- Counts a hit and returns whether the caller is still within p_max per p_window.
create or replace function public.hit_rate_limit(p_key text, p_max int, p_window interval)
returns boolean language plpgsql security definer set search_path = public as $$
declare r record;
begin
  insert into rate_limits (key) values (p_key) on conflict (key) do nothing;
  select * into r from rate_limits where key = p_key for update;
  if r.window_start < now() - p_window then
    update rate_limits set count = 1, window_start = now() where key = p_key;
    return true;
  end if;
  update rate_limits set count = r.count + 1 where key = p_key;
  return r.count + 1 <= p_max;
end $$;

revoke execute on function public.hit_rate_limit(text, int, interval) from public, anon, authenticated;
grant execute on function public.hit_rate_limit(text, int, interval) to service_role;

-- Housekeeping: piggyback on the existing pg_cron setup (0014) to purge stale
-- windows daily so bot IPs don't accumulate rows forever.
select cron.schedule(
  'purge-rate-limits',
  '15 9 * * *',
  $$ delete from public.rate_limits where window_start < now() - interval '1 day' $$
);
