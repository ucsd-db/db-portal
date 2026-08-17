import Link from "next/link";
import { requireOrg } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import LocalTime from "@/components/local-time";

// events that started up to 6h ago still show (in-progress)
const cutoffIso = () => new Date(Date.now() - 6 * 3600e3).toISOString();

export default async function EventsPage() {
  const { org, userId } = await requireOrg();
  const supabase = await createClient();
  const { data: events } = await supabase
    .from("events")
    .select("*, rsvps(user_id, status), group:event_groups(id, name)")
    .eq("org_id", org.id)
    .gte("starts_at", cutoffIso())
    .order("starts_at");
  // Group consecutive days that belong to the same event group.
  type Ev = NonNullable<typeof events>[number];
  const sections: { group: { id: string; name: string } | null; items: Ev[] }[] = [];
  for (const ev of events ?? []) {
    const g = ev.group as { id: string; name: string } | null;
    const last = sections[sections.length - 1];
    if (last && last.group?.id && last.group.id === g?.id) last.items.push(ev);
    else sections.push({ group: g, items: [ev] });
  }

  return (
    <div>
      <h1 className="text-2xl font-normal mb-4">Events</h1>
      {!events?.length && <p className="text-slate-500">No upcoming events.</p>}
      {sections.map((sec, si) => (
      <div key={si} className={sec.group ? "mb-4 rounded-lg border p-3" : "mb-2"} style={sec.group ? { borderColor: "var(--g-grey-300)", background: "#fff" } : undefined}>
      {sec.group && <div className="mb-2 flex items-center justify-between"><Link href={`/groups/${sec.group.id}`} className="font-medium hover:underline">{sec.group.name}</Link><Link href={`/groups/${sec.group.id}`} className="btn-text -mr-3">Overview: lineups & rides →</Link></div>}
      <ul className="space-y-2">
        {sec.items.map((p) => {
          const rsvps = p.rsvps as { user_id: string; status: string }[];
          const mine = rsvps.find((r) => r.user_id === userId)?.status;
          const yes = rsvps.filter((r) => r.status === "yes").length;
          return (
            <li key={p.id}>
              <Link href={`/events/${p.id}`} className="card card-hover flex items-center gap-4">
                <div className="w-14 shrink-0 rounded-lg border text-center overflow-hidden" style={{ borderColor: "var(--g-grey-300)" }}>
                  <div className="text-[10px] uppercase text-white py-0.5" style={{ background: "var(--g-blue)" }}><LocalTime iso={p.starts_at} mode="month" /></div>
                  <div className="text-xl font-medium py-1"><LocalTime iso={p.starts_at} mode="day" /></div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{p.title} <span className="chip !py-0 ml-1">{p.kind}</span></div>
                  <div className="text-sm text-slate-500"><LocalTime iso={p.starts_at} />{p.location_name && ` · ${p.location_name}`}</div>
                </div>
                <div className="text-right text-sm">
                  <div className="text-slate-500">{yes} going</div>
                  <div className={mine ? "font-medium" : "text-amber-600"}>{mine ? `You: ${mine}` : "RSVP needed"}</div>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
      </div>
      ))}
    </div>
  );
}
