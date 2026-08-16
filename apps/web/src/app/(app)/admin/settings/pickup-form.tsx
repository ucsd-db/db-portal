"use client";

import { useActionState, useEffect, useRef } from "react";
import { addPickupLocation, type AdminState } from "../actions";

export default function PickupForm() {
  const [state, action, pending] = useActionState<AdminState, FormData>(addPickupLocation, {});
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state.ok) ref.current?.reset(); }, [state]);
  return (
    <form ref={ref} action={action} className="card grid grid-cols-[1fr_110px_110px_60px_auto] gap-2 items-end text-sm">
      <div><label className="label">Name</label><input name="name" required placeholder="Campus - Muir" className="input" /></div>
      <div><label className="label">Lat</label><input name="lat" type="number" step="any" className="input" /></div>
      <div><label className="label">Lon</label><input name="lon" type="number" step="any" className="input" /></div>
      <div><label className="label">Order</label><input name="sort_order" type="number" defaultValue={0} className="input" /></div>
      <button disabled={pending} className="btn-primary">Add</button>
      {state.error && <p className="col-span-5 text-red-600">{state.error}</p>}
    </form>
  );
}
