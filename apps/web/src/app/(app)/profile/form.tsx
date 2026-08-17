"use client";

import { useActionState } from "react";
import { saveProfile, type ProfileState } from "./actions";
import type { Profile } from "@/lib/database.types";

export default function ProfileForm({ profile: p }: { profile: Profile }) {
  const [state, action, pending] = useActionState<ProfileState, FormData>(saveProfile, {});
  return (
    <form action={action} className="space-y-5">
      <section className="card space-y-3">
        <h2 className="font-semibold">About you</h2>
        <div><label className="label">Full name</label><input name="full_name" defaultValue={p.full_name} required className="input" /></div>
        <div><label className="label">Phone</label><input name="phone" defaultValue={p.phone ?? ""} className="input" /></div>
      </section>
      <section className="card space-y-3">
        <h2 className="font-semibold">Paddling</h2>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Weight (lb)</label><input name="weight_lb" type="number" step="0.1" min={60} max={450} defaultValue={p.weight_lb ?? ""} className="input" /></div>
          <div><label className="label">Gender (for boat category)</label>
            <select name="gender" defaultValue={p.gender ?? ""} className="input"><option value="">—</option><option value="female">Female</option><option value="male">Male</option><option value="other">Other</option></select></div>
          <div><label className="label">Side preference</label>
            <select name="side_preference" defaultValue={p.side_preference ?? ""} className="input"><option value="">—</option><option value="left">Left</option><option value="right">Right</option><option value="either">Either</option></select></div>
        </div>
        <div className="flex gap-6 text-sm">
          <label className="flex items-center gap-2"><input type="checkbox" name="can_steer" defaultChecked={p.can_steer} /> Can steer</label>
          <label className="flex items-center gap-2"><input type="checkbox" name="can_drum" defaultChecked={p.can_drum} /> Can drum</label>
        </div>
      </section>
      <section className="card space-y-3">
        <h2 className="font-semibold">Carpool</h2>
        <div><label className="label">Home address (for pickup matching)</label>
          <input name="address" defaultValue={p.address ?? ""} placeholder="123 Main St, City, State" className="input" />
          <p className="text-xs text-slate-500 mt-1">{p.lat ? `📍 Located (${p.lat.toFixed(3)}, ${p.lon?.toFixed(3)})` : "Not located yet"}</p></div>
        <div className="flex items-center gap-6 text-sm">
          <label className="flex items-center gap-2"><input type="checkbox" name="can_drive" defaultChecked={p.can_drive} /> I can usually drive</label>
          <div className="flex items-center gap-2"><span>Car seats (incl. you)</span><input name="car_seats" type="number" min={1} max={15} defaultValue={p.car_seats ?? ""} className="input w-20" /></div>
        </div>
      </section>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.saved && <p className="text-sm text-green-700">Saved{state.geocoded ? " — address located." : "."}</p>}
      <button disabled={pending} className="btn-primary">{pending ? "Saving…" : "Save profile"}</button>
    </form>
  );
}
