import { notFound } from "next/navigation";
import Link from "next/link";
import { requireAdmin } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import type { FormQuestion } from "@/lib/database.types";
import { deleteForm } from "../actions";
import FormEditor from "./editor";

// events from the last two weeks onward are offered for linking
const sinceIso = () => new Date(Date.now() - 14 * 86400e3).toISOString();

export default async function AdminFormEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { org } = await requireAdmin();
  const supabase = await createClient();
  const [{ data: form }, { data: links }, { data: events }] = await Promise.all([
    supabase.from("forms").select("*").eq("id", id).eq("org_id", org.id).maybeSingle(),
    supabase.from("form_events").select("*").eq("form_id", id).order("sort_order"),
    supabase.from("events").select("id, title, kind, starts_at").eq("org_id", org.id)
      .gte("starts_at", sinceIso()).order("starts_at"),
  ]);
  if (!form) notFound();
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Edit form</h1>
        <div className="flex gap-3 text-sm">
          <Link href={`/admin/forms/${id}/responses`} className="btn-secondary">Responses</Link>
          <Link href={`/forms/${id}`} className="btn-secondary">Preview</Link>
          <form action={deleteForm}><input type="hidden" name="id" value={id} /><button className="text-red-600 underline">Delete</button></form>
        </div>
      </div>
      <FormEditor
        id={id}
        initial={{ title: form.title, description: form.description, due_at: form.due_at, status: form.status, questions: (form.questions as unknown as FormQuestion[]) ?? [], events: (links ?? []).map((l) => ({ event_id: l.event_id, prompt: l.prompt })) }}
        events={events ?? []}
      />
    </div>
  );
}
