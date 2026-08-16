import { requireAdmin } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { deletePickupLocation } from "../actions";
import PickupForm from "./pickup-form";

export default async function AdminSettingsPage() {
  const { org } = await requireAdmin();
  const supabase = await createClient();
  const { data: pickups } = await supabase.from("pickup_locations").select("*").eq("org_id", org.id).order("sort_order").order("name");
  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Team settings</h1>
        <p className="text-sm text-slate-500">Team: <b>{org.name}</b> · join code <span className="font-mono">{org.join_code}</span></p>
      </div>
      <section>
        <h2 className="text-lg font-semibold mb-1">Pickup locations</h2>
        <p className="text-sm text-slate-500 mb-3">Named meetup spots paddlers can pick when they need a ride (e.g. each campus college, “Peterson Loop”). Add lat/lon so the carpool map can route to them; otherwise the paddler’s home address is used.</p>
        <PickupForm />
        <ul className="mt-3 space-y-1">
          {pickups?.map((p) => (
            <li key={p.id} className="card py-2 flex items-center justify-between text-sm">
              <span>{p.name} <span className="text-xs text-slate-400">{p.lat != null ? `(${p.lat.toFixed(4)}, ${p.lon?.toFixed(4)})` : "no coords"}</span></span>
              <form action={deletePickupLocation}><input type="hidden" name="id" value={p.id} /><button className="text-xs text-red-600 underline">Delete</button></form>
            </li>
          ))}
          {!pickups?.length && <li className="text-sm text-slate-400">None yet.</li>}
        </ul>
      </section>
    </div>
  );
}
