import { requireAdmin } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { fmtDate } from "@/lib/format";
import type { Profile, Rsvp } from "@/lib/database.types";
import type { Car, Rider } from "@db/carpool";
import CarpoolBuilder, { type SavedCarpool } from "./builder";

export default async function AdminCarpoolPage({ searchParams }: { searchParams: Promise<{ event?: string }> }) {
  const { event: eventId } = await searchParams;
  const { org } = await requireAdmin();
  const supabase = await createClient();
  const { data: events } = await supabase.from("events").select("*").eq("org_id", org.id).order("starts_at", { ascending: false }).limit(30);
  const event = events?.find((p) => p.id === eventId) ?? null;

  const riders: Record<string, Rider> = {}, drivers: { id: string; seats: number }[] = [], needsRide: string[] = [];
  let saved: SavedCarpool | null = null;
  if (event) {
    const [{ data: rs }, { data: cp }, { data: pickups }] = await Promise.all([
      supabase.from("rsvps").select("*, profile:profiles(*)").eq("event_id", event.id).in("status", ["yes", "maybe"]),
      supabase.from("carpools").select("*").eq("event_id", event.id).maybeSingle(),
      supabase.from("pickup_locations").select("*").eq("org_id", org.id),
    ]);
    const pickupBy = new Map((pickups ?? []).map((p) => [p.id, p]));
    for (const r of (rs ?? []) as (Rsvp & { profile: Profile })[]) {
      const p = r.profile; if (!p) continue;
      // Pickup point for this event beats home address; custom typed addresses aren't geocoded (shown as "no location").
      const pk = r.pickup_location_id ? pickupBy.get(r.pickup_location_id) : null;
      const location = pk && pk.lat != null && pk.lon != null ? { lat: pk.lat, lon: pk.lon }
        : r.pickup_address ? null
        : p.lat != null && p.lon != null ? { lat: p.lat, lon: p.lon } : null;
      const suffix = pk ? ` @ ${pk.name}` : r.pickup_address ? ` @ ${r.pickup_address}` : "";
      riders[p.id] = { id: p.id, name: (p.full_name || p.email) + (r.ride === "needs_ride" ? suffix : ""), location };
      if (r.ride === "driver") drivers.push({ id: p.id, seats: (r.seats ?? (p.car_seats ? p.car_seats - 1 : 3)) + 1 });
      if (r.ride === "needs_ride") needsRide.push(p.id);
    }
    if (cp) saved = { data: cp.data as unknown as { cars: Car[]; mode: "pickup" | "dropoff" }, published: cp.published };
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-normal">Carpool</h1>
        <form className="flex items-center gap-2 text-sm">
          <select name="event" defaultValue={eventId ?? ""} className="input w-auto py-1">
            <option value="">Select an event…</option>
            {events?.map((p) => <option key={p.id} value={p.id}>{p.title} · {fmtDate(p.starts_at)}</option>)}
          </select>
          <button className="btn-secondary py-1">Go</button>
        </form>
      </div>
      {!event && <p className="text-slate-500">Pick an event to coordinate rides. Drivers and riders come from RSVPs.</p>}
      {event && (
        event.location_lat == null || event.location_lon == null
          ? <p className="card text-sm text-amber-700">This event has no location coordinates. Edit it (Manage events) and set lat/lon so routes can be computed.</p>
          : <CarpoolBuilder key={event.id} eventId={event.id} destination={{ lat: event.location_lat, lon: event.location_lon, label: event.location_name ?? event.title }}
              riders={riders} drivers={drivers} needsRide={needsRide} saved={saved} />
      )}
    </div>
  );
}
