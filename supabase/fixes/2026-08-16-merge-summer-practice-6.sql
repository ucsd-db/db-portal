-- One-off: merge every day of "Summer Practice #6" into ONE event (group) with that exact name,
-- and rename each day to the convention "Saturday 8/22". Safe to re-run.
--
-- Matches days whose title contains the pattern OR that already belong to an event/group whose
-- name contains it. Edit the pattern on the next line if needed.
do $$
declare
  pattern text := '%summer practice%6%';
  target_name text := 'Summer Practice #6';
  oid uuid;
  gid uuid;
begin
  -- 1. which org (assumes the matching days are all in one org)
  select e.org_id into oid
  from events e left join event_groups g on g.id = e.group_id
  where e.title ilike pattern or g.name ilike pattern
  limit 1;
  if oid is null then raise notice 'No matching days found for %', pattern; return; end if;

  -- 2. reuse an existing group with the target name in that org, else create it
  select id into gid from event_groups where org_id = oid and name = target_name limit 1;
  if gid is null then
    insert into event_groups (org_id, name, kind) values (oid, target_name, 'practice') returning id into gid;
  end if;

  -- 3. move all matching days into it
  update events e set group_id = gid
  where e.org_id = oid and e.id in (
    select e2.id from events e2 left join event_groups g on g.id = e2.group_id
    where e2.org_id = oid and (e2.title ilike pattern or g.name ilike pattern)
  );

  -- 4. rename those days: "Saturday 8/22" (team timezone)
  update events set title = trim(to_char(starts_at at time zone 'America/Los_Angeles', 'FMDay FMMM/FMDD'))
  where group_id = gid;

  -- 5. drop groups that are now empty (the auto-created ones)
  delete from event_groups g where g.org_id = oid and g.id <> gid
    and not exists (select 1 from events e where e.group_id = g.id);

  raise notice 'Merged into event % (%)', target_name, gid;
end $$;

-- OPTIONAL — apply the "Saturday 8/22" convention to ALL existing days in every event.
-- Uncomment and run if you want everything renamed (this overwrites custom day names).
-- update events set title = trim(to_char(starts_at at time zone 'America/Los_Angeles', 'FMDay FMMM/FMDD'))
--   where group_id is not null;
