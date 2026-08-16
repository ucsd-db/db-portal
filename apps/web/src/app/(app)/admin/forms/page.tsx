import Link from "next/link";
import { requireAdmin } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { fmtDateTime } from "@/lib/format";
import { createForm, duplicateForm } from "./actions";

const badge: Record<string, string> = { draft: "bg-slate-100 text-slate-600", open: "bg-green-100 text-green-700", closed: "bg-amber-100 text-amber-700" };

export default async function AdminFormsPage() {
  const { org } = await requireAdmin();
  const supabase = await createClient();
  const [{ data: forms }, { count: memberCount }] = await Promise.all([
    supabase.from("forms").select("*, form_responses(user_id), form_events(event_id)").eq("org_id", org.id).order("created_at", { ascending: false }),
    supabase.from("memberships").select("*", { count: "exact", head: true }).eq("org_id", org.id),
  ]);
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Forms</h1>
        <form action={createForm}><button className="btn-primary">New form</button></form>
      </div>
      <p className="text-sm text-slate-500 mb-4">A form bundles one or more events (each gets the attendance + ride question) with your own custom questions. Members see forms once they’re <b>open</b>; latest submission wins.</p>
      <ul className="space-y-2">
        {forms?.map((f) => {
          const responses = (f.form_responses as { user_id: string }[]).length;
          return (
            <li key={f.id} className="card flex items-center justify-between gap-3 text-sm">
              <div>
                <Link href={`/admin/forms/${f.id}`} className="font-medium hover:underline">{f.title}</Link>
                <span className={`ml-2 rounded-full px-2 py-0.5 text-[11px] ${badge[f.status]}`}>{f.status}</span>
                <div className="text-xs text-slate-500">
                  {(f.form_events as unknown[]).length} event(s){f.due_at && ` · due ${fmtDateTime(f.due_at)}`} · {responses}/{memberCount ?? "?"} responded
                </div>
              </div>
              <div className="flex gap-3 shrink-0 text-xs">
                <Link href={`/admin/forms/${f.id}/responses`} className="underline">Responses</Link>
                <Link href={`/admin/forms/${f.id}`} className="underline">Edit</Link>
                <form action={duplicateForm}><input type="hidden" name="id" value={f.id} /><button className="underline">Duplicate</button></form>
              </div>
            </li>
          );
        })}
        {!forms?.length && <li className="text-slate-500">No forms yet.</li>}
      </ul>
    </div>
  );
}
