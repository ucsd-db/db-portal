import { describe, expect, it } from 'vitest';
import {
  emptyLineup,
  findPaddler,
  frontBackWeights,
  getSeat,
  lineupWarnings,
  placePaddler,
  removePaddler,
  seatedElsewhere,
  sideWeights,
  swapSeats,
} from './lineup';
import type { Paddler, Roster, Seat } from './types';

function makeRoster(people: Array<[string, number, Paddler['gender']]>): Roster {
  const roster: Roster = {};
  for (const [id, weight, gender] of people) roster[id] = { id, name: id.toUpperCase(), weight, gender };
  return roster;
}

const seat = (row: number, side: 'left' | 'right'): Seat => ({ kind: 'seat', row, side });

const roster = makeRoster([
  ['a', 80, 'male'],
  ['b', 70, 'female'],
  ['c', 90, 'male'],
  ['d', 60, 'female'],
  ['e', 75, 'other'],
]);

describe('placePaddler / removePaddler', () => {
  it('places and does not mutate the input', () => {
    const l0 = emptyLineup('open');
    const { lineup: l1, error } = placePaddler(l0, seat(0, 'left'), 'a', roster);
    expect(error).toBeUndefined();
    expect(getSeat(l1, seat(0, 'left'))).toBe('a');
    expect(getSeat(l0, seat(0, 'left'))).toBeNull();
    expect(l0.seats[0]).toEqual([null, null]);
  });

  it('places drummer and steer', () => {
    let l = emptyLineup('open');
    l = placePaddler(l, { kind: 'drummer' }, 'a', roster).lineup;
    l = placePaddler(l, { kind: 'steer' }, 'b', roster).lineup;
    expect(l.drummer).toBe('a');
    expect(l.steer).toBe('b');
    expect(findPaddler(l, 'b')).toEqual({ kind: 'steer' });
  });

  it('rejects duplicates in the same boat', () => {
    const l = placePaddler(emptyLineup('open'), seat(0, 'left'), 'a', roster).lineup;
    const r = placePaddler(l, seat(3, 'right'), 'a', roster);
    expect(r.error).toMatch(/already in this boat/);
    expect(r.lineup).toBe(l);
    const r2 = placePaddler(l, { kind: 'drummer' }, 'a', roster);
    expect(r2.error).toBeDefined();
  });

  it('rejects unknown paddlers and invalid seats', () => {
    expect(placePaddler(emptyLineup('open'), seat(0, 'left'), 'zzz', roster).error).toMatch(/Unknown/);
    expect(placePaddler(emptyLineup('open'), seat(10, 'left'), 'a', roster).error).toMatch(/Invalid seat/);
  });

  it('replaces the existing occupant of a seat', () => {
    let l = placePaddler(emptyLineup('open'), seat(0, 'left'), 'a', roster).lineup;
    l = placePaddler(l, seat(0, 'left'), 'b', roster).lineup;
    expect(getSeat(l, seat(0, 'left'))).toBe('b');
    expect(findPaddler(l, 'a')).toBeNull();
  });

  it('removes', () => {
    const l = placePaddler(emptyLineup('open'), seat(2, 'right'), 'a', roster).lineup;
    const l2 = removePaddler(l, seat(2, 'right'));
    expect(getSeat(l2, seat(2, 'right'))).toBeNull();
    expect(getSeat(l, seat(2, 'right'))).toBe('a');
  });
});

describe('womens boat', () => {
  it('rejects non-female paddlers in seats but allows them as drummer/steer', () => {
    const l = emptyLineup('womens');
    expect(placePaddler(l, seat(0, 'left'), 'a', roster).error).toMatch(/womens/);
    expect(placePaddler(l, seat(0, 'left'), 'e', roster).error).toMatch(/womens/);
    expect(placePaddler(l, seat(0, 'left'), 'b', roster).error).toBeUndefined();
    expect(placePaddler(l, { kind: 'drummer' }, 'a', roster).error).toBeUndefined();
    expect(placePaddler(l, { kind: 'steer' }, 'a', roster).error).toBeUndefined();
  });

  it('rejects swapping a male steer into a seat', () => {
    let l = placePaddler(emptyLineup('womens'), { kind: 'steer' }, 'a', roster).lineup;
    l = placePaddler(l, seat(0, 'left'), 'b', roster).lineup;
    expect(swapSeats(l, { kind: 'steer' }, seat(0, 'left'), roster).error).toMatch(/womens/);
  });
});

describe('mixed boat', () => {
  const big = makeRoster([
    ...Array.from({ length: 12 }, (_, i) => [`m${i}`, 80, 'male'] as [string, number, Paddler['gender']]),
    ...Array.from({ length: 12 }, (_, i) => [`f${i}`, 60, 'female'] as [string, number, Paddler['gender']]),
  ]);

  it('caps males and females at 10 in seats; drummer/steer exempt', () => {
    let l = emptyLineup('mixed');
    for (let i = 0; i < 10; i++) l = placePaddler(l, seat(i, 'left'), `m${i}`, big).lineup;
    for (let i = 0; i < 10; i++) l = placePaddler(l, seat(i, 'right'), `f${i}`, big).lineup;
    expect(l.seats.flat().every(Boolean)).toBe(true);

    // replacing a female seat with an 11th male is over the cap
    expect(placePaddler(l, seat(0, 'right'), 'm10', big).error).toMatch(/at most 10 men/);
    expect(placePaddler(l, seat(0, 'left'), 'f10', big).error).toMatch(/at most 10 women/);
    // but drummer/steer are exempt
    expect(placePaddler(l, { kind: 'drummer' }, 'm10', big).error).toBeUndefined();
    expect(placePaddler(l, { kind: 'steer' }, 'm11', big).error).toBeUndefined();
    // and replacing a male seat with a male is fine
    expect(placePaddler(l, seat(0, 'left'), 'm10', big).error).toBeUndefined();
  });
});

describe('swapSeats', () => {
  it('swaps two occupied seats and handles empties', () => {
    let l = placePaddler(emptyLineup('open'), seat(0, 'left'), 'a', roster).lineup;
    l = placePaddler(l, seat(5, 'right'), 'b', roster).lineup;
    const s = swapSeats(l, seat(0, 'left'), seat(5, 'right'), roster);
    expect(s.error).toBeUndefined();
    expect(getSeat(s.lineup, seat(0, 'left'))).toBe('b');
    expect(getSeat(s.lineup, seat(5, 'right'))).toBe('a');

    const moved = swapSeats(l, seat(0, 'left'), seat(9, 'left'), roster).lineup;
    expect(getSeat(moved, seat(0, 'left'))).toBeNull();
    expect(getSeat(moved, seat(9, 'left'))).toBe('a');

    const withDrummer = swapSeats(l, seat(0, 'left'), { kind: 'drummer' }, roster).lineup;
    expect(withDrummer.drummer).toBe('a');
    expect(getSeat(withDrummer, seat(0, 'left'))).toBeNull();
  });
});

describe('weights', () => {
  it('computes side and front/back weights, ignoring drummer and steer', () => {
    let l = emptyLineup('open');
    l = placePaddler(l, seat(0, 'left'), 'a', roster).lineup; // 80 front left
    l = placePaddler(l, seat(1, 'right'), 'b', roster).lineup; // 70 front right
    l = placePaddler(l, seat(9, 'right'), 'c', roster).lineup; // 90 back right
    l = placePaddler(l, { kind: 'drummer' }, 'd', roster).lineup;
    l = placePaddler(l, { kind: 'steer' }, 'e', roster).lineup;
    expect(sideWeights(l, roster)).toEqual({ left: 80, right: 160, diff: -80 });
    expect(frontBackWeights(l, roster)).toEqual({ front: 150, back: 90, diff: 60 });
  });
});

describe('lineupWarnings / soft placement', () => {
  it('returns no warnings for open boats', () => {
    let l = emptyLineup('open');
    l = placePaddler(l, seat(0, 'left'), 'a', roster).lineup;
    expect(lineupWarnings(l, roster)).toEqual([]);
  });

  it('warns for a male paddler on a womens boat (drummer/steer exempt)', () => {
    let l = emptyLineup('womens');
    l = placePaddler(l, seat(0, 'left'), 'a', roster, { soft: true }).lineup;
    l = placePaddler(l, { kind: 'drummer' }, 'c', roster).lineup;
    expect(lineupWarnings(l, roster)).toEqual(['A cannot paddle on a womens boat']);
  });

  it('warns when the mixed cap is exceeded', () => {
    const many = makeRoster(
      Array.from({ length: 11 }, (_, i) => [`m${i}`, 80, 'male'] as [string, number, 'male']),
    );
    let l = emptyLineup('mixed');
    for (let i = 0; i < 11; i++) {
      const res = placePaddler(l, seat(Math.floor(i / 2), i % 2 ? 'right' : 'left'), `m${i}`, many, { soft: true });
      expect(res.error).toBeUndefined();
      l = res.lineup;
    }
    expect(lineupWarnings(l, many)).toEqual(['Mixed boat allows at most 10 men']);
  });

  it('soft placement succeeds on gender violations but still rejects duplicates', () => {
    let l = emptyLineup('womens');
    const soft = placePaddler(l, seat(0, 'left'), 'a', roster, { soft: true });
    expect(soft.error).toBeUndefined();
    l = soft.lineup;
    const dup = placePaddler(l, seat(1, 'right'), 'a', roster, { soft: true });
    expect(dup.error).toBe('A is already in this boat');

    const hard = placePaddler(emptyLineup('womens'), seat(0, 'left'), 'a', roster);
    expect(hard.error).toBe('A cannot paddle on a womens boat');
  });

  it('soft swap succeeds where a strict swap would break gender rules', () => {
    let l = emptyLineup('womens');
    l = placePaddler(l, seat(0, 'left'), 'b', roster).lineup;
    l = placePaddler(l, { kind: 'drummer' }, 'a', roster).lineup;
    expect(swapSeats(l, seat(0, 'left'), { kind: 'drummer' }, roster).error).toBeDefined();
    const soft = swapSeats(l, seat(0, 'left'), { kind: 'drummer' }, roster, { soft: true });
    expect(soft.error).toBeUndefined();
    expect(getSeat(soft.lineup, seat(0, 'left'))).toBe('a');
  });
});

describe('seatedElsewhere', () => {
  it('maps paddlers to the sibling boats they occupy, deduped', () => {
    let a1 = emptyLineup('mixed');
    a1 = placePaddler(a1, seat(0, 'left'), 'a', roster).lineup;
    a1 = placePaddler(a1, seat(0, 'right'), 'b', roster).lineup;
    let a2 = emptyLineup('mixed');
    a2 = placePaddler(a2, seat(3, 'left'), 'a', roster).lineup;
    let bBoat = emptyLineup('mixed');
    bBoat = placePaddler(bBoat, seat(5, 'right'), 'b', roster).lineup;

    const map = seatedElsewhere([
      { name: 'Mixed A', lineup: a1 },
      { name: 'Mixed A', lineup: a2 },
      { name: 'Mixed B', lineup: bBoat },
    ]);
    expect(map.get('a')).toEqual(['Mixed A']);
    expect(map.get('b')).toEqual(['Mixed A', 'Mixed B']);
    expect(map.get('c')).toBeUndefined();
  });

  it('returns an empty map for no siblings', () => {
    expect(seatedElsewhere([]).size).toBe(0);
  });
});
