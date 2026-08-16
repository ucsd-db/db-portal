import Link from "next/link";
import { requireAdmin } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { fmtDate } from "@/lib/format";
import type { Roster, Lineup, BoatType } from "@db/lineup";
import type { Profile } from "@/lib/database.types";
import LineupBuilder from "./builder";

export default async function AdminLineupsPage({ searchParams }: { searchParams: Promise<{ practice?: string; lineup?: string }> }) {
  const { practice: practiceId, lineup: lineupId } = await searchParams;
  const { org } = await requireAdmin();
  const supabase = await createClient();

  const [{ data: practices }, { data: members }, { data: lineups }] = await Promise.all([
    supabase.from("practices").select("id, title, starts_at").eq("org_id", org.id).order("starts_at", { ascending: false }).limit(30),
    supabase.from("memberships").select("profile:profiles(*)").eq("org_id", org.id),
    supabase.from("lineups").select("*").eq("org_id", org.id).order("updated_at", { ascending: false }),
  ]);

  // Roster: everyone in the org; if a practice is selected, restrict to yes/maybe RSVPs.
  let allowed: Set<string> | null = null;
  if (practiceId) {
    const { data: rs } = await supabase.from("rsvps").select("user_id, status").eq("practice_id", practiceId).in("status", ["yes", "maybe"]);
    allowed = new Set((rs ?? []).map((r) => r.user_id));
  }
  const roster: Roster = {};
  for (const m of members ?? []) {
    const p = m.profile as unknown as Profile;
    if (!p || (allowed && !allowed.has(p.id))) continue;
    roster[p.id] = { id: p.id, name: p.full_name || p.email, weight: p.weight_kg ?? 0, gender: p.gender, sidePreference: p.side_preference, canSteer: p.can_steer, canDrum: p.can_drum };
  }

  const forPractice = (lineups ?? []).filter((l) => (practiceId ? l.practice_id === practiceId : true));
  const current = lineupId ? (lineups ?? []).find((l) => l.id === lineupId) ?? null : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">Lineups</h1>
        <form className="flex items-center gap-2 text-sm">
          <label>Practice:</label>
          <select name="practice" defaultValue={practiceId ?? ""} className="input w-auto py-1">
            <option value="">(none — full roster)</option>
            {practices?.map((p) => <option key={p.id} value={p.id}>{p.title} · {fmtDate(p.starts_at)}</option>)}
          </select>
          <button className="btn-secondary py-1">Go</button>
        </form>
      </div>
      <div className="flex flex-wrap gap-2 text-sm">
        {forPractice.map((l) => (
          <Link key={l.id} href={`/admin/lineups?${practiceId ? `practice=${practiceId}&` : ""}lineup=${l.id}`}
            className={`rounded-full border px-3 py-1 ${l.id === lineupId ? "border-sky-600 bg-sky-50" : "border-slate-300"}`}>
            {l.name} <span className="text-slate-400">· {l.boat_type}{l.published ? " · published" : ""}</span>
          </Link>
        ))}
        <Link href={`/admin/lineups${practiceId ? `?practice=${practiceId}` : ""}`} className={`rounded-full border px-3 py-1 ${!lineupId ? "border-sky-600 bg-sky-50" : "border-dashed border-slate-300"}`}>+ New</Link>
      </div>
      <LineupBuilder
        key={current?.id ?? "new"}
        roster={roster}
        practiceId={practiceId ?? null}
        initial={current ? { id: current.id, name: current.name, boatType: current.boat_type as BoatType, published: current.published, data: current.data as unknown as Lineup } : null}
      />
    </div>
  );
}
