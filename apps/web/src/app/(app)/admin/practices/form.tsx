"use client";

import { useActionState, useEffect, useRef } from "react";
import { createPractice, type AdminState } from "../actions";

export default function PracticeForm() {
  const [state, action, pending] = useActionState<AdminState, FormData>(createPractice, {});
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state.ok) ref.current?.reset(); }, [state]);
  return (
    <form ref={ref} action={action} className="card space-y-3">
      <input name="title" required placeholder="Title (e.g. Saturday practice)" className="input" />
      <div className="grid grid-cols-2 gap-3">
        <div><label className="label">Starts</label><input name="starts_at" type="datetime-local" required className="input" /></div>
        <div><label className="label">Ends</label><input name="ends_at" type="datetime-local" className="input" /></div>
      </div>
      <div><label className="label">RSVP deadline</label><input name="rsvp_deadline" type="datetime-local" className="input" /></div>
      <div><label className="label">Location name</label><input name="location_name" placeholder="Lake Merritt boathouse" className="input" /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="label">Location lat</label><input name="location_lat" type="number" step="any" className="input" /></div>
        <div><label className="label">Location lon</label><input name="location_lon" type="number" step="any" className="input" /></div>
      </div>
      <textarea name="notes" rows={3} placeholder="Notes for paddlers…" className="input" />
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.ok && <p className="text-sm text-green-700">Created.</p>}
      <button disabled={pending} className="btn-primary">Create</button>
    </form>
  );
}
