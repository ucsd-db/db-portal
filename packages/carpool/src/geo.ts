import type { LatLon } from './types'

const EARTH_RADIUS_KM = 6371

export function haversineKm(a: LatLon, b: LatLon): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLon = toRad(b.lon - a.lon)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const x =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x))
}

/** ~100m precision key so people at the "same" address bucket together. */
export function locationKey(p: LatLon): string {
  return `${p.lat.toFixed(3)},${p.lon.toFixed(3)}`
}
