"use client";

import { useActionState, useEffect, useRef } from "react";
import { addSavedLocation, type AdminState } from "../actions";

export default function SavedLocationForm() {
  const [state, action, pending] = useActionState<AdminState, FormData>(addSavedLocation, {});
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state.ok) ref.current?.reset(); }, [state]);
  return (
    <form ref={ref} action={action} className="card space-y-2 text-sm">
      <div className="grid grid-cols-[1fr_1fr] gap-2">
        <div><label className="label">Name</label><input name="name" required placeholder="🛶 Mission Bay" className="input" /></div>
        <div><label className="label">Address</label><input name="address" placeholder="1750 Fiesta Island Rd" className="input" /></div>
      </div>
      <div className="grid grid-cols-[1fr_90px_110px_110px_60px_auto] gap-2 items-end">
        <div><label className="label">City</label><input name="city" placeholder="San Diego" className="input" /></div>
        <div><label className="label">Zip</label><input name="zipcode" className="input" /></div>
        <div><label className="label">Lat</label><input name="lat" type="number" step="any" className="input" /></div>
        <div><label className="label">Lon</label><input name="lon" type="number" step="any" className="input" /></div>
        <div><label className="label">Order</label><input name="sort_order" type="number" defaultValue={0} className="input" /></div>
        <button disabled={pending} className="btn-primary">Add</button>
      </div>
      {state.error && <p className="text-red-600">{state.error}</p>}
    </form>
  );
}
