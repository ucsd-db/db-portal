import Link from "next/link";
import { requireAdmin } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import LocalTime from "@/components/local-time";
import { deleteEvent, deleteGroup } from "../actions";
import { createFormForGroup } from "../forms/actions";
import EventBatchForm from "@/components/event-batch-form";
import ConfirmForm from "@/components/confirm-form";
import type { EventGroup } from "@/lib/database.types";

/** Admin: Events are containers; each holds Day cards. */
export default async function AdminEventsPage() {
  const { org } = await requireAdmin();
  const supabase = await createClient();
  const [{ data: days }, { data: groups }] = await Promise.all([
    supabase.from("events").select("*, rsvps(status)").eq("org_id", org.id).order("starts_at", { ascending: false }).limit(120),
    supabase.from("event_groups").select("*").eq("org_id", org.id),
  ]);
  type Day = NonNullable<typeof days>[number];
  const byGroup = new Map<string, Day[]>();
  const loose: Day[] = [];
  for (const d of days ?? []) { if (d.group_id) { byGroup.set(d.group_id, [...(byGroup.get(d.group_id) ?? []), d]); } else loose.push(d); }
  const groupMap = new Map((groups ?? []).map((g) => [g.id, g]));
  // Containers: real events (groups) + legacy loose days as their own container, sorted by most recent day.
  const containers: { group: EventGroup | null; days: Day[] }[] = [
    ...[...byGroup.entries()].map(([gid, ds]) => ({ group: groupMap.get(gid) ?? null, days: [...ds].sort((a, b) => a.starts_at.localeCompare(b.starts_at)) })),
    ...loose.map((d) => ({ group: null, days: [d] })),
  ].sort((a, b) => b.days[b.days.length - 1].starts_at.localeCompare(a.days[a.days.length - 1].starts_at));

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <section>
        <h1 className="text-2xl font-normal mb-1">New event</h1>
        <p className="text-sm mb-3" style={{ color: "var(--g-grey-600)" }}>An event is the container (e.g. “Spring Week 8 Practice”); pick its days and type the times.</p>
        <EventBatchForm />
      </section>
      <section>
        <h2 className="text-lg font-medium mb-3">All events</h2>
        <div className="space-y-3">
          {containers.map(({ group, days: ds }, i) => {
            const total = ds.reduce((a, d) => a + (d.rsvps as { status: string }[]).filter((r) => r.status === "yes").length, 0);
            return (
              <div key={group?.id ?? ds[0].id} className="rounded-lg border" style={{ borderColor: "var(--g-grey-300)", background: "#fff" }}>
                <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2" style={{ borderColor: "var(--g-grey-300)", background: "var(--g-grey-50)" }}>
                  <div className="min-w-0 flex-1">
                    <Link href={group ? `/groups/${group.id}` : `/events/${ds[0].id}`} className="font-medium hover:underline">{group?.name ?? ds[0].title}</Link>
                    <span className="ml-2 text-[10px] uppercase" style={{ color: "var(--g-grey-600)" }}>{group?.kind ?? ds[0].kind} · {ds.length} day{ds.length === 1 ? "" : "s"} · {total} yes</span>
                  </div>
                  {group && (
                    <div className="flex items-center gap-1 text-xs">
                      <Link href={`/groups/${group.id}`} className="btn-text py-0.5">Overview</Link>
                      <form action={createFormForGroup}><input type="hidden" name="group_id" value={group.id} /><button className="btn-text py-0.5">📝 Form</button></form>
                      <ConfirmForm action={deleteGroup} message={`Delete "${group.name}" and all ${ds.length} of its days?`}><input type="hidden" name="id" value={group.id} /><input type="hidden" name="with_events" value="on" /><button className="btn-danger-text py-0.5">Delete</button></ConfirmForm>
                    </div>
                  )}
                </div>
                <ul className="divide-y" style={{ borderColor: "var(--g-grey-300)" }}>
                  {ds.map((p) => {
                    const r = p.rsvps as { status: string }[];
                    const c = (s: string) => r.filter((x) => x.status === s).length;
                    return (
                      <li key={p.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                        <div className="w-12 shrink-0 rounded border text-center overflow-hidden text-[10px]" style={{ borderColor: "var(--g-grey-300)" }}>
                          <div className="uppercase text-white" style={{ background: "var(--g-blue)" }}><LocalTime iso={p.starts_at} mode="month" /></div>
                          <div className="text-base font-medium leading-tight py-0.5"><LocalTime iso={p.starts_at} mode="day" /></div>
                        </div>
                        <div className="min-w-0 flex-1">
                          <Link href={`/events/${p.id}`} className="font-medium hover:underline">{p.title}</Link>
                          <div className="text-xs" style={{ color: "var(--g-grey-600)" }}><LocalTime iso={p.starts_at} /> · ✅ {c("yes")} · 🤔 {c("maybe")} · ❌ {c("no")}</div>
                        </div>
                        <div className="flex shrink-0 items-center gap-1 text-xs">
                          <Link href={`/admin/lineups?event=${p.id}`} className="btn-text py-0.5">Lineups</Link>
                          <Link href={`/admin/carpool?event=${p.id}`} className="btn-text py-0.5">Carpool</Link>
                          <ConfirmForm action={deleteEvent} message={`Delete "${p.title}"?`}><input type="hidden" name="id" value={p.id} /><button className="btn-danger-text py-0.5" title="Delete day">✕</button></ConfirmForm>
                        </div>
                      </li>
                    );
                  })}
                </ul>
                {i === 0 && !group && null}
              </div>
            );
          })}
          {!containers.length && <p className="text-sm" style={{ color: "var(--g-grey-600)" }}>No events yet.</p>}
        </div>
      </section>
    </div>
  );
}
