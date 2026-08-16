"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import dynamic from "next/dynamic";
import { assignCarpool, buildOsrmRouteUrl, carRoutePoints, parseOsrmRoute, type Car, type Destination, type Mode, type OsrmRoute, type Rider } from "@db/carpool";
import { saveCarpool } from "./actions";

const RouteMap = dynamic(() => import("@/components/route-map"), { ssr: false });

export type SavedCarpool = { data: { cars: Car[]; mode: Mode }; published: boolean };
const COLORS = ["#2563eb", "#dc2626", "#16a34a", "#d97706", "#7c3aed", "#db2777", "#0891b2", "#65a30d"];

export default function CarpoolBuilder({ eventId, destination, riders, drivers, needsRide, saved }: {
  eventId: string; destination: Destination; riders: Record<string, Rider>; drivers: { id: string; seats: number }[]; needsRide: string[]; saved: SavedCarpool | null;
}) {
  const initialCars = useMemo<Car[]>(() => {
    // Start from saved cars, but drop drivers who no longer RSVP'd as drivers and add new ones.
    const byId = new Map((saved?.data.cars ?? []).map((c) => [c.driverId, c]));
    return drivers.map((d) => byId.get(d.id) ?? { id: d.id, driverId: d.id, capacity: d.seats, passengerIds: [] })
      .map((c) => ({ ...c, passengerIds: c.passengerIds.filter((p) => riders[p]) }));
  }, [drivers, saved, riders]);

  const [cars, setCars] = useState<Car[]>(initialCars);
  const [mode, setMode] = useState<Mode>(saved?.data.mode ?? "pickup");
  const [onlyNeedsRide, setOnlyNeedsRide] = useState(true);
  const [routes, setRoutes] = useState<Record<string, OsrmRoute | null>>({});
  const [msg, setMsg] = useState<string | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const driverIds = useMemo(() => new Set(cars.map((c) => c.driverId)), [cars]);
  const seated = useMemo(() => new Set(cars.flatMap((c) => c.passengerIds)), [cars]);
  const pool = useMemo(() => Object.values(riders).filter((r) => !driverIds.has(r.id) && !seated.has(r.id) && (!onlyNeedsRide || needsRide.includes(r.id))), [riders, driverIds, seated, onlyNeedsRide, needsRide]);

  const optimize = () => {
    const eligible: Record<string, Rider> = {};
    for (const r of pool) eligible[r.id] = r;
    for (const c of cars) for (const p of c.passengerIds) eligible[p] = riders[p]; // keep manual placements
    const res = assignCarpool(cars, eligible, destination, { mode });
    setCars(res.cars);
    setMsg(res.unassigned.length ? `${res.unassigned.length} rider(s) unassigned (no address or cars full)` : "Assigned");
  };

  // Fetch real road routes from public OSRM (demo server; fair-use — one request per car).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const next: Record<string, OsrmRoute | null> = {};
      for (const c of cars) {
        const pts = carRoutePoints(c, riders, destination, mode);
        if (pts.length < 2) { next[c.id] = null; continue; }
        try { const r = await fetch(buildOsrmRouteUrl(pts)); next[c.id] = parseOsrmRoute(await r.json()); }
        catch { next[c.id] = null; }
      }
      if (!cancelled) setRoutes(next);
    })();
    return () => { cancelled = true; };
  }, [cars, mode, riders, destination]);

  const clickPool = (rid: string) => setSel(sel === rid ? null : rid);
  const clickCar = (carId: string) => {
    if (!sel) return;
    setCars((cs) => cs.map((c) => {
      const without = { ...c, passengerIds: c.passengerIds.filter((p) => p !== sel) };
      if (c.id !== carId) return without;
      if (without.passengerIds.length >= c.capacity - 1) { setMsg("Car is full"); return without; }
      return { ...without, passengerIds: [...without.passengerIds, sel] };
    }));
    setSel(null);
  };
  const unseat = (rid: string) => setCars((cs) => cs.map((c) => ({ ...c, passengerIds: c.passengerIds.filter((p) => p !== rid) })));
  const toggleLock = (carId: string) => setCars((cs) => cs.map((c) => (c.id === carId ? { ...c, locked: !c.locked } : c)));
  const setCap = (carId: string, cap: number) => setCars((cs) => cs.map((c) => (c.id === carId ? { ...c, capacity: Math.max(1, cap) } : c)));

  const save = (published: boolean) => start(async () => {
    const r = await saveCarpool(eventId, { cars, mode }, published);
    setMsg("error" in r && r.error ? r.error : published ? "Saved & published to members" : "Saved draft");
  });

  const mapCars = cars.map((c, i) => ({ id: c.id, color: COLORS[i % COLORS.length], points: carRoutePoints(c, riders, destination, mode), route: routes[c.id] ?? null, label: riders[c.driverId]?.name ?? "?" }));

  return (
    <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
      <div className="space-y-3">
        <div className="card flex flex-wrap gap-2 text-sm">
          <select value={mode} onChange={(e) => setMode(e.target.value as Mode)} className="input w-auto py-1"><option value="pickup">Pickup → event</option><option value="dropoff">Event → dropoff</option></select>
          <button type="button" onClick={optimize} className="btn-primary py-1">Optimize</button>
          <button type="button" onClick={() => save(false)} disabled={pending} className="btn-secondary py-1">Save</button>
          <button type="button" onClick={() => save(true)} disabled={pending} className="btn-secondary py-1">Publish</button>
          <label className="flex items-center gap-1 text-xs w-full"><input type="checkbox" checked={onlyNeedsRide} onChange={(e) => setOnlyNeedsRide(e.target.checked)} /> Only people who asked for a ride</label>
        </div>
        {msg && <p className="text-sm text-slate-600">{msg}</p>}
        <div className="card">
          <h3 className="text-sm font-semibold mb-1">Needs a seat ({pool.length})</h3>
          <p className="text-[11px] text-slate-500 mb-2">Click a person, then a car.</p>
          <ul className="text-sm divide-y divide-slate-100 max-h-60 overflow-y-auto">
            {pool.map((r) => (
              <li key={r.id}><button type="button" onClick={() => clickPool(r.id)} className={`w-full text-left px-1 py-1 rounded flex justify-between ${sel === r.id ? "bg-sky-100" : "hover:bg-slate-50"}`}>
                <span>{r.name}</span>{!r.location && <span className="text-xs text-amber-600">no address</span>}</button></li>
            ))}
            {!pool.length && <li className="text-xs text-slate-400 py-1">Everyone is placed.</li>}
          </ul>
        </div>
        <div className="space-y-2">
          {cars.map((c, i) => {
            const rt = routes[c.id];
            return (
              <div key={c.id} onClick={() => clickCar(c.id)} className={`card p-3 text-sm cursor-pointer ${sel ? "hover:border-sky-400" : ""}`} style={{ borderLeft: `4px solid ${COLORS[i % COLORS.length]}` }}>
                <div className="flex justify-between items-center gap-2">
                  <div className="font-medium">🚗 {riders[c.driverId]?.name}{!riders[c.driverId]?.location && <span className="text-xs text-amber-600 ml-1">(no address)</span>}</div>
                  <div className="flex items-center gap-2 text-xs">
                    <label onClick={(e) => e.stopPropagation()}>cap <input type="number" min={1} max={15} value={c.capacity} onChange={(e) => setCap(c.id, Number(e.target.value))} className="input w-14 py-0.5 inline" /></label>
                    <button type="button" onClick={(e) => { e.stopPropagation(); toggleLock(c.id); }} title="Lock: optimizer won't change this car">{c.locked ? "🔒" : "🔓"}</button>
                  </div>
                </div>
                <div className="text-xs text-slate-500">{c.passengerIds.length}/{c.capacity - 1} seats{rt && ` · ${Math.round(rt.durationMin)} min · ${(rt.distanceKm * 0.621371).toFixed(1)} mi`}</div>
                <ol className="mt-1 text-xs list-decimal ml-4">
                  {c.passengerIds.map((p) => (
                    <li key={p} className="flex justify-between"><span>{riders[p]?.name ?? "?"}</span>
                      <button type="button" onClick={(e) => { e.stopPropagation(); unseat(p); }} className="text-slate-400 hover:text-red-600">✕</button></li>
                  ))}
                </ol>
              </div>
            );
          })}
          {!cars.length && <p className="card text-sm text-slate-500">No drivers yet — drivers come from RSVPs marked &quot;I can drive others&quot;.</p>}
        </div>
      </div>
      <div className="card p-0 overflow-hidden min-h-[520px]">
        <RouteMap destination={destination} cars={mapCars} />
      </div>
    </div>
  );
}
