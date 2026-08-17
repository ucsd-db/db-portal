import Link from "next/link";
import { requireAdmin } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import LocalTime from "@/components/local-time";
import { deleteEvent } from "../actions";
import EventBatchForm from "@/components/event-batch-form";

export default async function AdminEventsPage() {
  const { org } = await requireAdmin();
  const supabase = await createClient();
  const { data: items } = await supabase.from("events").select("*, rsvps(status)").eq("org_id", org.id)
    .order("starts_at", { ascending: false }).limit(50);
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section>
        <h1 className="text-2xl font-normal mb-1">New events</h1>
        <p className="text-sm mb-3" style={{ color: "var(--g-grey-600)" }}>Pick the dates and type the times — one event is created per date.</p>
        <EventBatchForm />
      </section>
      <section>
        <h2 className="text-lg font-medium mb-3">All events</h2>
        <ul className="space-y-2">
          {items?.map((p) => {
            const r = p.rsvps as { status: string }[];
            const c = (s: string) => r.filter((x) => x.status === s).length;
            return (
              <li key={p.id} className="card text-sm">
                <div className="flex justify-between gap-2">
                  <div>
                    <Link href={`/events/${p.id}`} className="font-medium hover:underline">{p.title}</Link> <span className="text-[10px] uppercase text-slate-400">{p.kind}</span>
                    <div className="text-xs text-slate-500"><LocalTime iso={p.starts_at} /></div>
                    <div className="text-xs text-slate-500">✅ {c("yes")} · 🤔 {c("maybe")} · ❌ {c("no")}</div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <Link href={`/admin/lineups?event=${p.id}`} className="text-xs underline">Lineups</Link>
                    <Link href={`/admin/carpool?event=${p.id}`} className="text-xs underline">Carpool</Link>
                    <form action={deleteEvent}><input type="hidden" name="id" value={p.id} />
                      <button className="text-xs text-red-600 underline">Delete</button></form>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
