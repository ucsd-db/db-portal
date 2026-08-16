import Link from "next/link";
import { requireAdmin } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { fmtDateTime } from "@/lib/format";
import { createForm, duplicateForm } from "./actions";

const status: Record<string, [string, string, string]> = { draft: ["Draft", "var(--g-grey-100)", "var(--g-grey-600)"], open: ["Accepting responses", "var(--g-green-soft)", "var(--g-green)"], closed: ["Closed", "#fef7e0", "#b06000"] };

export default async function AdminFormsPage() {
  const { org } = await requireAdmin();
  const supabase = await createClient();
  const [{ data: forms }, { count: memberCount }] = await Promise.all([
    supabase.from("forms").select("*, form_responses(user_id), form_events(event_id)").eq("org_id", org.id).order("created_at", { ascending: false }),
    supabase.from("memberships").select("*", { count: "exact", head: true }).eq("org_id", org.id),
  ]);
  return (
    <div className="mx-auto max-w-[1100px]">
      <section className="mb-6">
        <h2 className="text-base font-medium mb-3">Start a new form</h2>
        <div className="flex gap-4">
          <form action={createForm}>
            <button className="card card-hover flex h-32 w-40 flex-col items-center justify-center gap-2 !p-0" style={{ background: "#fff" }}>
              <span className="text-4xl" style={{ color: "var(--g-purple)" }}>＋</span>
              <span className="text-xs">Blank form</span>
            </button>
          </form>
        </div>
      </section>
      <section>
        <h2 className="text-base font-medium mb-3">Your forms</h2>
        {!forms?.length && <p className="text-sm" style={{ color: "var(--g-grey-600)" }}>No forms yet. Forms bundle events (each gets the attendance + ride question) with your own custom questions.</p>}
        <div className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(210px,1fr))]">
          {forms?.map((f) => {
            const responses = (f.form_responses as { user_id: string }[]).length;
            const st = status[f.status];
            return (
              <div key={f.id} className="card card-hover !p-0 overflow-hidden flex flex-col">
                <Link href={`/admin/forms/${f.id}`} className="block h-24 relative" style={{ background: "var(--g-purple-soft)" }}>
                  <div className="absolute inset-x-4 top-4 h-2 rounded" style={{ background: "var(--g-purple)" }} />
                  <div className="absolute inset-x-4 top-9 space-y-1.5">{[0, 1, 2].map((i) => <div key={i} className="h-1.5 rounded bg-white/80" style={{ width: `${80 - i * 20}%` }} />)}</div>
                </Link>
                <div className="p-3 text-sm flex-1">
                  <Link href={`/admin/forms/${f.id}`} className="font-medium hover:underline line-clamp-2">{f.title}</Link>
                  <div className="mt-1 text-xs" style={{ color: "var(--g-grey-600)" }}>{(f.form_events as unknown[]).length} event(s){f.due_at && ` · due ${fmtDateTime(f.due_at)}`}</div>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="chip" style={{ background: st[1], color: st[2], borderColor: "transparent" }}>{st[0]}</span>
                    <span className="text-xs" style={{ color: "var(--g-grey-600)" }}>{responses}/{memberCount ?? "?"}</span>
                  </div>
                </div>
                <div className="flex border-t text-xs" style={{ borderColor: "var(--g-grey-300)" }}>
                  <Link href={`/admin/forms/${f.id}/responses`} className="flex-1 py-2 text-center hover:bg-[var(--g-grey-50)]" style={{ color: "var(--g-blue)" }}>Responses</Link>
                  <form action={duplicateForm} className="flex-1 border-l" style={{ borderColor: "var(--g-grey-300)" }}><input type="hidden" name="id" value={f.id} /><button className="w-full py-2 hover:bg-[var(--g-grey-50)]" style={{ color: "var(--g-blue)" }}>Duplicate</button></form>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
