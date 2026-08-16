"use client";

import { useActionState } from "react";
import { submitRsvp, type RsvpState } from "./actions";
import AttendanceFields from "@/components/attendance-fields";
import type { PickupLocation, Rsvp } from "@/lib/database.types";

export default function RsvpForm({ eventId, existing, defaultSeats, pickups }: { eventId: string; existing: Rsvp | null; defaultSeats: number | null; pickups: PickupLocation[] }) {
  const [state, action, pending] = useActionState<RsvpState, FormData>(submitRsvp, {});
  return (
    <form action={action} className="card space-y-4">
      <input type="hidden" name="event_id" value={eventId} />
      <div className="label">Will you be attending?</div>
      <AttendanceFields prefix="a_" existing={existing} pickups={pickups} defaultSeats={defaultSeats} />
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.saved && <p className="text-sm text-green-700">Saved!</p>}
      <button disabled={pending} className="btn-primary">{existing ? "Update RSVP" : "Submit RSVP"}</button>
    </form>
  );
}
