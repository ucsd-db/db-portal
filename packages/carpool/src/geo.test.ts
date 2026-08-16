import { describe, expect, it } from 'vitest'
import { haversineKm, locationKey } from './geo'

describe('haversineKm', () => {
  it('is zero for identical points', () => {
    expect(haversineKm({ lat: 1, lon: 2 }, { lat: 1, lon: 2 })).toBe(0)
  })

  it('computes roughly correct great-circle distance', () => {
    // Melbourne CBD -> Sydney CBD ~ 714 km
    const d = haversineKm({ lat: -37.8136, lon: 144.9631 }, { lat: -33.8688, lon: 151.2093 })
    expect(d).toBeGreaterThan(700)
    expect(d).toBeLessThan(730)
  })

  it('is symmetric', () => {
    const a = { lat: 10, lon: 20 }
    const b = { lat: 12, lon: 25 }
    expect(haversineKm(a, b)).toBeCloseTo(haversineKm(b, a))
  })
})

describe('locationKey', () => {
  it('rounds to 3 decimals so nearby points share a bucket', () => {
    expect(locationKey({ lat: 1.00012, lon: 2.00049 })).toBe(locationKey({ lat: 1.0004, lon: 2.0001 }))
    expect(locationKey({ lat: 1.0, lon: 2.0 })).not.toBe(locationKey({ lat: 1.01, lon: 2.0 }))
  })
})
