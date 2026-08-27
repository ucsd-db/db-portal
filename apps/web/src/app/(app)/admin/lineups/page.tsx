import Link from "next/link";
import { requireAdmin } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import LocalTime from "@/components/local-time";
import Icon from "@/components/icon";
import DayCardGrid from "@/components/day-cards";
import type { Roster, Lineup, BoatType } from "@db/lineup";
import type { Profile } from "@/lib/database.types";
import LineupBuilder from "./builder";

export default async function AdminLineupsPage({ searchParams }: { searchParams: Promise<{ event?: string; lineup?: string; blank?: string }> }) {
  const { event: eventId, lineup: lineupId, blank } = await searchParams;
  const { org } = await requireAdmin();
  const supabase = await createClient();

  const [{ data: events }, { data: members }, { data: lineups }] = await Promise.all([
    supabase.from("events").select("id, title, starts_at").eq("org_id", org.id).order("starts_at", { ascending: false }).limit(30),
    supabase.from("memberships").select("profile:profiles(*)").eq("org_id", org.id),
    supabase.from("lineups").select("*").eq("org_id", org.id).order("updated_at", { ascending: false }),
  ]);

  // Home: Google Forms-style day picker (blue). Selecting a day opens its lineup workspace.
  if (!eventId && !blank) {
    const byEvent = new Map<string, { n: number; pub: number }>();
    for (const l of lineups ?? []) {
      if (!l.event_id) continue;
      const c = byEvent.get(l.event_id) ?? { n: 0, pub: 0 };
      c.n += 1; if (l.published) c.pub += 1;
      byEvent.set(l.event_id, c);
    }
    return (
      <div className="-m-4 md:-m-6 min-h-full">
        <div className="border-b px-4 py-5 md:px-8" style={{ background: "var(--g-blue-tint)", borderColor: "var(--g-grey-300)" }}>
          <div className="mx-auto max-w-[1100px]">
            <h1 className="text-2xl font-normal" style={{ color: "var(--g-blue)" }}><Icon name="boat" /> Lineups</h1>
            <p className="mt-1 text-sm" style={{ color: "var(--g-grey-600)" }}>Pick a day to build its boat lineups — the roster is whoever RSVP’d yes/maybe. Or start from the full roster:</p>
            <Link href="/admin/lineups?blank=1" className="btn-secondary mt-3 inline-block">Blank lineup (full roster)</Link>
          </div>
        </div>
        <div className="px-4 py-5 md:px-8"><div className="mx-auto max-w-[1100px]">
          <h2 className="mb-3 text-base">Days</h2>
          <DayCardGrid hrefBase="/admin/lineups?event=" color="var(--g-blue)" soft="var(--g-blue-soft)" empty="No event days yet — create days under Events."
            days={(events ?? []).map((e) => {
              const c = byEvent.get(e.id);
              return { id: e.id, title: e.title, starts_at: e.starts_at,
                meta: c ? `${c.n} lineup${c.n === 1 ? "" : "s"}${c.pub ? ` · ${c.pub} published` : " · draft"}` : "no lineups yet",
                metaColor: c?.pub ? "var(--g-green)" : undefined };
            })} />
        </div></div>
      </div>
    );
  }

  // Day workspace (or blank full-roster mode).
  const event = eventId ? (events ?? []).find((e) => e.id === eventId) ?? null : null;
  let allowed: Set<string> | null = null;
  if (eventId) {
    const { data: rs } = await supabase.from("rsvps").select("user_id, status").eq("event_id", eventId).in("status", ["yes", "maybe"]);
    allowed = new Set((rs ?? []).map((r) => r.user_id));
  }
  const roster: Roster = {};
  for (const m of members ?? []) {
    const p = m.profile as unknown as Profile;
    if (!p || (allowed && !allowed.has(p.id))) continue;
    roster[p.id] = { id: p.id, name: p.full_name || p.email, weight: p.weight_lb ?? 0, gender: p.gender, sidePreference: p.side_preference, canSteer: p.can_steer, canDrum: p.can_drum };
  }

  const forEvent = (lineups ?? []).filter((l) => (eventId ? l.event_id === eventId : true));
  const current = lineupId ? (lineups ?? []).find((l) => l.id === lineupId) ?? null : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/admin/lineups" className="btn-text -ml-3" style={{ color: "var(--g-blue)" }}>← Lineups</Link>
        <h1 className="text-2xl font-normal">{event ? event.title : "Blank lineup"}</h1>
        {event && <span className="text-sm" style={{ color: "var(--g-grey-600)" }}><LocalTime iso={event.starts_at} /></span>}
        {!event && <span className="text-sm" style={{ color: "var(--g-grey-600)" }}>full roster — not tied to a day</span>}
      </div>
      <div className="flex flex-wrap gap-2 text-sm">
        {forEvent.map((l) => (
          <Link key={l.id} href={`/admin/lineups?${eventId ? `event=${eventId}&` : "blank=1&"}lineup=${l.id}`}
            className={`rounded-full border px-3 py-1 ${l.id === lineupId ? "border-sky-600 bg-sky-50" : "border-slate-300"}`}>
            {l.name} <span className="text-slate-400">· {l.boat_type}{l.published ? " · published" : ""}</span>
          </Link>
        ))}
        <Link href={`/admin/lineups${eventId ? `?event=${eventId}` : "?blank=1"}`} className={`rounded-full border px-3 py-1 ${!lineupId ? "border-sky-600 bg-sky-50" : "border-dashed border-slate-300"}`}>+ New</Link>
      </div>
      <LineupBuilder
        key={current?.id ?? "new"}
        roster={roster}
        eventId={eventId ?? null}
        initial={current ? { id: current.id, name: current.name, boatType: current.boat_type as BoatType, published: current.published, data: current.data as unknown as Lineup } : null}
      />
    </div>
  );
}
