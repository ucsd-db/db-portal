-- Late responses: forms accept submissions after the due date; responses are flagged late
-- based on the FIRST submission time, so editing an on-time response later keeps it on time.

alter table public.form_responses add column first_submitted_at timestamptz;
update public.form_responses set first_submitted_at = submitted_at where first_submitted_at is null;

create or replace function public.keep_first_submitted()
returns trigger language plpgsql as $$
begin
  if tg_op = 'UPDATE' then
    new.first_submitted_at := coalesce(old.first_submitted_at, new.submitted_at, now());
  else
    new.first_submitted_at := coalesce(new.first_submitted_at, new.submitted_at, now());
  end if;
  return new;
end $$;

drop trigger if exists form_responses_first_submitted on public.form_responses;
create trigger form_responses_first_submitted
  before insert or update on public.form_responses
  for each row execute function public.keep_first_submitted();
