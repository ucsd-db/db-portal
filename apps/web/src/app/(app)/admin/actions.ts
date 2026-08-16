"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export type AdminState = { error?: string; ok?: boolean };
const str = (v: FormDataEntryValue | null) => (v === null || String(v).trim() === "" ? null : String(v).trim());

export async function createAnnouncement(_: AdminState, fd: FormData): Promise<AdminState> {
  const { org, userId } = await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("announcements").insert({
    org_id: org.id, author_id: userId,
    title: String(fd.get("title")).trim(), body: String(fd.get("body") ?? "").trim(),
    pinned: fd.get("pinned") === "on",
  });
  if (error) return { error: error.message };
  revalidatePath("/dashboard"); revalidatePath("/admin/announcements");
  return { ok: true };
}

export async function deleteAnnouncement(fd: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  await supabase.from("announcements").delete().eq("id", String(fd.get("id")));
  revalidatePath("/dashboard"); revalidatePath("/admin/announcements");
}

export async function togglePin(fd: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  await supabase.from("announcements").update({ pinned: fd.get("pinned") === "true" }).eq("id", String(fd.get("id")));
  revalidatePath("/dashboard"); revalidatePath("/admin/announcements");
}

export async function deleteEvent(fd: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  await supabase.from("events").delete().eq("id", String(fd.get("id")));
  revalidatePath("/events"); revalidatePath("/dashboard"); revalidatePath("/admin/events");
}

export async function setMemberRole(fd: FormData) {
  const { org, userId } = await requireAdmin();
  const target = String(fd.get("user_id"));
  if (target === userId) return; // don't demote yourself
  const supabase = await createClient();
  await supabase.from("memberships").update({ role: String(fd.get("role")) as "admin" | "member" })
    .eq("org_id", org.id).eq("user_id", target);
  revalidatePath("/admin/members");
}

export async function removeMember(fd: FormData) {
  const { org, userId } = await requireAdmin();
  const target = String(fd.get("user_id"));
  if (target === userId) return;
  const supabase = await createClient();
  await supabase.from("memberships").delete().eq("org_id", org.id).eq("user_id", target);
  revalidatePath("/admin/members");
}

export async function addPickupLocation(_: AdminState, fd: FormData): Promise<AdminState> {
  const { org } = await requireAdmin();
  const supabase = await createClient();
  const name = String(fd.get("name") ?? "").trim();
  if (!name) return { error: "Name is required" };
  const lat = str(fd.get("lat")), lon = str(fd.get("lon"));
  const { error } = await supabase.from("pickup_locations").insert({
    org_id: org.id, name, lat: lat ? Number(lat) : null, lon: lon ? Number(lon) : null,
    sort_order: Number(fd.get("sort_order") ?? 0) || 0,
  });
  if (error) return { error: error.message };
  revalidatePath("/admin/settings");
  return { ok: true };
}

export async function deletePickupLocation(fd: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  await supabase.from("pickup_locations").delete().eq("id", String(fd.get("id")));
  revalidatePath("/admin/settings");
}

/** Create one event per entry (used by the "add practice days" widget). Returns created ids in input order. */
export async function createEventsBatch(input: {
  kind: "practice" | "race" | "social" | "other";
  items: { title: string; starts_at: string; ends_at: string | null; rsvp_deadline: string | null }[];
  location_name: string | null; location_lat: number | null; location_lon: number | null; notes: string | null;
}): Promise<{ ids?: string[]; error?: string }> {
  const { org, userId } = await requireAdmin();
  if (!input.items.length) return { error: "Add at least one date" };
  const supabase = await createClient();
  const { data, error } = await supabase.from("events").insert(input.items.map((it) => ({
    org_id: org.id, created_by: userId, kind: input.kind, title: it.title, starts_at: it.starts_at, ends_at: it.ends_at, rsvp_deadline: it.rsvp_deadline,
    location_name: input.location_name, location_lat: input.location_lat, location_lon: input.location_lon, notes: input.notes,
  }))).select("id, starts_at");
  if (error) return { error: error.message };
  revalidatePath("/events"); revalidatePath("/dashboard"); revalidatePath("/admin/events");
  const order = new Map(input.items.map((it, i) => [it.starts_at, i]));
  return { ids: (data ?? []).sort((a, b) => (order.get(new Date(a.starts_at).toISOString()) ?? 0) - (order.get(new Date(b.starts_at).toISOString()) ?? 0)).map((d) => d.id) };
}
