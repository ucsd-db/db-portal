import { requireAdmin } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { fmtDate } from "@/lib/format";
import type { Profile, Rsvp } from "@/lib/database.types";
import type { Car, Rider } from "@db/carpool";
import CarpoolBuilder, { type SavedCarpool } from "./builder";

export default async function AdminCarpoolPage({ searchParams }: { searchParams: Promise<{ practice?: string }> }) {
  const { practice: practiceId } = await searchParams;
  const { org } = await requireAdmin();
  const supabase = await createClient();
  const { data: practices } = await supabase.from("practices").select("*").eq("org_id", org.id).order("starts_at", { ascending: false }).limit(30);
  const practice = practices?.find((p) => p.id === practiceId) ?? null;

  const riders: Record<string, Rider> = {}, drivers: { id: string; seats: number }[] = [], needsRide: string[] = [];
  let saved: SavedCarpool | null = null;
  if (practice) {
    const [{ data: rs }, { data: cp }] = await Promise.all([
      supabase.from("rsvps").select("*, profile:profiles(*)").eq("practice_id", practice.id).in("status", ["yes", "maybe"]),
      supabase.from("carpools").select("*").eq("practice_id", practice.id).maybeSingle(),
    ]);
    for (const r of (rs ?? []) as (Rsvp & { profile: Profile })[]) {
      const p = r.profile; if (!p) continue;
      riders[p.id] = { id: p.id, name: p.full_name || p.email, location: p.lat != null && p.lon != null ? { lat: p.lat, lon: p.lon } : null };
      if (r.ride === "driver") drivers.push({ id: p.id, seats: (r.seats ?? (p.car_seats ? p.car_seats - 1 : 3)) + 1 });
      if (r.ride === "needs_ride") needsRide.push(p.id);
    }
    if (cp) saved = { data: cp.data as unknown as { cars: Car[]; mode: "pickup" | "dropoff" }, published: cp.published };
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">Carpool</h1>
        <form className="flex items-center gap-2 text-sm">
          <select name="practice" defaultValue={practiceId ?? ""} className="input w-auto py-1">
            <option value="">Select a practice…</option>
            {practices?.map((p) => <option key={p.id} value={p.id}>{p.title} · {fmtDate(p.starts_at)}</option>)}
          </select>
          <button className="btn-secondary py-1">Go</button>
        </form>
      </div>
      {!practice && <p className="text-slate-500">Pick a practice to coordinate rides. Drivers and riders come from RSVPs.</p>}
      {practice && (
        practice.location_lat == null || practice.location_lon == null
          ? <p className="card text-sm text-amber-700">This practice has no location coordinates. Edit it (Manage practices) and set lat/lon so routes can be computed.</p>
          : <CarpoolBuilder key={practice.id} practiceId={practice.id} destination={{ lat: practice.location_lat, lon: practice.location_lon, label: practice.location_name ?? practice.title }}
              riders={riders} drivers={drivers} needsRide={needsRide} saved={saved} />
      )}
    </div>
  );
}
