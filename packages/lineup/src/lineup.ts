import {
  ROWS,
  type BoatType,
  type Lineup,
  type LineupResult,
  type Paddler,
  type Roster,
  type Seat,
  type Side,
} from './types';

export const SIDES: readonly Side[] = ['left', 'right'];
const MIXED_CAP = 10;

export function paddlerById(roster: Roster, id: string | null | undefined): Paddler | undefined {
  return id == null ? undefined : roster[id];
}

export function emptyLineup(boatType: BoatType): Lineup {
  return {
    boatType,
    drummer: null,
    steer: null,
    seats: Array.from({ length: ROWS }, () => [null, null]),
  };
}

export function seatKey(seat: Seat): string {
  return seat.kind === 'seat' ? `${seat.kind}:${seat.row}:${seat.side}` : seat.kind;
}

export function isValidSeat(seat: Seat): boolean {
  return seat.kind !== 'seat' || (Number.isInteger(seat.row) && seat.row >= 0 && seat.row < ROWS);
}

export function getSeat(lineup: Lineup, seat: Seat): string | null {
  if (seat.kind === 'drummer') return lineup.drummer;
  if (seat.kind === 'steer') return lineup.steer;
  return lineup.seats[seat.row]?.[sideIndex(seat.side)] ?? null;
}

/** Returns a new lineup with `seat` set to `id` (no validation). */
export function setSeat(lineup: Lineup, seat: Seat, id: string | null): Lineup {
  if (seat.kind === 'drummer') return { ...lineup, drummer: id };
  if (seat.kind === 'steer') return { ...lineup, steer: id };
  const seats = lineup.seats.map((row) => [...row]);
  seats[seat.row]![sideIndex(seat.side)] = id;
  return { ...lineup, seats };
}

/** All 20 paddling seats, front to back, left before right. */
export function allSeats(): Seat[] {
  const out: Seat[] = [];
  for (let row = 0; row < ROWS; row++) {
    for (const side of SIDES) out.push({ kind: 'seat', row, side });
  }
  return out;
}

export function emptySeats(lineup: Lineup): Seat[] {
  return allSeats().filter((s) => getSeat(lineup, s) === null);
}

/** Every paddler id in the boat (drummer, steer and seats). */
export function lineupPaddlerIds(lineup: Lineup): string[] {
  const ids: string[] = [];
  if (lineup.drummer) ids.push(lineup.drummer);
  if (lineup.steer) ids.push(lineup.steer);
  for (const row of lineup.seats) for (const id of row) if (id) ids.push(id);
  return ids;
}

export function findPaddler(lineup: Lineup, paddlerId: string): Seat | null {
  if (lineup.drummer === paddlerId) return { kind: 'drummer' };
  if (lineup.steer === paddlerId) return { kind: 'steer' };
  for (let row = 0; row < ROWS; row++) {
    for (const side of SIDES) {
      if (lineup.seats[row]?.[sideIndex(side)] === paddlerId) return { kind: 'seat', row, side };
    }
  }
  return null;
}

/**
 * Validates the whole lineup against boat rules. Returns an error message or null.
 *
 * Rules (drummer and steer are exempt from gender rules on every boat type —
 * the original only exempted the drummer, we exempt both):
 *  - no paddler appears twice in the boat
 *  - every id must exist in the roster
 *  - mixed: at most 10 male and 10 female among the 20 paddling seats
 *  - womens: only female paddlers in the 20 paddling seats
 */
export function validateLineup(lineup: Lineup, roster: Roster): string | null {
  const seen = new Set<string>();
  for (const id of lineupPaddlerIds(lineup)) {
    if (!roster[id]) return `Unknown paddler "${id}"`;
    if (seen.has(id)) return `${roster[id].name} is already in this boat`;
    seen.add(id);
  }

  if (lineup.boatType === 'open') return null;

  let male = 0;
  let female = 0;
  for (const row of lineup.seats) {
    for (const id of row) {
      if (!id) continue;
      const p = roster[id]!;
      if (p.gender === 'male') male++;
      else if (p.gender === 'female') female++;
      if (lineup.boatType === 'womens' && p.gender !== 'female') {
        return `${p.name} cannot paddle on a womens boat`;
      }
    }
  }
  if (lineup.boatType === 'mixed') {
    if (male > MIXED_CAP) return `Mixed boat allows at most ${MIXED_CAP} men`;
    if (female > MIXED_CAP) return `Mixed boat allows at most ${MIXED_CAP} women`;
  }
  return null;
}

/**
 * Places `paddlerId` in `seat`, replacing whoever is there. Returns the original
 * lineup plus an `error` if the placement breaks a rule (duplicate, gender cap,
 * unknown paddler, invalid seat).
 */
export function placePaddler(lineup: Lineup, seat: Seat, paddlerId: string, roster: Roster): LineupResult {
  if (!isValidSeat(seat)) return { lineup, error: 'Invalid seat' };
  if (!roster[paddlerId]) return { lineup, error: `Unknown paddler "${paddlerId}"` };
  const next = setSeat(lineup, seat, paddlerId);
  const error = validateLineup(next, roster);
  return error ? { lineup, error } : { lineup: next };
}

export function removePaddler(lineup: Lineup, seat: Seat): Lineup {
  if (!isValidSeat(seat)) return lineup;
  return setSeat(lineup, seat, null);
}

/** Swaps the occupants of two seats (either may be empty). */
export function swapSeats(lineup: Lineup, a: Seat, b: Seat, roster: Roster): LineupResult {
  if (!isValidSeat(a) || !isValidSeat(b)) return { lineup, error: 'Invalid seat' };
  const idA = getSeat(lineup, a);
  const idB = getSeat(lineup, b);
  const next = setSeat(setSeat(lineup, a, idB), b, idA);
  const error = validateLineup(next, roster);
  return error ? { lineup, error } : { lineup: next };
}

export interface SideWeights {
  left: number;
  right: number;
  /** left - right */
  diff: number;
}

/** Total weight per side over the 20 paddling seats (drummer/steer excluded). */
export function sideWeights(lineup: Lineup, roster: Roster): SideWeights {
  let left = 0;
  let right = 0;
  for (const row of lineup.seats) {
    left += weightOf(roster, row[0]);
    right += weightOf(roster, row[1]);
  }
  return { left, right, diff: left - right };
}

export interface FrontBackWeights {
  front: number;
  back: number;
  /** front - back */
  diff: number;
}

/** Rows 0-4 vs rows 5-9 (drummer/steer excluded). */
export function frontBackWeights(lineup: Lineup, roster: Roster): FrontBackWeights {
  let front = 0;
  let back = 0;
  lineup.seats.forEach((row, i) => {
    const w = weightOf(roster, row[0]) + weightOf(roster, row[1]);
    if (i < ROWS / 2) front += w;
    else back += w;
  });
  return { front, back, diff: front - back };
}

function weightOf(roster: Roster, id: string | null | undefined): number {
  return paddlerById(roster, id)?.weight ?? 0;
}

function sideIndex(side: Side): 0 | 1 {
  return side === 'left' ? 0 : 1;
}
