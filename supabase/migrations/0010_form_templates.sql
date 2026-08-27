-- Editable form templates: a template is a form with status 'template'.
-- The admin "Start a new form" area shows one card per template; creating a form copies
-- title/description/questions/ask_weight. Members never see templates.

alter table public.forms drop constraint forms_status_check;
alter table public.forms add constraint forms_status_check check (status in ('draft','open','closed','template'));

drop policy "forms member read" on public.forms;
create policy "forms member read" on public.forms
  for select using (status not in ('draft','template') and public.is_org_member(org_id));

-- Seed the current default as an editable "Practice form" template (one per org).
insert into public.forms (org_id, title, status, ask_weight)
select o.id, 'Practice form', 'template', true
from public.organizations o
where not exists (select 1 from public.forms f where f.org_id = o.id and f.status = 'template');
