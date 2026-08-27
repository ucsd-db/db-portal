-- Form templates: "Practice form" keeps the automatic weight question, "Blank form" starts without it.
-- Existing forms keep today's behavior (weight question on).
alter table public.forms add column ask_weight boolean not null default true;
