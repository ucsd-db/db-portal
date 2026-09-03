"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import type { Lineup, BoatType } from "@db/lineup";
import type { Json } from "@/lib/database.types";

/** Members see lineups on the event and group pages, not just /admin/lineups. */
async function revalidateLineupPaths(eventId: string | null) {
  revalidatePath("/admin/lineups");
  if (!eventId) return;
  revalidatePath(`/events/${eventId}`);
  const supabase = await createClient();
  const { data: ev } = await supabase.from("events").select("group_id").eq("id", eventId).maybeSingle();
  if (ev?.group_id) revalidatePath(`/groups/${ev.group_id}`);
}

export async function saveLineup(input: {
  id: string | null;
  eventId: string | null;
  name: string;
  boatType: BoatType;
  division: string | null;
  boatLabel: string | null;
  data: Lineup;
  published: boolean;
}) {
  const { org, userId } = await requireAdmin();
  const supabase = await createClient();
  const row = {
    org_id: org.id, event_id: input.eventId, name: input.name, boat_type: input.boatType,
    division: input.division, boat_label: input.boatLabel,
    data: input.data as unknown as Json, published: input.published, created_by: userId,
  };
  const q = input.id
    ? supabase.from("lineups").update(row).eq("id", input.id).select("id").single()
    : supabase.from("lineups").insert(row).select("id").single();
  const { data, error } = await q;
  if (error) return { error: error.message };
  await revalidateLineupPaths(input.eventId);
  return { id: data.id };
}

export async function deleteLineup(id: string) {
  await requireAdmin();
  const supabase = await createClient();
  const { data: row } = await supabase.from("lineups").select("event_id").eq("id", id).maybeSingle();
  await supabase.from("lineups").delete().eq("id", id);
  await revalidateLineupPaths(row?.event_id ?? null);
}

/** Renames (and optionally re-types) a division across all its boats/races for one day. */
export async function renameDivision(fd: FormData) {
  const { org } = await requireAdmin();
  const eventId = String(fd.get("event_id"));
  const from = String(fd.get("from"));
  const to = String(fd.get("to") ?? "").trim();
  const boatType = String(fd.get("boat_type") ?? "") as BoatType | "";
  if (!eventId || !from || !to) return;
  const supabase = await createClient();
  await supabase
    .from("lineups")
    .update(boatType ? { division: to, boat_type: boatType } : { division: to })
    .eq("org_id", org.id).eq("event_id", eventId).eq("division", from);
  await revalidateLineupPaths(eventId);
}
