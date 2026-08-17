"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { parseAttendance } from "@/lib/attendance";
import type { FormQuestion, Json } from "@/lib/database.types";
import { cleanHtml, htmlToText } from "@/lib/html";

export type SubmitState = { error?: string; saved?: boolean };

export async function submitForm(_: SubmitState, fd: FormData): Promise<SubmitState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };
  const formId = String(fd.get("form_id"));

  const [{ data: form }, { data: links }] = await Promise.all([
    supabase.from("forms").select("*").eq("id", formId).maybeSingle(),
    supabase.from("form_events").select("event_id").eq("form_id", formId),
  ]);
  if (!form || form.status !== "open") return { error: "This form is not accepting responses." };

  // 1. optional weight update
  const w = String(fd.get("weight_kg") ?? "").trim();
  if (w) await supabase.from("profiles").update({ weight_kg: Number(w) }).eq("id", user.id);

  // 2. per-event attendance → rsvps
  for (const l of links ?? []) {
    const v = parseAttendance(fd, `ev_${l.event_id}_`);
    if (!v) return { error: "Please answer every attendance question." };
    const { error } = await supabase.from("rsvps").upsert({ event_id: l.event_id, user_id: user.id, form_id: formId, ...v });
    if (error) return { error: error.message };
  }

  // 3. custom answers
  const questions = (form.questions as unknown as FormQuestion[]) ?? [];
  const answers: Record<string, Json> = {};
  for (const q of questions) {
    const key = `q_${q.id}`;
    let val: Json = null;
    if (q.type === "multi_choice") val = fd.getAll(key).map(String);
    else if (q.type === "yes_no") { const s = fd.get(key); val = s === "yes" ? true : s === "no" ? false : null; }
    else if (q.type === "number") { const s = String(fd.get(key) ?? "").trim(); val = s ? Number(s) : null; }
    else if (q.type === "long_text") { const raw = String(fd.get(key) ?? "").trim(); const clean = raw ? cleanHtml(raw) : ""; val = htmlToText(clean).trim() ? clean : null; }
    else val = String(fd.get(key) ?? "").trim() || null;
    const empty = val === null || (Array.isArray(val) && !val.length);
    if (q.required && empty) return { error: `"${q.label}" is required.` };
    answers[q.id] = val;
  }
  const { error } = await supabase.from("form_responses").upsert({ form_id: formId, user_id: user.id, answers, submitted_at: new Date().toISOString() });
  if (error) return { error: error.message };

  revalidatePath(`/forms/${formId}`); revalidatePath("/forms"); revalidatePath("/events"); revalidatePath("/dashboard");
  return { saved: true };
}
