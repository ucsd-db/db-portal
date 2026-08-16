"use client";

import { useState } from "react";
import { ATTENDANCE_OPTIONS, toChoice, type AttendanceChoice } from "@/lib/attendance";
import type { PickupLocation, Rsvp } from "@/lib/database.types";

/**
 * Attendance + ride question. Writes fields `${prefix}choice|seats|pickup|pickup_address|note`
 * for parseAttendance(). Used by the quick RSVP and by forms (one block per event).
 */
export default function AttendanceFields({ prefix, existing, pickups, defaultSeats, required = true, showNote = true }: {
  prefix: string; existing: Rsvp | null; pickups: PickupLocation[]; defaultSeats: number | null; required?: boolean; showNote?: boolean;
}) {
  const [choice, setChoice] = useState<AttendanceChoice | null>(toChoice(existing));
  const [pickup, setPickup] = useState(existing?.pickup_location_id ?? (existing?.pickup_address ? "other" : "home"));
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        {ATTENDANCE_OPTIONS.map((o) => (
          <label key={o.value} className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm ${choice === o.value ? "border-sky-600 bg-sky-50" : "border-slate-200 hover:bg-slate-50"}`}>
            <input type="radio" name={`${prefix}choice`} value={o.value} required={required} checked={choice === o.value} onChange={() => setChoice(o.value)} />
            {o.label}
          </label>
        ))}
      </div>
      {choice === "yes_driver" && (
        <div className="flex items-center gap-2 text-sm">
          <label className="label mb-0">How many can you take (excluding you)?</label>
          <input name={`${prefix}seats`} type="number" min={1} max={14} required defaultValue={existing?.seats ?? (defaultSeats ? Math.max(1, defaultSeats - 1) : 3)} className="input w-20" />
        </div>
      )}
      {choice === "yes_needs_ride" && (
        <div className="space-y-2 text-sm">
          <label className="label mb-0">Where should we pick you up?</label>
          <select name={`${prefix}pickup`} value={pickup} onChange={(e) => setPickup(e.target.value)} className="input">
            <option value="home">My home address (from my profile)</option>
            {pickups.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            <option value="other">Other (type an address)</option>
          </select>
          {pickup === "other" && <input name={`${prefix}pickup_address`} defaultValue={existing?.pickup_address ?? ""} placeholder="Address or complex name" className="input" required />}
        </div>
      )}
      {showNote && <input name={`${prefix}note`} defaultValue={existing?.note ?? ""} placeholder="Note (optional, e.g. arriving late)" className="input text-sm" />}
    </div>
  );
}
