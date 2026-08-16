import { ROWS, type Lineup } from "@db/lineup";

/** Read-only lineup grid for members. `names` maps paddler id → display name. */
export default function LineupView({ name, lineup, names, boatType }: { name: string; lineup: Lineup; names: Record<string, string>; boatType: string }) {
  const n = (id: string | null) => (id ? names[id] ?? "?" : "—");
  return (
    <div className="card text-sm">
      <div className="font-semibold mb-2">{name} <span className="text-slate-400 font-normal">· {boatType}</span></div>
      <table className="w-full text-xs">
        <tbody>
          <tr><td className="py-0.5 text-slate-500 w-10">Drum</td><td colSpan={2} className="text-center">{n(lineup.drummer)}</td></tr>
          {Array.from({ length: ROWS }, (_, r) => (
            <tr key={r} className="border-t border-slate-100">
              <td className="py-0.5 text-slate-500">{r + 1}</td>
              <td className="py-0.5 w-1/2">{n(lineup.seats[r]?.[0] ?? null)}</td>
              <td className="py-0.5 w-1/2 text-right">{n(lineup.seats[r]?.[1] ?? null)}</td>
            </tr>
          ))}
          <tr className="border-t border-slate-100"><td className="py-0.5 text-slate-500">Steer</td><td colSpan={2} className="text-center">{n(lineup.steer)}</td></tr>
        </tbody>
      </table>
    </div>
  );
}
