import { describe, expect, it } from 'vitest'
import { assignCarpool, orderStops } from './assign'
import type { Car, Destination, Rider } from './types'

// ~0.01 deg lat ≈ 1.1 km. Keep everything on lon 0 for easy reasoning.
const rider = (id: string, lat: number | null, lon = 0): Rider => ({
  id,
  name: id,
  location: lat === null ? null : { lat, lon },
})

const toRecord = (list: Rider[]): Record<string, Rider> =>
  Object.fromEntries(list.map(r => [r.id, r]))

const dest: Destination = { lat: 1, lon: 0, label: 'Venue' }

describe('assignCarpool', () => {
  it('respects capacity (total seats incl driver)', () => {
    const riders = toRecord([
      rider('d1', 0),
      rider('a', 0.001),
      rider('b', 0.002),
      rider('c', 0.003),
      rider('e', 0.004),
    ])
    const cars: Car[] = [{ id: 'car1', driverId: 'd1', capacity: 3, passengerIds: [] }]
    const { cars: out, unassigned } = assignCarpool(cars, riders, dest)
    expect(out[0].passengerIds).toHaveLength(2)
    expect(unassigned).toHaveLength(2)
    expect([...out[0].passengerIds, ...unassigned].sort()).toEqual(['a', 'b', 'c', 'e'])
  })

  it('preserves existing assignments and does not mutate input', () => {
    const riders = toRecord([rider('d1', 0), rider('far', 0.5), rider('near', 0.001)])
    const cars: Car[] = [{ id: 'car1', driverId: 'd1', capacity: 3, passengerIds: ['far'] }]
    const { cars: out } = assignCarpool(cars, riders, dest)
    expect(out[0].passengerIds).toContain('far')
    expect(out[0].passengerIds).toContain('near')
    expect(cars[0].passengerIds).toEqual(['far'])
  })

  it('does not assign a driver as a passenger', () => {
    const riders = toRecord([rider('d1', 0), rider('d2', 0.001), rider('x', 0.002)])
    const cars: Car[] = [
      { id: 'c1', driverId: 'd1', capacity: 4, passengerIds: [] },
      { id: 'c2', driverId: 'd2', capacity: 4, passengerIds: [] },
    ]
    const { cars: out, unassigned } = assignCarpool(cars, riders, dest)
    const all = out.flatMap(c => c.passengerIds)
    expect(all).not.toContain('d1')
    expect(all).not.toContain('d2')
    expect(all).toEqual(['x'])
    expect(unassigned).toEqual([])
  })

  it('puts clustered riders in the same car', () => {
    // Two drivers; three riders at the same address; each car has room for all three,
    // but the group should go together into one car (largest bucket first, whole-group fit).
    const riders = toRecord([
      rider('d1', 0),
      rider('d2', 0.3),
      rider('a', 0.1),
      rider('b', 0.1001),
      rider('c', 0.1002),
    ])
    const cars: Car[] = [
      { id: 'c1', driverId: 'd1', capacity: 4, passengerIds: [] },
      { id: 'c2', driverId: 'd2', capacity: 4, passengerIds: [] },
    ]
    const { cars: out } = assignCarpool(cars, riders, dest)
    const withGroup = out.filter(c => c.passengerIds.length > 0)
    expect(withGroup).toHaveLength(1)
    expect([...withGroup[0].passengerIds].sort()).toEqual(['a', 'b', 'c'])
  })

  it('splits a group across cars when no single car can take it (pass 3)', () => {
    const riders = toRecord([
      rider('d1', 0),
      rider('d2', 0.5),
      rider('a', 0.1),
      rider('b', 0.1),
      rider('c', 0.1),
    ])
    const cars: Car[] = [
      { id: 'c1', driverId: 'd1', capacity: 3, passengerIds: [] },
      { id: 'c2', driverId: 'd2', capacity: 2, passengerIds: [] },
    ]
    const { cars: out, unassigned } = assignCarpool(cars, riders, dest)
    expect(unassigned).toEqual([])
    expect(out.find(c => c.id === 'c1')!.passengerIds).toHaveLength(2)
    expect(out.find(c => c.id === 'c2')!.passengerIds).toHaveLength(1)
  })

  it('leaves riders without a location unassigned', () => {
    const riders = toRecord([rider('d1', 0), rider('noloc', null), rider('a', 0.01)])
    const cars: Car[] = [{ id: 'c1', driverId: 'd1', capacity: 4, passengerIds: [] }]
    const { cars: out, unassigned } = assignCarpool(cars, riders, dest)
    expect(unassigned).toEqual(['noloc'])
    expect(out[0].passengerIds).toEqual(['a'])
  })

  it('prefers the nearer driver, penalising cars that already have stops', () => {
    // Rider 'x' is 2 km from d1 and 5 km from d2. d1 already has one stop -> +20 km penalty,
    // so d2 (5 km, no stops) wins.
    const riders = toRecord([
      rider('d1', 0),
      rider('d2', 0.06),
      rider('existing', -0.2),
      rider('x', 0.018),
    ])
    const cars: Car[] = [
      { id: 'c1', driverId: 'd1', capacity: 4, passengerIds: ['existing'] },
      { id: 'c2', driverId: 'd2', capacity: 4, passengerIds: [] },
    ]
    const { cars: out } = assignCarpool(cars, riders, dest)
    expect(out.find(c => c.id === 'c2')!.passengerIds).toEqual(['x'])
  })

  it('counts distinct stops (not passengers) for the penalty', () => {
    // d1 has 2 passengers at the same address = 1 stop => 20 km penalty, still under
    // the soft cap. d1 is 1 km from x, d2 is 30 km from x. d1 (1+20=21) beats d2 (30).
    // Under the original passenger-count penalty d1 would cost 1+40=41 and lose.
    const riders = toRecord([
      rider('d1', 0),
      rider('d2', 0.28),
      rider('p1', -0.1),
      rider('p2', -0.1),
      rider('x', 0.009),
    ])
    const cars: Car[] = [
      { id: 'c1', driverId: 'd1', capacity: 5, passengerIds: ['p1', 'p2'] },
      { id: 'c2', driverId: 'd2', capacity: 5, passengerIds: [] },
    ]
    const { cars: out } = assignCarpool(cars, riders, dest)
    expect(out.find(c => c.id === 'c1')!.passengerIds).toContain('x')
  })

  it('never exceeds hardStopCap distinct stops when another car is available', () => {
    const riders = toRecord([
      rider('d1', 0),
      rider('d2', 0.9),
      rider('s1', 0.01),
      rider('s2', 0.02),
      rider('s3', 0.03),
      rider('x', 0.04),
    ])
    const cars: Car[] = [
      { id: 'c1', driverId: 'd1', capacity: 6, passengerIds: ['s1', 's2', 's3'] },
      { id: 'c2', driverId: 'd2', capacity: 6, passengerIds: [] },
    ]
    const { cars: out } = assignCarpool(cars, riders, dest)
    expect(out.find(c => c.id === 'c2')!.passengerIds).toEqual(['x'])
  })

  it('skips locked cars', () => {
    const riders = toRecord([rider('d1', 0), rider('x', 0.001)])
    const cars: Car[] = [{ id: 'c1', driverId: 'd1', capacity: 4, passengerIds: [], locked: true }]
    const { cars: out, unassigned } = assignCarpool(cars, riders, dest)
    expect(out[0].passengerIds).toEqual([])
    expect(unassigned).toEqual(['x'])
  })

  it('returns JSON-serializable plain data', () => {
    const riders = toRecord([rider('d1', 0), rider('x', 0.001)])
    const cars: Car[] = [{ id: 'c1', driverId: 'd1', capacity: 4, passengerIds: [] }]
    const result = assignCarpool(cars, riders, dest)
    expect(JSON.parse(JSON.stringify(result))).toEqual(result)
  })
})

describe('orderStops', () => {
  const riders = toRecord([
    rider('d1', 0),
    rider('far', 0.6),
    rider('mid', 0.3),
    rider('near', 0.1),
  ])
  const car: Car = { id: 'c1', driverId: 'd1', capacity: 5, passengerIds: ['far', 'near', 'mid'] }

  it('orders nearest-neighbor from the driver for pickup', () => {
    expect(orderStops(car, riders, dest, 'pickup').passengerIds).toEqual(['near', 'mid', 'far'])
  })

  it('orders nearest-neighbor from the destination for dropoff', () => {
    expect(orderStops(car, riders, dest, 'dropoff').passengerIds).toEqual(['far', 'mid', 'near'])
  })

  it('assignCarpool applies the ordering per mode', () => {
    const { cars: pickup } = assignCarpool([car], riders, dest, { mode: 'pickup' })
    const { cars: dropoff } = assignCarpool([car], riders, dest, { mode: 'dropoff' })
    expect(pickup[0].passengerIds).toEqual(['near', 'mid', 'far'])
    expect(dropoff[0].passengerIds).toEqual(['far', 'mid', 'near'])
  })

  it('keeps unlocated passengers at the end', () => {
    const r = { ...riders, ghost: rider('ghost', null) }
    const c = { ...car, passengerIds: ['ghost', 'far', 'near'] }
    expect(orderStops(c, r, dest, 'pickup').passengerIds).toEqual(['near', 'far', 'ghost'])
  })
})
