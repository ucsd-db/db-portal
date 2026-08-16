import { paddlerById } from './lineup';
import { ROWS, type Lineup, type Roster } from './types';

export interface NamedLineup {
  name: string;
  lineup: Lineup;
}

/**
 * Tab-separated rows for one lineup (matches the original mastersheetStr):
 *   Drummer\t<name>\t
 *   Row\tLeft\tRight
 *   1\t<left>\t<right>  ...  10\t<left>\t<right>   (rows shown 1-based)
 *   Steer\t\t<name>
 */
export function lineupRows(lineup: Lineup, roster: Roster): string[] {
  const name = (id: string | null) => paddlerById(roster, id)?.name ?? '';
  const rows = [`Drummer\t${name(lineup.drummer)}\t`, 'Row\tLeft\tRight'];
  for (let i = 0; i < ROWS; i++) {
    const row = lineup.seats[i] ?? [null, null];
    rows.push(`${i + 1}\t${name(row[0] ?? null)}\t${name(row[1] ?? null)}`);
  }
  rows.push(`Steer\t\t${name(lineup.steer)}`);
  return rows;
}

/**
 * Lineups side by side, tab-separated (paste into a spreadsheet). First line is
 * the lineup names (each followed by 4 tabs), then one line per row with each
 * lineup's cells followed by 2 tabs — same shape as the original layout mastersheet.
 */
export function toMastersheet(lineups: NamedLineup[], roster: Roster): string {
  if (lineups.length === 0) return '';
  const blocks = lineups.map(({ lineup }) => lineupRows(lineup, roster));
  const title = lineups.map(({ name }) => `${name}\t\t\t\t`).join('');
  const lines = blocks[0]!.map((_, i) => blocks.map((b) => `${b[i]}\t\t`).join(''));
  return [title, ...lines].join('\n');
}
