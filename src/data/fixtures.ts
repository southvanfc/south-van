import type { FixturesData, LeagueZone } from "../types/types";
import data from "./fixtures.json" with { type: "json" };

/*
 * The fixtures data is stored as JSON rather than as a TypeScript module like
 * the other files in this folder. A scraper has to write it programmatically,
 * and JSON produces small clean diffs that are reviewable in a pull request.
 *
 * This module is the only place that touches the raw JSON. Import from here,
 * not from the .json file, so every consumer gets a typed module exactly like
 * `coaches-data.ts` and the storage format stays an implementation detail.
 *
 * The assertion is needed because TypeScript widens the string literals in a
 * JSON import (`competition` becomes `string`, not the `Competition` union).
 * `npm run validate:fixtures` checks the file against the real shape at build
 * time, so the assertion is backed by a runtime check rather than a hope.
 */
export const fixturesData = data as FixturesData;

/*
 * What each end of the league table means, for the standings zone bars and
 * their legend.
 *
 * Division 4 is the bottom tier of the VMSL, so there is no relegation zone
 * and none is listed. The table reads this list rather than testing positions
 * itself, so moving up a division is an edit here: widen the promotion band,
 * add a relegation entry, and the bars and the legend both follow.
 */
export const leagueZones: LeagueZone[] = [
  { from: 1, to: 1, colour: "var(--gold)", label: "Division champions" },
  { from: 2, to: 3, colour: "var(--promo)", label: "Promotion to Division 3" },
];
