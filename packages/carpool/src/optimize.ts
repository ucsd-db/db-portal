// Matrix-based optimization: seeds with the greedy `assignCarpool`, then runs a
// local-search improvement pass (move / swap passengers between cars) scoring
// routes with real drive time + distance from an OSRM `table` matrix instead of
// straight-line haversine. Falls back to a haversine estimate for any leg the
// matrix doesn't cover.

import { assignCarpool } from './assign'
import { haversineKm, locationKey } from './geo'
import type { AssignOptions, AssignResult, Car, Destination, LatLon, Rider } from './types'

/** GET /table/v1/driving/{lon,lat;...}?annotations=duration,distance */
export function buildOsrmTableUrl(points: LatLon[], base = 'https://router.project-osrm.org'): string {
  const coords = points.map(p => `${p.lon},${p.lat}`).join(';')
  return `${base.replace(/\/+$/, '')}/table/v1/driving/${coords}?annotations=duration,distance`
}

export type CostMatrix = {
  /** locationKey → row/col index */
  index: Map<string, number>
  /** minutes, [from][to] */
  durationMin: (number | null)[][]
  /** km, [from][to] */
  distanceKm: (number | null)[][]
}

export function parseOsrmTable(points: LatLon[], json: unknown): CostMatrix | null {
  if (!json || typeof json !== 'object') return null
  const data = json as { code?: unknown; durations?: unknown; distances?: unknown }
  if (data.code !== 'Ok' || !Array.isArray(data.durations) || !Array.isArray(data.distances)) return null
  const index = new Map<string, number>()
  points.forEach((p, i) => index.set(locationKey(p), i))
  const durationMin = (data.durations as (number | null)[][]).map(row =>
    row.map(v => (typeof v === 'number' ? v / 60 : null)),
  )
  const distanceKm = (data.distances as (number | null)[][]).map(row =>
    row.map(v => (typeof v === 'number' ? v / 1000 : null)),
  )
  return { index, durationMin, distanceKm }
}

export type OptimizeOptions = AssignOptions & {
  /** Cost per minute of drive time (default 1). */
  timeWeight?: number
  /** Cost per km of drive distance (default 1) — with timeWeight balances both. */
  distWeight?: number
  /** Cost per passenger-minute spent riding (default 0.5) — stops a long route
   *  from scooping up riders "on the way" at the riders' expense. */
  rideTimeWeight?: number
  /** Max improvement sweeps (default 30). */
  maxPasses?: number
}

const FALLBACK_KMH = 40 // haversine estimate when a leg is missing from the matrix

function leg(a: LatLon, b: LatLon, m: CostMatrix): { durMin: number; distKm: number } {
  const i = m.index.get(locationKey(a))
  const j = m.index.get(locationKey(b))
  if (i != null && j != null) {
    const dur = m.durationMin[i]?.[j]
    const dist = m.distanceKm[i]?.[j]
    if (dur != null && dist != null) return { durMin: dur, distKm: dist }
  }
  const km = haversineKm(a, b)
  return { durMin: (km / FALLBACK_KMH) * 60, distKm: km }
}

function permutations<T>(items: T[]): T[][] {
  if (items.length <= 1) return [items]
  const out: T[][] = []
  for (let i = 0; i < items.length; i++) {
    const rest = [...items.slice(0, i), ...items.slice(i + 1)]
    for (const p of permutations(rest)) out.push([items[i], ...p])
  }
  return out
}

/**
 * Cost of a car's route, trying every ordering of its distinct stops (≤ hard
 * stop cap, so at most a handful) and taking the cheapest. Cost = driver route
 * (time + distance) plus a per-passenger charge for minutes spent riding.
 * Returns the cost and passengerIds reordered to match the best stop order.
 */
function bestRoute(
  car: Car,
  riders: Record<string, Rider>,
  destination: Destination,
  m: CostMatrix,
  timeWeight: number,
  distWeight: number,
  rideTimeWeight: number,
  mode: 'pickup' | 'dropoff',
): { cost: number; passengerIds: string[] } {
  const home = riders[car.driverId]?.location
  if (!home) return { cost: 0, passengerIds: [...car.passengerIds] }

  // Bucket passengers by distinct stop.
  const stops = new Map<string, { loc: LatLon; ids: string[] }>()
  const unlocated: string[] = []
  for (const id of car.passengerIds) {
    const loc = riders[id]?.location
    if (!loc) { unlocated.push(id); continue }
    const key = locationKey(loc)
    const s = stops.get(key)
    if (s) s.ids.push(id)
    else stops.set(key, { loc, ids: [id] })
  }

  const stopList = [...stops.values()]
  if (stopList.length === 0) {
    const l = leg(home, destination, m)
    return {
      cost: l.durMin * timeWeight + l.distKm * distWeight,
      passengerIds: [...car.passengerIds],
    }
  }

  let best = Infinity
  let bestOrder = stopList
  for (const order of permutations(stopList)) {
    const points =
      mode === 'dropoff'
        ? [destination as LatLon, ...order.map(s => s.loc), home]
        : [home, ...order.map(s => s.loc), destination as LatLon]
    const legs = []
    for (let i = 0; i < points.length - 1; i++) legs.push(leg(points[i], points[i + 1], m))
    let cost = 0
    for (const l of legs) cost += l.durMin * timeWeight + l.distKm * distWeight
    // Passenger ride time: pickup — onboard from their stop to the destination;
    // dropoff — onboard from the destination until their stop.
    for (let s = 0; s < order.length; s++) {
      let onboard = 0
      if (mode === 'dropoff') for (let i = 0; i <= s; i++) onboard += legs[i].durMin
      else for (let i = s + 1; i < legs.length; i++) onboard += legs[i].durMin
      cost += onboard * order[s].ids.length * rideTimeWeight
    }
    if (cost < best) { best = cost; bestOrder = order }
  }
  return { cost: best, passengerIds: [...bestOrder.flatMap(s => s.ids), ...unlocated] }
}

/**
 * Greedy seed (assignCarpool) + local search: try moving each passenger to
 * another car and swapping passenger pairs between cars, accepting any change
 * that lowers total route cost while respecting capacity and the hard stop cap.
 */
export function optimizeCarpool(
  cars: Car[],
  riders: Record<string, Rider>,
  destination: Destination,
  matrix: CostMatrix,
  opts: OptimizeOptions = {},
): AssignResult {
  const mode = opts.mode ?? 'pickup'
  const timeWeight = opts.timeWeight ?? 1
  const distWeight = opts.distWeight ?? 1
  const rideTimeWeight = opts.rideTimeWeight ?? 0.5
  const hardStopCap = opts.hardStopCap ?? 3
  const maxPasses = opts.maxPasses ?? 30

  const seed = assignCarpool(cars, riders, destination, opts)
  const current = seed.cars.map(c => ({ ...c, passengerIds: [...c.passengerIds] }))

  const carCost = (car: Car) =>
    bestRoute(car, riders, destination, matrix, timeWeight, distWeight, rideTimeWeight, mode).cost
  const stopCount = (car: Car) => {
    const keys = new Set<string>()
    for (const id of car.passengerIds) {
      const loc = riders[id]?.location
      if (loc) keys.add(locationKey(loc))
    }
    return keys.size
  }
  const fits = (car: Car, extra: number) => car.passengerIds.length + extra <= car.capacity - 1
  const costs = current.map(carCost)

  const withPassengers = (car: Car, ids: string[]): Car => ({ ...car, passengerIds: ids })

  for (let pass = 0; pass < maxPasses; pass++) {
    let improved = false

    for (let a = 0; a < current.length; a++) {
      if (current[a].locked) continue
      for (const id of [...current[a].passengerIds]) {
        // Move `id` from car a to the best other car.
        for (let b = 0; b < current.length; b++) {
          if (b === a || current[b].locked || !fits(current[b], 1)) continue
          const candA = withPassengers(current[a], current[a].passengerIds.filter(x => x !== id))
          const candB = withPassengers(current[b], [...current[b].passengerIds, id])
          if (stopCount(candB) > hardStopCap) continue
          const newA = carCost(candA)
          const newB = carCost(candB)
          if (newA + newB < costs[a] + costs[b] - 1e-9) {
            current[a] = candA
            current[b] = candB
            costs[a] = newA
            costs[b] = newB
            improved = true
          }
        }
      }
    }

    // Swap pass: exchange one passenger between each pair of cars.
    for (let a = 0; a < current.length; a++) {
      if (current[a].locked) continue
      for (let b = a + 1; b < current.length; b++) {
        if (current[b].locked) continue
        for (const pa of [...current[a].passengerIds]) {
          for (const pb of [...current[b].passengerIds]) {
            const candA = withPassengers(current[a], current[a].passengerIds.map(x => (x === pa ? pb : x)))
            const candB = withPassengers(current[b], current[b].passengerIds.map(x => (x === pb ? pa : x)))
            if (stopCount(candA) > hardStopCap || stopCount(candB) > hardStopCap) continue
            const newA = carCost(candA)
            const newB = carCost(candB)
            if (newA + newB < costs[a] + costs[b] - 1e-9) {
              current[a] = candA
              current[b] = candB
              costs[a] = newA
              costs[b] = newB
              improved = true
            }
          }
        }
      }
    }

    if (!improved) break
  }

  // Final ordering: cheapest stop permutation per car.
  const ordered = current.map(car =>
    car.locked || car.passengerIds.length === 0
      ? car
      : withPassengers(
          car,
          bestRoute(car, riders, destination, matrix, timeWeight, distWeight, rideTimeWeight, mode).passengerIds,
        ),
  )
  return { cars: ordered, unassigned: seed.unassigned }
}
