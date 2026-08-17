import { notFound } from "next/navigation";
import Link from "next/link";
import { requireOrg } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import LocalTime from "@/components/local-time";
import LineupView from "@/components/lineup-view";
import RichText from "@/components/rich-text";
import EventBatchForm from "@/components/event-batch-form";
import { deleteGroup, renameGroup } from "@/app/(app)/admin/actions";
import type { Lineup } from "@db/lineup";
import type { Car } from "@db/carpool";
import type { Rsvp } from "@/lib/database.types";

/** One screen for a whole event group (e.g. a practice week): every day's attendance, lineups and rides. */
export default async function GroupOverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { org, isAdmin } = await requireOrg();
  const supabase = await createClient();
  const [{ data: group }, { data: events }, { data: teammates }, { data: pickups }] = await Promise.all([
    supabase.from("event_groups").select("*").eq("id", id).eq("org_id", org.id).maybeSingle(),
    supabase.from("events").select("*").eq("group_id", id).order("starts_at"),
    supabase.from("profiles").select("id, full_name, email"),
    supabase.from("pickup_locations").select("id, name").eq("org_id", org.id),
  ]);
  if (!group) notFound();
  const eventIds = (events ?? []).map((e) => e.id);
  const [{ data: rsvps }, { data: lineups }, { data: carpools }] = eventIds.length
    ? await Promise.all([
        supabase.from("rsvps").select("*").in("event_id", eventIds),
        supabase.from("lineups").select("*").in("event_id", eventIds).order("name"),
        supabase.from("carpools").select("*").in("event_id", eventIds),
      ])
    : [{ data: [] as Rsvp[] }, { data: [] }, { data: [] }];
  const names: Record<string, string> = {};
  for (const t of teammates ?? []) names[t.id] = t.full_name || t.email;
  const pickupName = new Map((pickups ?? []).map((p) => [p.id, p.name]));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-wide" style={{ color: "var(--g-grey-600)" }}>{group.kind} · {events?.length ?? 0} day{events?.length === 1 ? "" : "s"}</div>
          {isAdmin ? (
            <form action={renameGroup} className="flex items-center gap-2">
              <input type="hidden" name="id" value={group.id} />
              <input name="name" defaultValue={group.name} className="input-line text-2xl font-normal w-[28rem] max-w-full" />
              <button className="btn-text">Rename</button>
            </form>
          ) : <h1 className="text-2xl font-normal">{group.name}</h1>}
        </div>
        {isAdmin && (
          <details className="relative">
            <summary className="btn-secondary cursor-pointer list-none">＋ Add days to this group</summary>
            <div className="absolute right-0 z-10 mt-2 w-[34rem] max-w-[90vw] rounded-lg border bg-white p-4 shadow-lg" style={{ borderColor: "var(--g-grey-300)" }}>
              <EventBatchForm compact groupId={group.id} />
            </div>
          </details>
        )}
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(auto-fit, minmax(${(events?.length ?? 1) > 1 ? 340 : 480}px, 1fr))` }}>
        {events?.map((ev) => {
          const rs = (rsvps ?? []).filter((r) => r.event_id === ev.id);
          const yes = rs.filter((r) => r.status === "yes"), maybe = rs.filter((r) => r.status === "maybe"), no = rs.filter((r) => r.status === "no");
          const drivers = rs.filter((r) => r.ride === "driver"), needs = rs.filter((r) => r.ride === "needs_ride");
          const seats = drivers.reduce((a, r) => a + (r.seats ?? 0), 0);
          const evLineups = (lineups ?? []).filter((l) => l.event_id === ev.id && (isAdmin || l.published));
          const cp = (carpools ?? []).find((c) => c.event_id === ev.id && (isAdmin || c.published));
          const cars = ((cp?.data as { cars?: Car[] } | null)?.cars ?? []);
          return (
            <section key={ev.id} className="card space-y-3 !p-4">
              <header>
                <Link href={`/events/${ev.id}`} className="font-medium text-base hover:underline">{ev.title}</Link>
                <div className="text-sm" style={{ color: "var(--g-grey-600)" }}><LocalTime iso={ev.starts_at} />{ev.ends_at && <> – <LocalTime iso={ev.ends_at} mode="time" /></>}{ev.location_name && ` · 📍 ${ev.location_name}`}</div>
                {ev.notes && <RichText text={ev.notes} className="!text-xs mt-1" />}
              </header>

              <div className="rounded-lg p-3 text-sm" style={{ background: "var(--g-grey-50)" }}>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                  <span>✅ <b>{yes.length}</b> yes</span><span>🤔 {maybe.length} maybe</span><span>❌ {no.length} no</span>
                  <span>👑 {drivers.length} drivers · 💺 {seats} seats</span><span>🙋 <b>{needs.length}</b> need rides</span>
                </div>
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs" style={{ color: "var(--g-blue)" }}>Who&apos;s coming</summary>
                  <ul className="mt-1 columns-2 text-xs">
                    {[...yes, ...maybe].map((r) => (
                      <li key={r.user_id}>{names[r.user_id] ?? "?"}{r.status === "maybe" && " (maybe)"}
                        {r.ride === "driver" && ` 👑${r.seats ?? ""}`}{r.ride === "needs_ride" && ` 🙋${r.pickup_location_id ? ` ${pickupName.get(r.pickup_location_id) ?? ""}` : r.pickup_address ? ` ${r.pickup_address}` : ""}`}</li>
                    ))}
                    {!yes.length && !maybe.length && <li style={{ color: "var(--g-grey-600)" }}>Nobody yet.</li>}
                  </ul>
                </details>
              </div>

              <div>
                <div className="flex items-center justify-between text-sm font-medium"><span>🛶 Lineups</span>{isAdmin && <Link href={`/admin/lineups?event=${ev.id}`} className="btn-text -mr-3">Edit</Link>}</div>
                {!evLineups.length && <p className="text-xs" style={{ color: "var(--g-grey-600)" }}>{isAdmin ? "None yet." : "Not published yet."}</p>}
                <div className="space-y-2">
                  {evLineups.map((l) => (
                    <div key={l.id} className="relative">
                      {isAdmin && !l.published && <span className="absolute right-2 top-2 chip !py-0 text-[10px]">draft</span>}
                      <LineupView name={l.name} boatType={l.boat_type} lineup={l.data as unknown as Lineup} names={names} />
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between text-sm font-medium"><span>🚗 Rides</span>{isAdmin && <Link href={`/admin/carpool?event=${ev.id}`} className="btn-text -mr-3">Edit</Link>}</div>
                {!cp && <p className="text-xs" style={{ color: "var(--g-grey-600)" }}>{isAdmin ? "Not set up yet." : "Not published yet."}</p>}
                {cp && isAdmin && !cp.published && <span className="chip !py-0 text-[10px]">draft</span>}
                <div className="grid gap-2 sm:grid-cols-2">
                  {cars.map((c) => (
                    <div key={c.id} className="rounded border p-2 text-xs" style={{ borderColor: "var(--g-grey-300)" }}>
                      <div className="font-medium">🚗 {names[c.driverId] ?? "?"} <span style={{ color: "var(--g-grey-600)" }}>({c.passengerIds.length}/{c.capacity - 1})</span></div>
                      <ol className="ml-4 list-decimal">{c.passengerIds.map((p) => <li key={p}>{names[p] ?? "?"}</li>)}</ol>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          );
        })}
        {!events?.length && <p className="text-sm" style={{ color: "var(--g-grey-600)" }}>No days in this group yet.</p>}
      </div>

      {isAdmin && (
        <form action={deleteGroup} className="flex items-center gap-3 pt-6 text-xs" style={{ color: "var(--g-grey-600)" }}>
          <input type="hidden" name="id" value={group.id} />
          <label className="flex items-center gap-1"><input type="checkbox" name="with_events" /> also delete the {events?.length ?? 0} day event(s)</label>
          <button className="btn-danger-text">Delete group</button>
        </form>
      )}
    </div>
  );
}
