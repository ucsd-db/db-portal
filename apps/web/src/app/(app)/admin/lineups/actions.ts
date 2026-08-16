"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import type { Lineup, BoatType } from "@db/lineup";
import type { Json } from "@/lib/database.types";

export async function saveLineup(input: { id: string | null; practiceId: string | null; name: string; boatType: BoatType; data: Lineup; published: boolean }) {
  const { org, userId } = await requireAdmin();
  const supabase = await createClient();
  const row = { org_id: org.id, practice_id: input.practiceId, name: input.name, boat_type: input.boatType, data: input.data as unknown as Json, published: input.published, created_by: userId };
  const q = input.id
    ? supabase.from("lineups").update(row).eq("id", input.id).select("id").single()
    : supabase.from("lineups").insert(row).select("id").single();
  const { data, error } = await q;
  if (error) return { error: error.message };
  revalidatePath("/admin/lineups");
  return { id: data.id };
}

export async function deleteLineup(id: string) {
  await requireAdmin();
  const supabase = await createClient();
  await supabase.from("lineups").delete().eq("id", id);
  revalidatePath("/admin/lineups");
}
