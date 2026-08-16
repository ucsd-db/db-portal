"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type RsvpState = { error?: string; saved?: boolean };

export async function submitRsvp(_: RsvpState, formData: FormData): Promise<RsvpState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };
  const practiceId = String(formData.get("practice_id"));
  const ride = String(formData.get("ride") ?? "none") as "none" | "driver" | "needs_ride";
  const seatsRaw = formData.get("seats");
  const { error } = await supabase.from("rsvps").upsert({
    practice_id: practiceId,
    user_id: user.id,
    status: String(formData.get("status")) as "yes" | "no" | "maybe",
    ride,
    seats: ride === "driver" && seatsRaw ? Number(seatsRaw) : null,
    note: String(formData.get("note") ?? "").trim() || null,
  });
  if (error) return { error: error.message };
  revalidatePath(`/practices/${practiceId}`);
  revalidatePath("/practices");
  return { saved: true };
}
