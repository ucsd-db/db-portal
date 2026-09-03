import { ROWS, type Lineup } from "@db/lineup";

/** Read-only lineup grid for members — spreadsheet-style cells like the original lineup maker. */
export default function LineupView({ name, lineup, names, boatType }: { name: string; lineup: Lineup; names: Record<string, string>; boatType: string }) {
  const n = (id: string | null | undefined) => (id ? names[id] ?? "?" : "");
  const cell = (badge: string, id: string | null | undefined, extra = "") => (
    <div className={`sheet-cell ${extra}`}>
      <span className="sheet-badge">{badge}</span>
      {id && <span className="sheet-name">{n(id)}</span>}
    </div>
  );
  return (
    <div className="card overflow-x-auto text-sm">
      <div className="sheet-title mb-2">{name} · {boatType}</div>
      <div className="mx-auto w-max">
        <div className="flex justify-center">{cell("C", lineup.drummer)}</div>
        {Array.from({ length: ROWS }, (_, r) => (
          <div key={r} className="-mt-px flex">
            {cell(`${r + 1}L`, lineup.seats[r]?.[0])}
            {cell(`${r + 1}R`, lineup.seats[r]?.[1], "-ml-px")}
          </div>
        ))}
        <div className="-mt-px flex justify-center">{cell("S", lineup.steer)}</div>
      </div>
    </div>
  );
}
