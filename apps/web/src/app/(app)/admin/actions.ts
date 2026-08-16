"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export type AdminState = { error?: string; ok?: boolean };
const str = (v: FormDataEntryValue | null) => (v === null || String(v).trim() === "" ? null : String(v).trim());
const iso = (v: FormDataEntryValue | null) => (str(v) ? new Date(String(v)).toISOString() : null);

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

export async function createEvent(_: AdminState, fd: FormData): Promise<AdminState> {
  const { org, userId } = await requireAdmin();
  const supabase = await createClient();
  const starts = iso(fd.get("starts_at"));
  if (!starts) return { error: "Start time is required" };
  const { error } = await supabase.from("events").insert({
    org_id: org.id, created_by: userId,
    kind: (str(fd.get("kind")) ?? "practice") as "practice" | "race" | "social" | "other",
    title: String(fd.get("title")).trim(),
    starts_at: starts, ends_at: iso(fd.get("ends_at")), rsvp_deadline: iso(fd.get("rsvp_deadline")),
    location_name: str(fd.get("location_name")),
    location_lat: str(fd.get("location_lat")) ? Number(fd.get("location_lat")) : null,
    location_lon: str(fd.get("location_lon")) ? Number(fd.get("location_lon")) : null,
    notes: str(fd.get("notes")),
  });
  if (error) return { error: error.message };
  revalidatePath("/events"); revalidatePath("/dashboard"); revalidatePath("/admin/events");
  return { ok: true };
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
