-- Auto-generate draft carpools once a form's due date passes.
--
-- The app exposes POST /api/cron/carpools (secret-protected); pg_cron pokes it
-- every 10 minutes via pg_net. The endpoint finds forms past their due date,
-- generates a draft carpool for each linked event day (skipping any event
-- where an admin already started one), and stamps carpools_generated_at so a
-- form is only ever processed once.
--
-- BEFORE RUNNING: replace the two placeholders below —
--   <SITE_URL>     e.g. https://your-app.vercel.app   (no trailing slash)
--   <CRON_SECRET>  the same value set as CRON_SECRET in Vercel env vars

-- Once-per-form marker.
alter table public.forms add column carpools_generated_at timestamptz;

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'auto-carpools',
  '*/10 * * * *',
  $$
  select net.http_post(
    url     := '<SITE_URL>/api/cron/carpools',
    headers := jsonb_build_object('Authorization', 'Bearer <CRON_SECRET>')
  );
  $$
);
