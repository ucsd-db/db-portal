import { describe, expect, it } from 'vitest'
import { locationKey } from './geo'
import { buildOsrmTableUrl, optimizeCarpool, parseOsrmTable, type CostMatrix } from './optimize'
import type { Car, LatLon, Rider } from './types'

describe('buildOsrmTableUrl', () => {
  it('builds lon,lat pairs with duration+distance annotations', () => {
    const url = buildOsrmTableUrl([
      { lat: 32.8, lon: -117.2 },
      { lat: 32.9, lon: -117.1 },
    ])
    expect(url).toBe(
      'https://router.project-osrm.org/table/v1/driving/-117.2,32.8;-117.1,32.9?annotations=duration,distance',
    )
  })
})

describe('parseOsrmTable', () => {
  const points: LatLon[] = [
    { lat: 32.8, lon: -117.2 },
    { lat: 32.9, lon: -117.1 },
  ]

  it('converts seconds→minutes and metres→km, indexed by locationKey', () => {
    const m = parseOsrmTable(points, {
      code: 'Ok',
      durations: [[0, 600], [660, 0]],
      distances: [[0, 5000], [5500, 0]],
    })
    expect(m).not.toBeNull()
    expect(m!.index.get(locationKey(points[1]))).toBe(1)
    expect(m!.durationMin[0][1]).toBe(10)
    expect(m!.distanceKm[1][0]).toBe(5.5)
  })

  it('rejects error responses', () => {
    expect(parseOsrmTable(points, { code: 'InvalidQuery' })).toBeNull()
    expect(parseOsrmTable(points, null)).toBeNull()
  })
})

describe('optimizeCarpool', () => {
  // Two drivers on opposite sides of town, two riders each near one driver.
  // Haversine puts everyone equidistant-ish, but the matrix says crossing town
  // is expensive — optimize should keep riders with their nearby driver.
  const dest: LatLon = { lat: 33.0, lon: -117.0 }
  const north: LatLon = { lat: 32.9, lon: -117.0 }
  const nearNorth: LatLon = { lat: 32.89, lon: -117.2 } // off the south car's line
  const south: LatLon = { lat: 32.7, lon: -117.0 }
  const nearSouth: LatLon = { lat: 32.71, lon: -117.0 }

  const riders: Record<string, Rider> = {
    dN: { id: 'dN', name: 'North Driver', location: north },
    dS: { id: 'dS', name: 'South Driver', location: south },
    rN: { id: 'rN', name: 'North Rider', location: nearNorth },
    rS: { id: 'rS', name: 'South Rider', location: nearSouth },
  }
  const cars: Car[] = [
    { id: 'cN', driverId: 'dN', capacity: 4, passengerIds: [] },
    { id: 'cS', driverId: 'dS', capacity: 4, passengerIds: [] },
  ]

  function matrixFor(points: LatLon[], cross: number): CostMatrix {
    // Symmetric synthetic matrix: manhattan-ish cost, plus a huge penalty for
    // any leg crossing lat 32.8 (a "river" only the matrix knows about).
    const index = new Map(points.map((p, i) => [locationKey(p), i] as const))
    const durationMin = points.map(a =>
      points.map(b => {
        const base = (Math.abs(a.lat - b.lat) + Math.abs(a.lon - b.lon)) * 600
        const crosses = a.lat < 32.8 !== b.lat < 32.8
        return base + (crosses ? cross : 0)
      }),
    )
    const distanceKm = durationMin.map(row => row.map(v => v))
    return { index, durationMin, distanceKm }
  }

  it('keeps riders with their local driver when the matrix penalises crossing', () => {
    const points = [north, nearNorth, south, nearSouth, dest]
    const res = optimizeCarpool(cars, riders, dest, matrixFor(points, 500))
    const carN = res.cars.find(c => c.id === 'cN')!
    const carS = res.cars.find(c => c.id === 'cS')!
    expect(carN.passengerIds).toEqual(['rN'])
    expect(carS.passengerIds).toEqual(['rS'])
    expect(res.unassigned).toEqual([])
  })

  it('respects capacity and locked cars', () => {
    const tight: Car[] = [
      { id: 'cN', driverId: 'dN', capacity: 2, passengerIds: [] },
      { id: 'cS', driverId: 'dS', capacity: 4, passengerIds: ['rN'], locked: true },
    ]
    const points = [north, nearNorth, south, nearSouth, dest]
    const res = optimizeCarpool(tight, riders, dest, matrixFor(points, 500))
    const locked = res.cars.find(c => c.id === 'cS')!
    expect(locked.passengerIds).toEqual(['rN']) // untouched despite the penalty
    const carN = res.cars.find(c => c.id === 'cN')!
    expect(carN.passengerIds.length).toBeLessThanOrEqual(1)
  })

  it('falls back to haversine for points missing from the matrix', () => {
    const res = optimizeCarpool(cars, riders, dest, {
      index: new Map(),
      durationMin: [],
      distanceKm: [],
    })
    // Degrades to the greedy assignment without throwing.
    const all = res.cars.flatMap(c => c.passengerIds).concat(res.unassigned)
    expect(all.sort()).toEqual(['rN', 'rS'])
  })
})
