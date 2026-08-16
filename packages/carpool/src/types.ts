export type LatLon = { lat: number; lon: number }

export type Rider = {
  id: string
  name: string
  location: LatLon | null
}

export type Car = {
  id: string
  driverId: string
  /** Total seats including the driver. */
  capacity: number
  passengerIds: string[]
  locked?: boolean
}

export type Destination = LatLon & { label?: string }

export type Mode = 'pickup' | 'dropoff'

export type AssignOptions = {
  mode?: Mode
  /** km-equivalent cost added per distinct stop already on a car. */
  stopPenaltyKm?: number
  /** Try not to exceed this many distinct stops per car. */
  softStopCap?: number
  /** Never exceed this many distinct stops per car. */
  hardStopCap?: number
}

export type AssignResult = {
  cars: Car[]
  unassigned: string[]
}
