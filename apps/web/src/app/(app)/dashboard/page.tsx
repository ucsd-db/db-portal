import Link from "next/link";
import { requireOrg } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { fmtDateTime } from "@/lib/format";

export default async function DashboardPage() {
  const { org, isAdmin } = await requireOrg();
  const supabase = await createClient();
  const [{ data: announcements }, { data: practices }] = await Promise.all([
    supabase.from("announcements").select("*, author:profiles(full_name)").eq("org_id", org.id)
      .order("pinned", { ascending: false }).order("created_at", { ascending: false }).limit(10),
    supabase.from("practices").select("*").eq("org_id", org.id)
      .gte("starts_at", new Date().toISOString()).order("starts_at").limit(5),
  ]);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <section>
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-2xl font-bold">Board</h1>
          {isAdmin && <Link href="/admin/announcements" className="btn-secondary">New announcement</Link>}
        </div>
        {!announcements?.length && <p className="text-slate-500">No announcements yet.</p>}
        <div className="space-y-3">
          {announcements?.map((a) => (
            <article key={a.id} className="card">
              <div className="flex items-baseline justify-between gap-2">
                <h2 className="font-semibold">{a.pinned && "📌 "}{a.title}</h2>
                <span className="text-xs text-slate-400 whitespace-nowrap">{fmtDateTime(a.created_at)}</span>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{a.body}</p>
              <p className="mt-2 text-xs text-slate-400">— {(a.author as { full_name: string } | null)?.full_name ?? "Admin"}</p>
            </article>
          ))}
        </div>
      </section>
      <aside>
        <h2 className="font-semibold mb-3">Upcoming practices</h2>
        {!practices?.length && <p className="text-sm text-slate-500">Nothing scheduled.</p>}
        <ul className="space-y-2">
          {practices?.map((p) => (
            <li key={p.id}>
              <Link href={`/practices/${p.id}`} className="card block hover:border-sky-400">
                <div className="font-medium text-sm">{p.title}</div>
                <div className="text-xs text-slate-500">{fmtDateTime(p.starts_at)}{p.location_name && ` · ${p.location_name}`}</div>
              </Link>
            </li>
          ))}
        </ul>
        {isAdmin && (
          <div className="card mt-4 text-sm">
            <div className="text-xs text-slate-500">Team join code</div>
            <div className="font-mono text-lg tracking-wider">{org.join_code}</div>
            <p className="text-xs text-slate-500 mt-1">Share this with paddlers so they can join.</p>
          </div>
        )}
      </aside>
    </div>
  );
}
