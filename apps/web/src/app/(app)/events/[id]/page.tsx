import { notFound } from "next/navigation";
import { requireOrg } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { fmtDateTime } from "@/lib/format";
import RsvpForm from "./rsvp-form";
import type { Rsvp } from "@/lib/database.types";
import type { Lineup } from "@db/lineup";
import type { Car } from "@db/carpool";
import LineupView from "@/components/lineup-view";
import RichText from "@/components/rich-text";

export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { userId, profile, isAdmin } = await requireOrg();
  const supabase = await createClient();
  const { data: event } = await supabase.from("events").select("*").eq("id", id).maybeSingle();
  if (!event) notFound();
  const [{ data: rsvps }, { data: lineups }, { data: carpool }, { data: teammates }, { data: pickups }] = await Promise.all([
    supabase.from("rsvps").select("*, profile:profiles(full_name)").eq("event_id", id).order("updated_at"),
    supabase.from("lineups").select("*").eq("event_id", id).eq("published", true).order("name"),
    supabase.from("carpools").select("*").eq("event_id", id).eq("published", true).maybeSingle(),
    supabase.from("profiles").select("id, full_name, email"),
    supabase.from("pickup_locations").select("*").eq("org_id", event.org_id).eq("active", true).order("sort_order"),
  ]);
  const names: Record<string, string> = {};
  for (const t of teammates ?? []) names[t.id] = t.full_name || t.email;
  const cars = ((carpool?.data as { cars?: Car[] } | null)?.cars ?? []);
  const list = (rsvps ?? []) as (Rsvp & { profile: { full_name: string } | null })[];
  const mine = list.find((r) => r.user_id === userId) ?? null;
  const by = (s: Rsvp["status"]) => list.filter((r) => r.status === s);
  const closed = event.rsvp_deadline ? new Date(event.rsvp_deadline) < new Date() : false;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <section>
        <h1 className="text-2xl font-normal">{event.title} <span className="text-xs uppercase text-slate-400 font-normal">{event.kind}</span></h1>
        <p className="text-slate-600">{fmtDateTime(event.starts_at)}{event.ends_at && ` – ${new Date(event.ends_at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`}</p>
        {event.location_name && <p className="text-slate-600">📍 {event.location_name}</p>}
        {event.notes && <RichText text={event.notes} className="mt-3" />}
        {event.rsvp_deadline && <p className="mt-2 text-xs text-slate-500">RSVP by {fmtDateTime(event.rsvp_deadline)}{closed && " (closed)"}</p>}
        {!!lineups?.length && (
          <div className="mt-6">
            <h2 className="font-semibold mb-2">Lineups</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {lineups.map((l) => <LineupView key={l.id} name={l.name} boatType={l.boat_type} lineup={l.data as unknown as Lineup} names={names} />)}
            </div>
          </div>
        )}
        {carpool && (
          <div className="mt-6">
            <h2 className="font-semibold mb-2">Carpool</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {cars.map((c) => (
                <div key={c.id} className="card text-sm">
                  <div className="font-medium">🚗 {names[c.driverId] ?? "?"}</div>
                  <ol className="ml-4 list-decimal text-xs mt-1">{c.passengerIds.map((p) => <li key={p}>{names[p] ?? "?"}</li>)}</ol>
                  {!c.passengerIds.length && <div className="text-xs text-slate-400">no passengers</div>}
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="mt-6">
          {closed && !isAdmin ? <p className="card text-sm text-slate-600">RSVPs are closed. {mine ? `Your response: ${mine.status}` : ""}</p>
            : <RsvpForm eventId={id} existing={mine} defaultSeats={profile.car_seats} pickups={pickups ?? []} />}
        </div>
      </section>
      <aside className="space-y-4">
        {(["yes", "maybe", "no"] as const).map((s) => (
          <div key={s} className="card">
            <h3 className="font-semibold capitalize mb-2">{s} <span className="text-slate-400 font-normal">({by(s).length})</span></h3>
            <ul className="text-sm space-y-1">
              {by(s).map((r) => (
                <li key={r.user_id} className="flex justify-between gap-2">
                  <span>{r.profile?.full_name || "Member"}</span>
                  <span className="text-xs text-slate-500">
                    {r.ride === "driver" && `🚗 ${r.seats ?? "?"} seats`}
                    {r.ride === "self" && "🫥 own ride"}
                    {r.ride === "needs_ride" && "🙋 needs ride"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </aside>
    </div>
  );
}
