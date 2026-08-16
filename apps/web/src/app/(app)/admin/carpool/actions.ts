"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/database.types";

export async function saveCarpool(eventId: string, data: unknown, published: boolean) {
  const { org } = await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("carpools").upsert(
    { org_id: org.id, event_id: eventId, data: data as Json, published },
    { onConflict: "event_id" },
  );
  if (error) return { error: error.message };
  revalidatePath("/admin/carpool");
  revalidatePath(`/events/${eventId}`);
  return { ok: true };
}
