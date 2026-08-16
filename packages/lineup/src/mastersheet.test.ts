import { describe, expect, it } from 'vitest';
import { emptyLineup, placePaddler } from './lineup';
import { lineupRows, toMastersheet } from './mastersheet';
import type { Roster } from './types';

const roster: Roster = {
  a: { id: 'a', name: 'Alice', weight: 60, gender: 'female' },
  b: { id: 'b', name: 'Bob', weight: 80, gender: 'male' },
  c: { id: 'c', name: 'Cara', weight: 65, gender: 'female' },
  d: { id: 'd', name: 'Dan', weight: 85, gender: 'male' },
};

describe('mastersheet', () => {
  let l = emptyLineup('open');
  l = placePaddler(l, { kind: 'drummer' }, 'a', roster).lineup;
  l = placePaddler(l, { kind: 'steer' }, 'b', roster).lineup;
  l = placePaddler(l, { kind: 'seat', row: 0, side: 'left' }, 'c', roster).lineup;
  l = placePaddler(l, { kind: 'seat', row: 9, side: 'right' }, 'd', roster).lineup;

  it('lineupRows matches the original row format', () => {
    const rows = lineupRows(l, roster);
    expect(rows).toHaveLength(13);
    expect(rows[0]).toBe('Drummer\tAlice\t');
    expect(rows[1]).toBe('Row\tLeft\tRight');
    expect(rows[2]).toBe('1\tCara\t');
    expect(rows[3]).toBe('2\t\t');
    expect(rows[11]).toBe('10\t\tDan');
    expect(rows[12]).toBe('Steer\t\tBob');
  });

  it('toMastersheet lays lineups side by side', () => {
    const text = toMastersheet(
      [
        { name: 'Heat 1', lineup: l },
        { name: 'Heat 2', lineup: emptyLineup('open') },
      ],
      roster,
    );
    const lines = text.split('\n');
    expect(lines).toHaveLength(14);
    expect(lines[0]).toBe('Heat 1\t\t\t\tHeat 2\t\t\t\t');
    expect(lines[1]).toBe('Drummer\tAlice\t\t\tDrummer\t\t\t\t');
    expect(lines[3]).toBe('1\tCara\t\t\t1\t\t\t\t');
    expect(lines[13]).toBe('Steer\t\tBob\t\tSteer\t\t\t\t');
    expect(toMastersheet([], roster)).toBe('');
  });
});
