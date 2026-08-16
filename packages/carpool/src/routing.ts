// URL builders and response parsers for OSRM (routing) and Nominatim (geocoding).
// No network calls happen here — callers do the fetch.

import type { Car, Destination, LatLon, Mode, Rider } from './types'

export const DEFAULT_OSRM_BASE = 'https://router.project-osrm.org'
export const DEFAULT_NOMINATIM_BASE = 'https://nominatim.openstreetmap.org'

/**
 * Points for routing a single car:
 *   pickup:  driver home → passenger stops (in order) → destination
 *   dropoff: destination → passenger stops (in order) → driver home
 * Passengers without a location are skipped. Returns [] if the driver has no location.
 */
export function carRoutePoints(
  car: Car,
  riders: Record<string, Rider>,
  destination: Destination,
  mode: Mode = 'pickup',
): LatLon[] {
  const home = riders[car.driverId]?.location
  if (!home) return []
  const stops: LatLon[] = []
  for (const id of car.passengerIds) {
    const loc = riders[id]?.location
    if (loc) stops.push({ lat: loc.lat, lon: loc.lon })
  }
  const dest: LatLon = { lat: destination.lat, lon: destination.lon }
  const origin: LatLon = { lat: home.lat, lon: home.lon }
  return mode === 'dropoff' ? [dest, ...stops, origin] : [origin, ...stops, dest]
}

/** GET /route/v1/driving/{lon,lat;lon,lat;...}?overview=full&geometries=geojson */
export function buildOsrmRouteUrl(points: LatLon[], base: string = DEFAULT_OSRM_BASE): string {
  const coords = points.map(p => `${p.lon},${p.lat}`).join(';')
  return `${base.replace(/\/+$/, '')}/route/v1/driving/${coords}?overview=full&geometries=geojson`
}

export type OsrmRoute = {
  distanceKm: number
  durationMin: number
  geometry: { type: 'LineString'; coordinates: [number, number][] }
}

export function parseOsrmRoute(json: unknown): OsrmRoute | null {
  if (!json || typeof json !== 'object') return null
  const data = json as { code?: unknown; routes?: unknown }
  if (data.code !== 'Ok' || !Array.isArray(data.routes) || data.routes.length === 0) return null
  const route = data.routes[0] as { distance?: unknown; duration?: unknown; geometry?: unknown }
  if (typeof route.distance !== 'number' || typeof route.duration !== 'number') return null
  const geometry = route.geometry as { type?: unknown; coordinates?: unknown } | undefined
  if (!geometry || geometry.type !== 'LineString' || !Array.isArray(geometry.coordinates)) return null
  return {
    distanceKm: route.distance / 1000,
    durationMin: route.duration / 60,
    geometry: { type: 'LineString', coordinates: geometry.coordinates as [number, number][] },
  }
}

/** GET /search?q=...&format=json&limit=1 */
export function buildNominatimSearchUrl(query: string, base: string = DEFAULT_NOMINATIM_BASE): string {
  return `${base.replace(/\/+$/, '')}/search?q=${encodeURIComponent(query)}&format=json&limit=1`
}

export function parseNominatimResult(json: unknown): LatLon | null {
  if (!Array.isArray(json) || json.length === 0) return null
  const first = json[0] as { lat?: unknown; lon?: unknown }
  const lat = parseFloat(String(first.lat))
  const lon = parseFloat(String(first.lon))
  if (Number.isNaN(lat) || Number.isNaN(lon)) return null
  return { lat, lon }
}
