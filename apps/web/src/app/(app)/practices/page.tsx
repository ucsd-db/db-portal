import Link from "next/link";
import { requireOrg } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { fmtDateTime } from "@/lib/format";

// practices that started up to 6h ago still show (in-progress)
const cutoffIso = () => new Date(Date.now() - 6 * 3600e3).toISOString();

export default async function PracticesPage() {
  const { org, userId } = await requireOrg();
  const supabase = await createClient();
  const { data: practices } = await supabase
    .from("practices")
    .select("*, rsvps(user_id, status)")
    .eq("org_id", org.id)
    .gte("starts_at", cutoffIso())
    .order("starts_at");

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Practices</h1>
      {!practices?.length && <p className="text-slate-500">No upcoming practices.</p>}
      <ul className="space-y-2">
        {practices?.map((p) => {
          const rsvps = p.rsvps as { user_id: string; status: string }[];
          const mine = rsvps.find((r) => r.user_id === userId)?.status;
          const yes = rsvps.filter((r) => r.status === "yes").length;
          return (
            <li key={p.id}>
              <Link href={`/practices/${p.id}`} className="card flex items-center justify-between gap-3 hover:border-sky-400">
                <div>
                  <div className="font-medium">{p.title}</div>
                  <div className="text-sm text-slate-500">{fmtDateTime(p.starts_at)}{p.location_name && ` · ${p.location_name}`}</div>
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
  );
}
