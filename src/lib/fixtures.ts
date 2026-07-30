import type { Club, FixturesData, Match, StandingsRow } from "../types/types";

/**
 * Pure helpers for the fixtures and results page.
 *
 * Every function here is a pure function of its arguments. No DOM, no fetch,
 * no module level mutable state, and no mutation of the arrays passed in.
 * That is what makes them safe to call from an Astro component during SSR and
 * from the validation script at build time.
 */

/** Slug of our own club in `fixtures.json`. */
export const OUR_SLUG = "south-van-fc";

/**
 * All kickoff times are Vancouver local. Comparing them by building a `Date`
 * with a hardcoded "-08:00" offset is wrong for roughly half the season, since
 * September, October and March fall in daylight time. Instead we compare
 * sortable "YYYY-MM-DD HH:MM" strings, which sidesteps offsets completely.
 */
const TIME_ZONE = "America/Vancouver";

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** Sortable "YYYY-MM-DD HH:MM" key for a match kickoff. */
function kickoffKey(match: Match): string {
  return `${match.date} ${match.time}`;
}

/** The same sortable key for a moment in time, in Vancouver local time. */
function momentKey(now: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);

  const part = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((p) => p.type === type)?.value ?? "00";

  // Some ICU builds render midnight as hour 24. Normalise so string compare holds.
  const hour = part("hour") === "24" ? "00" : part("hour");
  return `${part("year")}-${part("month")}-${part("day")} ${hour}:${part("minute")}`;
}

/** Statuses that mean the match is not going ahead on the date shown. */
const NOT_SCHEDULED = new Set(["postponed", "cancelled"]);

export function getClub(data: FixturesData, slug: string): Club | undefined {
  return data.clubs.find((club) => club.slug === slug);
}

/**
 * True when both scores are filled in. The type predicate lets callers read
 * `homeScore` and `awayScore` as numbers afterwards without a non-null
 * assertion, which is why it is written this way rather than returning a plain
 * boolean.
 */
export function isPlayed(
  match: Match,
): match is Match & { homeScore: number; awayScore: number } {
  return match.homeScore !== null && match.awayScore !== null;
}

/**
 * South Van's goals, regardless of venue. Reads `homeScore` when we are at
 * home and `awayScore` when we are away, which is the whole reason the stored
 * scores are home team first.
 */
export function ourScore(match: Match): number | null {
  if (!isPlayed(match)) return null;
  return match.isHome ? match.homeScore : match.awayScore;
}

/** The opponent's goals, regardless of venue. */
export function theirScore(match: Match): number | null {
  if (!isPlayed(match)) return null;
  return match.isHome ? match.awayScore : match.homeScore;
}

/**
 * Result from South Van's perspective. A cup tie won on penalties is a draw
 * here, because the 90 minute scoreline is a draw. The shootout goes in `note`.
 */
export function outcome(match: Match): "W" | "D" | "L" | null {
  if (!isPlayed(match)) return null;
  const us = match.isHome ? match.homeScore : match.awayScore;
  const them = match.isHome ? match.awayScore : match.homeScore;
  if (us > them) return "W";
  if (us < them) return "L";
  return "D";
}

/**
 * Earliest fixture still to be played at `now`. Postponed and cancelled
 * matches are skipped, since the date shown for them is no longer real.
 * Returns null once the season is over.
 */
export function nextMatch(data: FixturesData, now: Date): Match | null {
  const cutoff = momentKey(now);
  const upcoming = data.matches
    .filter((match) => !isPlayed(match))
    .filter((match) => match.status === undefined || !NOT_SCHEDULED.has(match.status))
    .filter((match) => kickoffKey(match) >= cutoff)
    .sort((a, b) => kickoffKey(a).localeCompare(kickoffKey(b)));

  return upcoming[0] ?? null;
}

/** Most recent played match at `now`, or null before the season starts. */
export function lastResult(data: FixturesData, now: Date): Match | null {
  const cutoff = momentKey(now);
  const played = data.matches
    .filter(isPlayed)
    .filter((match) => kickoffKey(match) <= cutoff)
    .sort((a, b) => kickoffKey(b).localeCompare(kickoffKey(a)));

  return played[0] ?? null;
}

export interface SeasonSummary {
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
}

/**
 * South Van's league record, derived from the match records rather than read
 * from a hardcoded figure, so it stays correct as results come in.
 *
 * League matches only. A league table counts league matches, so including cup
 * ties here would make this disagree with our `standings` row the moment a cup
 * tie is played, and that agreement is the integrity check the validator and
 * the tests both rely on.
 */
export function seasonSummary(data: FixturesData): SeasonSummary {
  const summary: SeasonSummary = {
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    points: 0,
  };

  for (const match of data.matches) {
    if (match.competition !== "league") continue;
    if (!isPlayed(match)) continue;

    const us = match.isHome ? match.homeScore : match.awayScore;
    const them = match.isHome ? match.awayScore : match.homeScore;

    summary.played += 1;
    summary.goalsFor += us;
    summary.goalsAgainst += them;
    if (us > them) summary.won += 1;
    else if (us < them) summary.lost += 1;
    else summary.drawn += 1;
  }

  summary.points = summary.won * 3 + summary.drawn;
  return summary;
}

export type StandingsEntry = StandingsRow & {
  position: number;
  goalDifference: number;
  points: number;
};

/**
 * The league table, sorted by points, then goal difference, then goals for.
 * Club slug breaks any remaining tie so the order is stable rather than
 * dependent on the order of the rows in the JSON. VMSL would use a head to
 * head record at that point, which we do not hold for other clubs.
 */
export function sortedStandings(data: FixturesData): StandingsEntry[] {
  return data.standings
    .map((row) => ({
      ...row,
      position: 0,
      goalDifference: row.goalsFor - row.goalsAgainst,
      points: row.won * 3 + row.drawn,
    }))
    .sort(
      (a, b) =>
        b.points - a.points ||
        b.goalDifference - a.goalDifference ||
        b.goalsFor - a.goalsFor ||
        a.clubSlug.localeCompare(b.clubSlug),
    )
    .map((row, index) => ({ ...row, position: index + 1 }));
}

/** 1 based league position, or null when the club is not in the table. */
export function positionOf(data: FixturesData, clubSlug: string): number | null {
  const entry = sortedStandings(data).find((row) => row.clubSlug === clubSlug);
  return entry ? entry.position : null;
}

export type HeadToHeadMeeting = Match & {
  us: number;
  them: number;
  result: "W" | "D" | "L";
};

export interface HeadToHead {
  meetings: HeadToHeadMeeting[];
  played: number;
  won: number;
  drawn: number;
  lost: number;
}

/**
 * Every played meeting with one opponent, this season and previous ones,
 * newest first and counted from South Van's perspective. Derived from the
 * match records, never from a stored tally.
 */
export function headToHead(data: FixturesData, opponentSlug: string): HeadToHead {
  const meetings = [...data.matches, ...data.history]
    .filter((match) => match.opponentSlug === opponentSlug)
    .filter(isPlayed)
    .sort((a, b) => kickoffKey(b).localeCompare(kickoffKey(a)))
    .map((match) => {
      const us = match.isHome ? match.homeScore : match.awayScore;
      const them = match.isHome ? match.awayScore : match.homeScore;
      const result: "W" | "D" | "L" = us > them ? "W" : us < them ? "L" : "D";
      return { ...match, us, them, result };
    });

  return {
    meetings,
    played: meetings.length,
    won: meetings.filter((m) => m.result === "W").length,
    drawn: meetings.filter((m) => m.result === "D").length,
    lost: meetings.filter((m) => m.result === "L").length,
  };
}

/**
 * Matches in one calendar month, chronological. `month` is 1 to 12, matching
 * the middle segment of the stored `YYYY-MM-DD` date rather than JavaScript's
 * 0 based month, so that reading the JSON and calling this agree.
 */
export function matchesInMonth(data: FixturesData, year: number, month: number): Match[] {
  const prefix = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-`;
  return data.matches
    .filter((match) => match.date.startsWith(prefix))
    .sort((a, b) => kickoffKey(a).localeCompare(kickoffKey(b)));
}

export interface MonthGroup {
  year: number;
  month: number;
  label: string;
  matches: Match[];
}

/**
 * Group matches into calendar months, oldest month first and chronological
 * within each month. `month` is 1 to 12 and `label` reads "November 2026".
 */
export function groupByMonth(matches: Match[]): MonthGroup[] {
  const groups = new Map<string, MonthGroup>();

  for (const match of [...matches].sort((a, b) =>
    kickoffKey(a).localeCompare(kickoffKey(b)),
  )) {
    const key = match.date.slice(0, 7);
    const year = Number(key.slice(0, 4));
    const month = Number(key.slice(5, 7));
    const existing = groups.get(key);

    if (existing) {
      existing.matches.push(match);
    } else {
      groups.set(key, {
        year,
        month,
        label: `${MONTH_NAMES[month - 1] ?? key} ${year}`,
        matches: [match],
      });
    }
  }

  return [...groups.values()].sort(
    (a, b) => a.year - b.year || a.month - b.month,
  );
}
