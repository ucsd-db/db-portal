"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  autoFill, emptyLineup, frontBackWeights, getSeat, lineupPaddlerIds, lineupWarnings, placePaddler,
  removePaddler, seatedElsewhere, seatKey, sideWeights, swapSeats, toMastersheet, ROWS,
  type BoatType, type Lineup, type Roster, type Seat,
} from "@db/lineup";
import { deleteLineup, saveLineup } from "./actions";

type Initial = { id: string; name: string; boatType: BoatType; published: boolean; data: Lineup } | null;
type Sel = { kind: "seat"; seat: Seat } | { kind: "roster"; id: string } | null;

export default function LineupBuilder({ roster, eventId, initial, division = null, boatLabel = null, siblings = [], dayIds = null, initialWholeTeam = false, defaultBoatType = "open" }: {
  roster: Roster;
  eventId: string | null;
  initial: Initial;
  /** Boat type for a fresh lineup (race days: the division's type). */
  defaultBoatType?: BoatType;
  /** Race-day context: division name + boat label; null division = practice/custom lineup. */
  division?: string | null;
  boatLabel?: string | null;
  /** Other boats of the same division (any race) — cross-boat placements warn, never block. */
  siblings?: { name: string; lineup: Lineup }[];
  /** yes/maybe RSVP ids for the day; null = no day (blank mode, full team). */
  dayIds?: string[] | null;
  initialWholeTeam?: boolean;
}) {
  const router = useRouter();
  // No restrictions anywhere: only "one seat per person per boat" blocks; gender rules just warn.
  const soft = true;
  const [id, setId] = useState(initial?.id ?? null);
  const [name, setName] = useState(initial?.name ?? (division ? "Race 1" : "Boat 1"));
  const [published, setPublished] = useState(initial?.published ?? false);
  const [lineup, setLineup] = useState<Lineup>(initial?.data && initial.data.seats ? initial.data : emptyLineup(initial?.boatType ?? defaultBoatType));
  const [sel, setSel] = useState<Sel>(null);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [wholeTeam, setWholeTeam] = useState(initialWholeTeam);
  const [pending, start] = useTransition();

  const seated = useMemo(() => new Set(lineupPaddlerIds(lineup)), [lineup]);
  const daySet = useMemo(() => (dayIds ? new Set(dayIds) : null), [dayIds]);
  const elsewhere = useMemo(() => seatedElsewhere(siblings), [siblings]);
  const bench = useMemo(() =>
    Object.values(roster).filter((p) => !seated.has(p.id) && (!daySet || wholeTeam || daySet.has(p.id)) && p.name.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => a.name.localeCompare(b.name)), [roster, seated, search, daySet, wholeTeam]);
  const warnings = useMemo(() => [
    ...lineupWarnings(lineup, roster),
    ...lineupPaddlerIds(lineup).filter((pid) => elsewhere.has(pid)).map((pid) => `${roster[pid]?.name ?? pid} is also in ${elsewhere.get(pid)!.join(", ")}`),
  ], [lineup, roster, elsewhere]);
  const sw = sideWeights(lineup, roster);
  const fb = frontBackWeights(lineup, roster);
  const nameOf = (pid: string | null) => (pid ? roster[pid]?.name ?? "(left team)" : null);

  const apply = (r: { lineup: Lineup; error?: string }) => { setError(r.error ?? null); if (!r.error) setLineup(r.lineup); };

  const clickSeat = (seat: Seat) => {
    setMsg(null);
    if (!sel) { if (getSeat(lineup, seat)) setSel({ kind: "seat", seat }); return; }
    if (sel.kind === "roster") { apply(placePaddler(lineup, seat, sel.id, roster, { soft })); setSel(null); return; }
    if (seatKey(sel.seat) === seatKey(seat)) { setSel(null); return; }
    apply(swapSeats(lineup, sel.seat, seat, roster, { soft })); setSel(null);
  };
  const clickBench = (pid: string) => {
    setMsg(null);
    if (sel?.kind === "seat") { setLineup(removePaddler(lineup, sel.seat)); setSel(null); return; }
    setSel(sel?.kind === "roster" && sel.id === pid ? null : { kind: "roster", id: pid });
  };
  const removeSelected = () => { if (sel?.kind === "seat") { setLineup(removePaddler(lineup, sel.seat)); setSel(null); } };

  const changeBoatType = (bt: BoatType) => { setLineup({ ...emptyLineup(bt), drummer: lineup.drummer, steer: lineup.steer }); setSel(null); };
  const fill = () => { const r = autoFill(lineup, roster, { sidePreferenceTolerance: 20 /* lb */ }); setLineup(r.lineup); setMsg(r.unplaced.length ? `${r.unplaced.length} paddler(s) could not be placed` : null); };
  const clear = () => setLineup(emptyLineup(lineup.boatType));

  const save = (pub = published) => start(async () => {
    const r = await saveLineup({ id, eventId, name, boatType: lineup.boatType, division, boatLabel, data: lineup, published: pub });
    if ("error" in r && r.error) { setError(r.error); return; }
    if ("id" in r && r.id) { setId(r.id); setPublished(pub); setMsg(pub ? "Saved & published" : "Saved"); router.refresh(); }
  });
  const del = () => { if (id && confirm("Delete this lineup?")) start(async () => { await deleteLineup(id); router.push(`/admin/lineups${eventId ? `?event=${eventId}` : ""}`); }); };
  const sheetName = division ? `${division} ${boatLabel ?? ""} — ${name}`.replace(/\s+/g, " ") : name;
  const copy = () => navigator.clipboard.writeText(toMastersheet([{ name: sheetName, lineup }], roster)).then(() => setMsg("Copied mastersheet (paste into a spreadsheet)"));

  const isSel = (seat: Seat) => sel?.kind === "seat" && seatKey(sel.seat) === seatKey(seat);
  const seatProps = { lineup, roster, isSel, rosterSelected: sel?.kind === "roster", onClick: clickSeat };
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
      <div className="space-y-3">
        <div className="card flex flex-wrap items-center gap-2 text-sm">
          {division && <span className="chip whitespace-nowrap">{division}{boatLabel ? ` · Boat ${boatLabel}` : ""} · {lineup.boatType}</span>}
          <input value={name} onChange={(e) => setName(e.target.value)} className="input w-40" title={division ? "Race name (e.g. Qualifying, Final)" : "Boat name"} />
          {!division && (
            <select value={lineup.boatType} onChange={(e) => changeBoatType(e.target.value as BoatType)} className="input w-auto">
              <option value="open">Open</option><option value="mixed">Mixed</option><option value="womens">Women&apos;s</option>
            </select>
          )}
          <button type="button" onClick={fill} className="btn-secondary">Auto-fill</button>
          <button type="button" onClick={clear} className="btn-secondary">Clear</button>
          <button type="button" onClick={removeSelected} disabled={sel?.kind !== "seat"} className="btn-secondary">Unseat</button>
          <span className="flex-1" />
          <button type="button" onClick={copy} className="btn-secondary">Copy sheet</button>
          <button type="button" onClick={() => save(false)} disabled={pending} className="btn-secondary">Save draft</button>
          <button type="button" onClick={() => save(true)} disabled={pending} className="btn-primary">{published ? "Save & republish" : "Publish"}</button>
          {id && <button type="button" onClick={del} className="text-red-600 text-xs underline">Delete</button>}
        </div>
        {(error || msg) && <p className={`text-sm ${error ? "text-red-600" : "text-green-700"}`}>{error ?? msg}</p>}
        {warnings.length > 0 && (
          <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-700">
            {warnings.map((w) => <p key={w}>⚠ {w}</p>)}
          </div>
        )}
        <div className="card overflow-x-auto">
          <div className="mx-auto w-max">
            <div className="flex justify-center"><SeatBtn {...seatProps} seat={{ kind: "drummer" }} badge="C" /></div>
            {Array.from({ length: ROWS }, (_, row) => (
              <div key={row} className="-mt-px flex items-center">
                <span className="sheet-label">{weightAt(lineup, roster, row, "left")}</span>
                <SeatBtn {...seatProps} seat={{ kind: "seat", row, side: "left" }} badge={`${row + 1}L`} />
                <div className="-ml-px"><SeatBtn {...seatProps} seat={{ kind: "seat", row, side: "right" }} badge={`${row + 1}R`} /></div>
                <span className="sheet-label">{weightAt(lineup, roster, row, "right")}</span>
              </div>
            ))}
            <div className="-mt-px flex justify-center"><SeatBtn {...seatProps} seat={{ kind: "steer" }} badge="S" /></div>
          </div>
          <div className="mt-3 flex flex-wrap justify-center gap-4 text-xs text-slate-600">
            <span>Left: <b>{sw.left.toFixed(0)} lb</b></span>
            <span>Right: <b>{sw.right.toFixed(0)} lb</b></span>
            <span>L−R: <b className={Math.abs(sw.diff) > 30 ? "text-red-600" : ""}>{sw.diff > 0 ? "+" : ""}{sw.diff.toFixed(0)} lb</b></span>
            <span>Front−Back: <b>{fb.diff > 0 ? "+" : ""}{fb.diff.toFixed(0)} lb</b></span>
            <span>Seated: {seated.size}/22</span>
          </div>
        </div>
      </div>
      <aside className="card space-y-2 self-start">
        <div className="flex items-baseline justify-between"><h3 className="sheet-title">Available ({bench.length})</h3>
          {daySet ? (
            <label className="text-[11px] text-slate-500 flex items-center gap-1 cursor-pointer">
              <input type="checkbox" checked={wholeTeam} onChange={(e) => setWholeTeam(e.target.checked)} />whole team
            </label>
          ) : <span className="text-[11px] text-slate-500">whole team</span>}</div>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…" className="input py-1" />
        <p className="text-[11px] text-slate-500">Click a paddler, then a seat. Click two seats to swap. Select a seat then click here to unseat.</p>
        <ul className="max-h-[60vh] overflow-y-auto">
          {bench.map((p, i) => (
            <li key={p.id} className={`flex items-center ${i > 0 ? "-mt-px" : ""}`}>
              <button type="button" onClick={() => clickBench(p.id)}
                title={`${p.weight || "?"} lb${p.gender ? ` · ${p.gender}` : ""}${p.canSteer ? " · steers" : ""}${p.canDrum ? " · drums" : ""}${elsewhere.has(p.id) ? ` · also seated in ${elsewhere.get(p.id)!.join(", ")}` : ""}`}
                className={`sheet-cell !w-full flex-1 ${sel?.kind === "roster" && sel.id === p.id ? "sheet-cell-sel" : ""}`}>
                <span className="sheet-badge">{p.gender ? p.gender[0].toUpperCase() : ""}{p.canSteer ? " S" : ""}{p.canDrum ? " D" : ""}</span>
                <span className="sheet-name !max-w-[85%]">{p.name}{elsewhere.has(p.id) && <span className="text-amber-600"> ⚠</span>}</span>
              </button>
              <span className="sheet-label">{p.weight ? p.weight.toFixed(0) : ""}</span>
            </li>
          ))}
          {!bench.length && <li className="text-xs text-slate-400 py-2">Nobody left to seat.</li>}
        </ul>
        {sel?.kind === "seat" && <button type="button" onClick={removeSelected} className="btn-secondary w-full">Unseat {nameOf(getSeat(lineup, sel.seat))}</button>}
      </aside>
    </div>
  );
}

type SeatBtnProps = { lineup: Lineup; roster: Roster; isSel: (s: Seat) => boolean; rosterSelected: boolean; onClick: (s: Seat) => void };

function weightAt(lineup: Lineup, roster: Roster, row: number, side: "left" | "right"): string {
  const pid = lineup.seats[row]?.[side === "left" ? 0 : 1];
  const w = pid ? roster[pid]?.weight : null;
  return w ? w.toFixed(0) : "";
}

function SeatBtn({ seat, badge, lineup, roster, isSel, rosterSelected, onClick }: SeatBtnProps & { seat: Seat; badge: string }) {
  const pid = getSeat(lineup, seat);
  const p = pid ? roster[pid] : null;
  const name = pid ? p?.name ?? "(left team)" : null;
  const side = p?.sidePreference && p.sidePreference !== "either" ? p.sidePreference[0].toUpperCase() : null;
  return (
    <button type="button" onClick={() => onClick(seat)} title={p ? `${p.name} · ${p.weight || "?"} lb${side ? ` · prefers ${p.sidePreference}` : ""}` : undefined}
      className={`sheet-cell ${isSel(seat) ? "sheet-cell-sel" : ""} ${rosterSelected && !pid ? "sheet-cell-target" : ""}`}>
      <span className="sheet-badge">{badge}</span>
      {name && <span className="sheet-name">{name}</span>}
    </button>
  );
}
