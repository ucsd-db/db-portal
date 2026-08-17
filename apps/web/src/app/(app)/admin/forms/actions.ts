"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import type { FormQuestion, Json } from "@/lib/database.types";
import { cleanHtml } from "@/lib/html";

export async function createForm() {
  const { org, userId } = await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase.from("forms")
    .insert({ org_id: org.id, title: "Untitled form", created_by: userId })
    .select("id").single();
  if (error) throw new Error(error.message);
  redirect(`/admin/forms/${data.id}`);
}

export type FormPayload = {
  title: string; description: string; due_at: string | null; status: "draft" | "open" | "closed";
  questions: FormQuestion[];
  events: { event_id: string; prompt: string | null }[];
};

export async function saveForm(id: string, p: FormPayload) {
  const { org } = await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("forms")
    .update({ title: p.title.trim() || "Untitled form", description: cleanHtml(p.description), due_at: p.due_at, status: p.status, questions: p.questions as unknown as Json })
    .eq("id", id).eq("org_id", org.id);
  if (error) return { error: error.message };
  // Replace event links.
  await supabase.from("form_events").delete().eq("form_id", id);
  if (p.events.length) {
    const { error: e2 } = await supabase.from("form_events")
      .insert(p.events.map((e, i) => ({ form_id: id, event_id: e.event_id, prompt: e.prompt, sort_order: i })));
    if (e2) return { error: e2.message };
  }
  revalidatePath(`/admin/forms/${id}`); revalidatePath("/admin/forms"); revalidatePath("/forms"); revalidatePath("/dashboard");
  return { ok: true };
}

export async function deleteForm(fd: FormData) {
  const { org } = await requireAdmin();
  const supabase = await createClient();
  await supabase.from("forms").delete().eq("id", String(fd.get("id"))).eq("org_id", org.id);
  revalidatePath("/admin/forms"); revalidatePath("/forms");
  redirect("/admin/forms");
}

export async function duplicateForm(fd: FormData) {
  const { org, userId } = await requireAdmin();
  const supabase = await createClient();
  const { data: src } = await supabase.from("forms").select("*").eq("id", String(fd.get("id"))).eq("org_id", org.id).single();
  if (!src) return;
  const { data: copy } = await supabase.from("forms").insert({
    org_id: org.id, created_by: userId, title: `${src.title} (copy)`, description: src.description, questions: src.questions, status: "draft",
  }).select("id").single();
  if (copy) redirect(`/admin/forms/${copy.id}`);
}
