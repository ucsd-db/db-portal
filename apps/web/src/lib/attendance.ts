import type { RideChoice, Rsvp } from "@/lib/database.types";

/** The single "Will you be attending?" choice, combining status + ride like the old Google Forms. */
export type AttendanceChoice = "yes_driver" | "yes_self" | "yes_needs_ride" | "maybe" | "no";

export const ATTENDANCE_OPTIONS: { value: AttendanceChoice; label: string }[] = [
  { value: "yes_driver", label: "Yes, and I can drive others" },
  { value: "yes_self", label: "Yes, and I'll get there myself (not driving others) 🫥" },
  { value: "yes_needs_ride", label: "Yes, and I need a ride" },
  { value: "maybe", label: "Maybe" },
  { value: "no", label: "No 🤡" },
];

export function toChoice(r: Pick<Rsvp, "status" | "ride"> | null | undefined): AttendanceChoice | null {
  if (!r) return null;
  if (r.status === "no") return "no";
  if (r.status === "maybe") return "maybe";
  if (r.ride === "driver") return "yes_driver";
  if (r.ride === "needs_ride") return "yes_needs_ride";
  return "yes_self";
}

export type AttendanceValues = {
  status: Rsvp["status"]; ride: RideChoice; seats: number | null;
  pickup_location_id: string | null; pickup_address: string | null; note: string | null;
};

/** Parse fields written by <AttendanceFields prefix=…>. Returns null if no choice was made. */
export function parseAttendance(fd: FormData, prefix: string): AttendanceValues | null {
  const choice = fd.get(`${prefix}choice`) as AttendanceChoice | null;
  if (!choice) return null;
  const status: Rsvp["status"] = choice === "no" ? "no" : choice === "maybe" ? "maybe" : "yes";
  const ride: RideChoice = choice === "yes_driver" ? "driver" : choice === "yes_needs_ride" ? "needs_ride" : choice === "yes_self" ? "self" : "none";
  const seatsRaw = fd.get(`${prefix}seats`);
  const pickup = String(fd.get(`${prefix}pickup`) ?? "");
  const custom = String(fd.get(`${prefix}pickup_address`) ?? "").trim();
  return {
    status, ride,
    seats: ride === "driver" && seatsRaw ? Number(seatsRaw) : null,
    pickup_location_id: ride === "needs_ride" && pickup && pickup !== "home" && pickup !== "other" ? pickup : null,
    pickup_address: ride === "needs_ride" && pickup === "other" && custom ? custom : null,
    note: String(fd.get(`${prefix}note`) ?? "").trim() || null,
  };
}
