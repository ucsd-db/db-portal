"use client";

import { useActionState, useState } from "react";
import { submitRsvp, type RsvpState } from "./actions";
import type { Rsvp } from "@/lib/database.types";

export default function RsvpForm({ practiceId, existing, defaultSeats }: { practiceId: string; existing: Rsvp | null; defaultSeats: number | null }) {
  const [state, action, pending] = useActionState<RsvpState, FormData>(submitRsvp, {});
  const [status, setStatus] = useState(existing?.status ?? "yes");
  const [ride, setRide] = useState(existing?.ride ?? "none");
  return (
    <form action={action} className="card space-y-4">
      <input type="hidden" name="practice_id" value={practiceId} />
      <div>
        <div className="label">Are you coming?</div>
        <div className="flex gap-2">
          {(["yes", "maybe", "no"] as const).map((s) => (
            <label key={s} className={`cursor-pointer rounded-md border px-3 py-1.5 text-sm capitalize ${status === s ? "border-sky-600 bg-sky-50 font-medium" : "border-slate-300"}`}>
              <input type="radio" name="status" value={s} checked={status === s} onChange={() => setStatus(s)} className="sr-only" />
              {s}
            </label>
          ))}
        </div>
      </div>
      {status !== "no" && (
        <div>
          <div className="label">Ride</div>
          <select name="ride" value={ride} onChange={(e) => setRide(e.target.value as Rsvp["ride"])} className="input">
            <option value="none">Getting there myself</option>
            <option value="driver">I can drive others</option>
            <option value="needs_ride">I need a ride</option>
          </select>
          {ride === "driver" && (
            <div className="mt-2">
              <label className="label">Seats available (excluding you)</label>
              <input name="seats" type="number" min={1} max={14} defaultValue={existing?.seats ?? (defaultSeats ? defaultSeats - 1 : 3)} className="input" />
            </div>
          )}
        </div>
      )}
      <div>
        <label className="label">Note (optional)</label>
        <input name="note" defaultValue={existing?.note ?? ""} placeholder="e.g. arriving 10 min late" className="input" />
      </div>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.saved && <p className="text-sm text-green-700">Saved!</p>}
      <button disabled={pending} className="btn-primary">{existing ? "Update RSVP" : "Submit RSVP"}</button>
    </form>
  );
}
