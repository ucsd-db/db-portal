"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  autoFill, emptyLineup, frontBackWeights, getSeat, lineupPaddlerIds, placePaddler,
  removePaddler, seatKey, sideWeights, swapSeats, toMastersheet, ROWS,
  type BoatType, type Lineup, type Roster, type Seat,
} from "@db/lineup";
import { deleteLineup, saveLineup } from "./actions";

type Initial = { id: string; name: string; boatType: BoatType; published: boolean; data: Lineup } | null;
type Sel = { kind: "seat"; seat: Seat } | { kind: "roster"; id: string } | null;

export default function LineupBuilder({ roster, eventId, initial }: { roster: Roster; eventId: string | null; initial: Initial }) {
  const router = useRouter();
  const [id, setId] = useState(initial?.id ?? null);
  const [name, setName] = useState(initial?.name ?? "Boat 1");
  const [published, setPublished] = useState(initial?.published ?? false);
  const [lineup, setLineup] = useState<Lineup>(initial?.data && initial.data.seats ? initial.data : emptyLineup(initial?.boatType ?? "open"));
  const [sel, setSel] = useState<Sel>(null);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [pending, start] = useTransition();

  const seated = useMemo(() => new Set(lineupPaddlerIds(lineup)), [lineup]);
  const bench = useMemo(() =>
    Object.values(roster).filter((p) => !seated.has(p.id) && p.name.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => a.name.localeCompare(b.name)), [roster, seated, search]);
  const sw = sideWeights(lineup, roster);
  const fb = frontBackWeights(lineup, roster);
  const nameOf = (pid: string | null) => (pid ? roster[pid]?.name ?? "(left team)" : null);

  const apply = (r: { lineup: Lineup; error?: string }) => { setError(r.error ?? null); if (!r.error) setLineup(r.lineup); };

  const clickSeat = (seat: Seat) => {
    setMsg(null);
    if (!sel) { if (getSeat(lineup, seat)) setSel({ kind: "seat", seat }); return; }
    if (sel.kind === "roster") { apply(placePaddler(lineup, seat, sel.id, roster)); setSel(null); return; }
    if (seatKey(sel.seat) === seatKey(seat)) { setSel(null); return; }
    apply(swapSeats(lineup, sel.seat, seat, roster)); setSel(null);
  };
  const clickBench = (pid: string) => {
    setMsg(null);
    if (sel?.kind === "seat") { setLineup(removePaddler(lineup, sel.seat)); setSel(null); return; }
    setSel(sel?.kind === "roster" && sel.id === pid ? null : { kind: "roster", id: pid });
  };
  const removeSelected = () => { if (sel?.kind === "seat") { setLineup(removePaddler(lineup, sel.seat)); setSel(null); } };

  const changeBoatType = (bt: BoatType) => { setLineup({ ...emptyLineup(bt), drummer: lineup.drummer, steer: lineup.steer }); setSel(null); };
  const fill = () => { const r = autoFill(lineup, roster); setLineup(r.lineup); setMsg(r.unplaced.length ? `${r.unplaced.length} paddler(s) could not be placed` : null); };
  const clear = () => setLineup(emptyLineup(lineup.boatType));

  const save = (pub = published) => start(async () => {
    const r = await saveLineup({ id, eventId, name, boatType: lineup.boatType, data: lineup, published: pub });
    if ("error" in r && r.error) { setError(r.error); return; }
    if ("id" in r && r.id) { setId(r.id); setPublished(pub); setMsg(pub ? "Saved & published" : "Saved"); router.refresh(); }
  });
  const del = () => { if (id && confirm("Delete this lineup?")) start(async () => { await deleteLineup(id); router.push(`/admin/lineups${eventId ? `?event=${eventId}` : ""}`); }); };
  const copy = () => navigator.clipboard.writeText(toMastersheet([{ name, lineup }], roster)).then(() => setMsg("Copied mastersheet (paste into a spreadsheet)"));

  const isSel = (seat: Seat) => sel?.kind === "seat" && seatKey(sel.seat) === seatKey(seat);
  const seatProps = { lineup, roster, isSel, rosterSelected: sel?.kind === "roster", onClick: clickSeat };
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
      <div className="space-y-3">
        <div className="card flex flex-wrap items-center gap-2 text-sm">
          <input value={name} onChange={(e) => setName(e.target.value)} className="input w-40" />
          <select value={lineup.boatType} onChange={(e) => changeBoatType(e.target.value as BoatType)} className="input w-auto">
            <option value="open">Open</option><option value="mixed">Mixed</option><option value="womens">Women&apos;s</option>
          </select>
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
        <div className="card">
          <div className="mx-auto max-w-md space-y-1">
            <SeatBtn {...seatProps} seat={{ kind: "drummer" }} label="drummer" />
            <div className="grid grid-cols-[1fr_28px_1fr] gap-1 items-center">
              <div className="text-center text-xs text-slate-500">Left · {sw.left.toFixed(0)} kg</div><div />
              <div className="text-center text-xs text-slate-500">Right · {sw.right.toFixed(0)} kg</div>
              {Array.from({ length: ROWS }, (_, row) => (
                <RowCells key={row} row={row} {...seatProps} />
              ))}
            </div>
            <SeatBtn {...seatProps} seat={{ kind: "steer" }} label="steer" />
          </div>
          <div className="mt-3 flex flex-wrap justify-center gap-4 text-xs text-slate-600">
            <span>L−R: <b className={Math.abs(sw.diff) > 15 ? "text-red-600" : ""}>{sw.diff > 0 ? "+" : ""}{sw.diff.toFixed(0)} kg</b></span>
            <span>Front−Back: <b>{fb.diff > 0 ? "+" : ""}{fb.diff.toFixed(0)} kg</b></span>
            <span>Seated: {seated.size}/22</span>
          </div>
        </div>
      </div>
      <aside className="card space-y-2 self-start">
        <div className="flex items-baseline justify-between"><h3 className="font-semibold text-sm">Available ({bench.length})</h3>
          {eventId ? <span className="text-[11px] text-slate-500">yes/maybe RSVPs</span> : <span className="text-[11px] text-slate-500">whole team</span>}</div>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…" className="input py-1" />
        <p className="text-[11px] text-slate-500">Click a paddler, then a seat. Click two seats to swap. Select a seat then click here to unseat.</p>
        <ul className="max-h-[60vh] overflow-y-auto divide-y divide-slate-100 text-sm">
          {bench.map((p) => (
            <li key={p.id}>
              <button type="button" onClick={() => clickBench(p.id)}
                className={`w-full px-1 py-1.5 text-left flex justify-between rounded ${sel?.kind === "roster" && sel.id === p.id ? "bg-sky-100" : "hover:bg-slate-50"}`}>
                <span className="truncate">{p.name}</span>
                <span className="text-xs text-slate-500 shrink-0">{p.weight || "?"} kg{p.gender ? ` · ${p.gender[0].toUpperCase()}` : ""}{p.canSteer ? " · S" : ""}{p.canDrum ? " · D" : ""}</span>
              </button>
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

function SeatBtn({ seat, label, lineup, roster, isSel, rosterSelected, onClick }: SeatBtnProps & { seat: Seat; label?: string }) {
  const pid = getSeat(lineup, seat);
  const p = pid ? roster[pid] : null;
  const name = pid ? roster[pid]?.name ?? "(left team)" : null;
  return (
    <button type="button" onClick={() => onClick(seat)}
      className={`h-12 w-full rounded-md border px-1 text-xs leading-tight ${isSel(seat) ? "border-sky-600 bg-sky-100 ring-2 ring-sky-300" : pid ? "border-slate-300 bg-white hover:bg-slate-50" : "border-dashed border-slate-300 bg-slate-50 hover:bg-sky-50"} ${rosterSelected && !pid ? "border-sky-400" : ""}`}>
      {pid ? (<><div className="font-medium truncate">{name}</div><div className="text-slate-500">{p?.weight ?? "?"} kg{p?.sidePreference && p.sidePreference !== "either" ? ` · ${p.sidePreference[0].toUpperCase()}` : ""}</div></>)
        : <span className="text-slate-400">{label ?? "empty"}</span>}
    </button>
  );
}

function RowCells({ row, ...seatProps }: SeatBtnProps & { row: number }) {
  return (
    <>
      <SeatBtn {...seatProps} seat={{ kind: "seat", row, side: "left" }} />
      <div className="text-center text-xs text-slate-400">{row + 1}</div>
      <SeatBtn {...seatProps} seat={{ kind: "seat", row, side: "right" }} />
    </>
  );
}
