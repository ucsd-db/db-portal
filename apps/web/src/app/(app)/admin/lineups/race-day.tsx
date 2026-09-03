import Link from "next/link";
import type { LineupRow } from "@/lib/database.types";
import { renameDivision } from "./actions";

/**
 * Race-day workspace sections: division → boat columns → race chips.
 * Divisions/boats are derived by grouping lineup rows (division + boat_label);
 * rows are already sorted by created_at, which orders divisions, races.
 */
export default function RaceDaySections({ eventId, rows, currentId }: { eventId: string; rows: LineupRow[]; currentId: string | null }) {
  const divisions = new Map<string, LineupRow[]>();
  for (const r of rows) {
    const list = divisions.get(r.division!) ?? [];
    list.push(r);
    divisions.set(r.division!, list);
  }

  return (
    <div className="space-y-4">
      {[...divisions.entries()].map(([division, list]) => {
        const boats = new Map<string, LineupRow[]>();
        for (const r of list) {
          const label = r.boat_label ?? "A";
          const bl = boats.get(label) ?? [];
          bl.push(r);
          boats.set(label, bl);
        }
        const labels = [...boats.keys()].sort();
        const nextLabel = String.fromCharCode(65 + labels.length); // A, B, C…
        const dtype = list[0].boat_type;
        return (
          <section key={division} className="card space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-medium">{division}</h2>
              <span className="chip">{dtype}</span>
              <details className="text-xs">
                <summary className="cursor-pointer text-slate-500 underline">rename</summary>
                <form action={renameDivision} className="mt-2 flex flex-wrap items-center gap-2">
                  <input type="hidden" name="event_id" value={eventId} />
                  <input type="hidden" name="from" value={division} />
                  <input name="to" defaultValue={division} required className="input w-40 py-1" />
                  <select name="boat_type" defaultValue={dtype} className="input w-auto py-1">
                    <option value="open">Open</option><option value="mixed">Mixed</option><option value="womens">Women&apos;s</option>
                  </select>
                  <button className="btn-secondary py-1">Save</button>
                </form>
              </details>
            </div>
            <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))" }}>
              {labels.map((label) => (
                <div key={label} className="rounded-md border p-2" style={{ borderColor: "var(--g-grey-300)" }}>
                  <div className="mb-2 text-sm font-medium">Boat {label}</div>
                  <div className="flex flex-wrap gap-1.5 text-sm">
                    {boats.get(label)!.map((l) => (
                      <Link key={l.id} href={`/admin/lineups?event=${eventId}&lineup=${l.id}`}
                        className={`rounded-full border px-3 py-1 ${l.id === currentId ? "border-sky-600 bg-sky-50" : "border-slate-300"}`}>
                        {l.name}{l.published && <span style={{ color: "var(--g-green)" }}> ●</span>}
                      </Link>
                    ))}
                    <Link href={`/admin/lineups?event=${eventId}&new=1&division=${encodeURIComponent(division)}&dtype=${dtype}&boat=${encodeURIComponent(label)}`}
                      className="rounded-full border border-dashed border-slate-300 px-3 py-1 text-slate-500">+ race</Link>
                  </div>
                </div>
              ))}
              <Link href={`/admin/lineups?event=${eventId}&new=1&division=${encodeURIComponent(division)}&dtype=${dtype}&boat=${nextLabel}`}
                className="flex min-h-16 items-center justify-center rounded-md border border-dashed text-sm text-slate-500 hover:text-[var(--g-blue)]" style={{ borderColor: "var(--g-grey-300)" }}>
                + Boat {nextLabel}
              </Link>
            </div>
          </section>
        );
      })}
      <Link href={`/admin/lineups?event=${eventId}&adddiv=1`} className="btn-secondary inline-block">+ Add division</Link>
    </div>
  );
}
