// Fills remaining empty seats in cars with unassigned riders.
//   - Keeps existing passenger assignments intact
//   - Only assigns truly unassigned riders (with a location) to open seats
//   - Prefers cars under the stop cap (soft cap: 2 stops, hard cap: 3)
//   - Uses a combined cost: distance to driver home + penalty per existing stop
//   - Orders stops with nearest-neighbor routing
//
// Ported from the reference `optimizeCarpool` in optimize.js. One deliberate
// deviation: the original computed the stop penalty from `passengers.length`
// while every other part of the algorithm treated a "stop" as a distinct
// location bucket. Here the penalty uses the distinct-stop count, so a car
// carrying 3 riders from one address is penalised for 1 stop, not 3.

import { haversineKm, locationKey } from './geo'
import type { AssignOptions, AssignResult, Car, Destination, LatLon, Mode, Rider } from './types'

type Located = { id: string; location: LatLon }

function riderLocation(riders: Record<string, Rider>, id: string): LatLon | null {
  return riders[id]?.location ?? null
}

/**
 * Order a car's passengers by nearest-neighbor walk:
 *   pickup:  from the driver's home
 *   dropoff: from the destination
 * Passengers without a known location keep their relative order at the end.
 */
export function orderStops(
  car: Car,
  riders: Record<string, Rider>,
  destination: Destination,
  mode: Mode = 'pickup',
): Car {
  const located: Located[] = []
  const unlocated: string[] = []
  for (const id of car.passengerIds) {
    const loc = riderLocation(riders, id)
    if (loc) located.push({ id, location: loc })
    else unlocated.push(id)
  }

  const driverHome = riderLocation(riders, car.driverId)
  let current: LatLon | null = mode === 'dropoff' ? destination : driverHome
  if (!current || located.length === 0) return { ...car, passengerIds: [...car.passengerIds] }

  const ordered: string[] = []
  const remaining = [...located]
  while (remaining.length > 0) {
    let nearestIdx = 0
    let nearestDist = Infinity
    for (let i = 0; i < remaining.length; i++) {
      const d = haversineKm(current, remaining[i].location)
      if (d < nearestDist) {
        nearestDist = d
        nearestIdx = i
      }
    }
    const next = remaining.splice(nearestIdx, 1)[0]
    ordered.push(next.id)
    current = next.location
  }

  return { ...car, passengerIds: [...ordered, ...unlocated] }
}

export function assignCarpool(
  cars: Car[],
  riders: Record<string, Rider>,
  destination: Destination,
  opts: AssignOptions = {},
): AssignResult {
  const mode = opts.mode ?? 'pickup'
  const stopPenaltyKm = opts.stopPenaltyKm ?? 20
  const softStopCap = opts.softStopCap ?? 2
  const hardStopCap = opts.hardStopCap ?? 3

  // 1. Clone cars, preserving existing passenger assignments.
  const assigned: Car[] = cars.map(c => ({ ...c, passengerIds: [...c.passengerIds] }))

  // 2. Everyone who is already a driver or a passenger.
  const taken = new Set<string>()
  for (const car of assigned) {
    taken.add(car.driverId)
    for (const id of car.passengerIds) taken.add(id)
  }

  // 3. Bucket unassigned riders by location; riders without a location go straight to unassigned.
  const unassigned: string[] = []
  const buckets = new Map<string, Located[]>()
  for (const rider of Object.values(riders)) {
    if (taken.has(rider.id)) continue
    if (!rider.location) {
      unassigned.push(rider.id)
      continue
    }
    const key = locationKey(rider.location)
    const bucket = buckets.get(key)
    if (bucket) bucket.push({ id: rider.id, location: rider.location })
    else buckets.set(key, [{ id: rider.id, location: rider.location }])
  }

  // 4. Largest group first.
  const queue = [...buckets.values()].sort((a, b) => b.length - a.length)

  // 5. Helpers.
  const openSeats = (car: Car) => car.capacity - 1 - car.passengerIds.length

  const stopCount = (car: Car) => {
    const locs = new Set<string>()
    for (const id of car.passengerIds) {
      const loc = riderLocation(riders, id)
      if (loc) locs.add(locationKey(loc))
    }
    return locs.size
  }

  const cost = (car: Car, representative: LatLon): number | null => {
    const home = riderLocation(riders, car.driverId)
    if (!home) return null
    return haversineKm(representative, home) + stopCount(car) * stopPenaltyKm
  }

  const eligible = (car: Car, seatsNeeded: number, stopCeiling: number) =>
    !car.locked && openSeats(car) >= seatsNeeded && stopCount(car) + 1 <= stopCeiling

  function findBestCar(seatsNeeded: number, representative: LatLon, stopCeiling: number): Car | null {
    let bestCar: Car | null = null
    let bestCost = Infinity
    for (const car of assigned) {
      if (!eligible(car, seatsNeeded, stopCeiling)) continue
      const c = cost(car, representative)
      if (c !== null && c < bestCost) {
        bestCost = c
        bestCar = car
      }
    }
    return bestCar
  }

  // 6. Assign groups to cars.
  while (queue.length > 0) {
    const group = queue.shift()!
    const representative = group[0].location

    // Pass 1: whole group fits, under soft cap. Pass 2: relax to hard cap.
    const bestCar =
      findBestCar(group.length, representative, softStopCap) ??
      findBestCar(group.length, representative, hardStopCap)

    if (bestCar) {
      for (const p of group) bestCar.passengerIds.push(p.id)
      continue
    }

    // Pass 3: partial fill — take whatever fits in the cheapest car with any open seat, re-queue the rest.
    const partialCar =
      findBestCar(1, representative, softStopCap) ?? findBestCar(1, representative, hardStopCap)

    if (partialCar) {
      const open = openSeats(partialCar)
      for (const p of group.slice(0, open)) partialCar.passengerIds.push(p.id)
      const remainder = group.slice(open)
      if (remainder.length > 0) queue.push(remainder)
    } else {
      for (const p of group) unassigned.push(p.id)
    }
  }

  // 7. Order stops per car (locked cars are left as-is).
  const ordered = assigned.map(car =>
    car.locked || car.passengerIds.length === 0 ? car : orderStops(car, riders, destination, mode),
  )

  return { cars: ordered, unassigned }
}
