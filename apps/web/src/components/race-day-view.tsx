import type { Lineup } from "@db/lineup";
import type { LineupRow } from "@/lib/database.types";
import LineupView from "@/components/lineup-view";

/**
 * Read-only lineups for a day: practice/custom rows (division null) render as
 * plain cards; race rows group division → boat → race. Pass rows sorted by
 * created_at (division/race order follows creation).
 */
export default function RaceDayView({ lineups, names, showDraft = false }: { lineups: LineupRow[]; names: Record<string, string>; showDraft?: boolean }) {
  const plain = lineups.filter((l) => !l.division);
  const race = lineups.filter((l) => l.division);

  const divisions = new Map<string, Map<string, LineupRow[]>>();
  for (const l of race) {
    const boats = divisions.get(l.division!) ?? new Map<string, LineupRow[]>();
    const label = l.boat_label ?? "A";
    boats.set(label, [...(boats.get(label) ?? []), l]);
    divisions.set(l.division!, boats);
  }

  const card = (l: LineupRow, title: string) => (
    <div key={l.id} className="relative">
      {showDraft && !l.published && <span className="absolute right-2 top-2 chip text-xs">draft</span>}
      <LineupView name={title} boatType={l.boat_type} lineup={l.data as unknown as Lineup} names={names} />
    </div>
  );

  return (
    <div className="space-y-4">
      {plain.length > 0 && <div className="grid gap-3 sm:grid-cols-2">{plain.map((l) => card(l, l.name))}</div>}
      {[...divisions.entries()].map(([division, boats]) => (
        <div key={division}>
          <h3 className="mb-2 text-sm font-medium">{division} <span className="font-normal text-slate-400">· {boats.values().next().value?.[0]?.boat_type}</span></h3>
          <div className="space-y-3">
            {[...boats.keys()].sort().map((label) => (
              <div key={label}>
                <div className="mb-1 text-xs text-slate-500">Boat {label}</div>
                <div className="grid gap-3 sm:grid-cols-2">{boats.get(label)!.map((l) => card(l, l.name))}</div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
