import { describe, expect, it } from 'vitest'
import {
  buildNominatimSearchUrl,
  buildOsrmRouteUrl,
  carRoutePoints,
  parseNominatimResult,
  parseOsrmRoute,
} from './routing'
import type { Car, Rider } from './types'

const riders: Record<string, Rider> = {
  d1: { id: 'd1', name: 'Driver', location: { lat: -37.8, lon: 144.9 } },
  p1: { id: 'p1', name: 'P1', location: { lat: -37.7, lon: 144.8 } },
  p2: { id: 'p2', name: 'P2', location: { lat: -37.6, lon: 144.7 } },
  ghost: { id: 'ghost', name: 'Ghost', location: null },
}
const car: Car = { id: 'c1', driverId: 'd1', capacity: 4, passengerIds: ['p1', 'ghost', 'p2'] }
const dest = { lat: -37.5, lon: 144.6, label: 'Venue' }

describe('carRoutePoints', () => {
  it('pickup: driver -> stops -> destination, skipping unlocated', () => {
    expect(carRoutePoints(car, riders, dest, 'pickup')).toEqual([
      { lat: -37.8, lon: 144.9 },
      { lat: -37.7, lon: 144.8 },
      { lat: -37.6, lon: 144.7 },
      { lat: -37.5, lon: 144.6 },
    ])
  })

  it('dropoff: destination -> stops -> driver', () => {
    expect(carRoutePoints(car, riders, dest, 'dropoff')).toEqual([
      { lat: -37.5, lon: 144.6 },
      { lat: -37.7, lon: 144.8 },
      { lat: -37.6, lon: 144.7 },
      { lat: -37.8, lon: 144.9 },
    ])
  })

  it('returns [] when the driver has no location', () => {
    expect(carRoutePoints({ ...car, driverId: 'ghost' }, riders, dest)).toEqual([])
  })
})

describe('buildOsrmRouteUrl', () => {
  it('uses lon,lat order separated by ; with the expected query', () => {
    const url = buildOsrmRouteUrl([
      { lat: -37.8, lon: 144.9 },
      { lat: -37.5, lon: 144.6 },
    ])
    expect(url).toBe(
      'https://router.project-osrm.org/route/v1/driving/144.9,-37.8;144.6,-37.5?overview=full&geometries=geojson',
    )
  })

  it('accepts a custom base and strips trailing slash', () => {
    expect(buildOsrmRouteUrl([{ lat: 1, lon: 2 }], 'http://localhost:5001/')).toBe(
      'http://localhost:5001/route/v1/driving/2,1?overview=full&geometries=geojson',
    )
  })
})

describe('parseOsrmRoute', () => {
  it('parses a successful response', () => {
    const json = {
      code: 'Ok',
      routes: [
        {
          distance: 12345,
          duration: 900,
          geometry: { type: 'LineString', coordinates: [[144.9, -37.8], [144.6, -37.5]] },
        },
      ],
    }
    expect(parseOsrmRoute(json)).toEqual({
      distanceKm: 12.345,
      durationMin: 15,
      geometry: { type: 'LineString', coordinates: [[144.9, -37.8], [144.6, -37.5]] },
    })
  })

  it('returns null on error codes / malformed input', () => {
    expect(parseOsrmRoute({ code: 'NoRoute', routes: [] })).toBeNull()
    expect(parseOsrmRoute(null)).toBeNull()
    expect(parseOsrmRoute({ code: 'Ok', routes: [{}] })).toBeNull()
  })
})

describe('nominatim', () => {
  it('builds a search url with format=json&limit=1', () => {
    expect(buildNominatimSearchUrl('1 Main St, Melbourne')).toBe(
      'https://nominatim.openstreetmap.org/search?q=1%20Main%20St%2C%20Melbourne&format=json&limit=1',
    )
  })

  it('parses the first result into LatLon', () => {
    expect(parseNominatimResult([{ lat: '-37.81', lon: '144.96' }, { lat: '0', lon: '0' }])).toEqual({
      lat: -37.81,
      lon: 144.96,
    })
  })

  it('returns null for empty or malformed results', () => {
    expect(parseNominatimResult([])).toBeNull()
    expect(parseNominatimResult({})).toBeNull()
    expect(parseNominatimResult([{ lat: 'x', lon: 'y' }])).toBeNull()
  })
})
