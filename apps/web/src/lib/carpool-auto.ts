// Auto-generates a draft carpool for one event from its RSVPs — the server-side
// twin of the admin builder's Optimize button, upgraded with real drive times:
// one OSRM `table` request gives the time+distance matrix between every home,
// pickup point, and the destination, and `optimizeCarpool` local-searches for
// the cheapest assignment. Called by the /api/cron/carpools route after a
// form's due date passes.

import {
  buildOsrmTableUrl,
  locationKey,
  optimizeCarpool,
  parseOsrmTable,
  type Car,
  type CostMatrix,
  type LatLon,
  type Rider,
} from "@db/carpool";
import type { createAdminClient } from "@/lib/supabase/admin";
import type { Json, Profile, Rsvp } from "@/lib/database.types";

type AdminClient = ReturnType<typeof createAdminClient>;

export type GenerateResult =
  | { ok: true; cars: number; assigned: number; unassigned: number }
  | { skipped: string }
  | { error: string };

const EMPTY_MATRIX: CostMatrix = { index: new Map(), durationMin: [], distanceKm: [] };

async function fetchMatrix(points: LatLon[]): Promise<CostMatrix> {
  try {
    const res = await fetch(buildOsrmTableUrl(points), {
      headers: { "User-Agent": "db-portal-carpool" },
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return EMPTY_MATRIX;
    return parseOsrmTable(points, await res.json()) ?? EMPTY_MATRIX;
  } catch {
    return EMPTY_MATRIX; // optimizeCarpool falls back to haversine estimates
  }
}

export async function generateCarpoolForEvent(
  supabase: AdminClient,
  orgId: string,
  eventId: string,
): Promise<GenerateResult> {
  const [{ data: event }, { data: existing }] = await Promise.all([
    supabase.from("events").select("*").eq("id", eventId).maybeSingle(),
    supabase.from("carpools").select("id").eq("event_id", eventId).maybeSingle(),
  ]);
  if (!event) return { error: "event not found" };
  if (existing) return { skipped: "carpool already started by an admin" };
  if (event.location_lat == null || event.location_lon == null)
    return { skipped: "event has no location coordinates" };
  const destination = { lat: event.location_lat, lon: event.location_lon, label: event.location_name ?? event.title };

  const [{ data: rs }, { data: pickups }] = await Promise.all([
    supabase.from("rsvps").select("*, profile:profiles(*)").eq("event_id", eventId).in("status", ["yes", "maybe"]),
    supabase.from("pickup_locations").select("*").eq("org_id", orgId),
  ]);
  const pickupBy = new Map((pickups ?? []).map((p) => [p.id, p]));

  // Mirrors the admin builder: pickup point beats home address; custom typed
  // addresses aren't geocoded. Only needs_ride riders get seats.
  const riders: Record<string, Rider> = {};
  const cars: Car[] = [];
  for (const r of (rs ?? []) as (Rsvp & { profile: Profile })[]) {
    const p = r.profile;
    if (!p || (r.ride !== "driver" && r.ride !== "needs_ride")) continue;
    const pk = r.pickup_location_id ? pickupBy.get(r.pickup_location_id) : null;
    const location = pk && pk.lat != null && pk.lon != null ? { lat: pk.lat, lon: pk.lon }
      : r.pickup_address ? null
      : p.lat != null && p.lon != null ? { lat: p.lat, lon: p.lon } : null;
    const suffix = pk ? ` @ ${pk.name}` : r.pickup_address ? ` @ ${r.pickup_address}` : "";
    riders[p.id] = { id: p.id, name: (p.full_name || p.email) + (r.ride === "needs_ride" ? suffix : ""), location };
    if (r.ride === "driver")
      cars.push({ id: p.id, driverId: p.id, capacity: (r.seats ?? (p.car_passengers || 3)) + 1, passengerIds: [] });
  }
  if (cars.length === 0) return { skipped: "no drivers RSVP'd" };

  const seen = new Set<string>();
  const points: LatLon[] = [];
  for (const r of Object.values(riders)) {
    if (!r.location) continue;
    const key = locationKey(r.location);
    if (!seen.has(key)) { seen.add(key); points.push(r.location); }
  }
  points.push({ lat: destination.lat, lon: destination.lon });

  const matrix = await fetchMatrix(points);
  const res = optimizeCarpool(cars, riders, destination, matrix);

  const { error } = await supabase.from("carpools").upsert(
    { org_id: orgId, event_id: eventId, data: { cars: res.cars, mode: "pickup" } as unknown as Json, published: false },
    { onConflict: "event_id" },
  );
  if (error) return { error: error.message };
  return {
    ok: true,
    cars: res.cars.length,
    assigned: res.cars.reduce((n, c) => n + c.passengerIds.length, 0),
    unassigned: res.unassigned.length,
  };
}
