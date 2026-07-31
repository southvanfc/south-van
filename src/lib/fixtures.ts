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

const MONTH_SHORT = MONTH_NAMES.map((name) => name.slice(0, 3));

const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

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

/**
 * Vancouver's UTC offset in milliseconds at a given instant, worked out by
 * formatting the instant as Vancouver wall clock and reading that clock back
 * as if it were UTC. Positive in Vancouver's case would mean ahead of UTC, so
 * in practice this returns a negative number, -8h or -7h.
 */
function offsetAt(instant: number): number {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(instant));

  const part = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((p) => p.type === type)?.value ?? "0");

  const hour = part("hour") === 24 ? 0 : part("hour");
  const asIfUtc = Date.UTC(
    part("year"),
    part("month") - 1,
    part("day"),
    hour,
    part("minute"),
    part("second"),
  );

  return asIfUtc - instant;
}

/**
 * The actual moment a match kicks off, as an instant rather than a wall clock
 * reading. Needed for the countdown, which has to tick down to the same instant
 * for a visitor in Vancouver and one in Toronto.
 *
 * The stored date and time are Vancouver local, and Vancouver is on -08:00 for
 * some of the season and -07:00 for the rest, so the offset is resolved for the
 * day in question rather than hardcoded. The second pass matters on the two
 * days a year the clocks change: the first guess uses the offset in force at
 * the wrong side of the change, and re-resolving with that guess lands on the
 * right one.
 */
export function kickoffAt(match: Match): Date {
  const [year, month, day] = match.date.split("-").map(Number);
  const [hour, minute] = match.time.split(":").map(Number);
  const wallClock = Date.UTC(year, month - 1, day, hour, minute);

  let instant = wallClock - offsetAt(wallClock);
  instant = wallClock - offsetAt(instant);
  return new Date(instant);
}

/** Today's date in Vancouver, as "YYYY-MM-DD". */
export function localDate(now: Date): string {
  return momentKey(now).slice(0, 10);
}

/** "Sun 22 November", from a stored "YYYY-MM-DD" date. */
export function formatLongDate(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  const weekday = DAY_SHORT[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
  return `${weekday} ${day} ${MONTH_NAMES[month - 1]}`;
}

export interface DateParts {
  /** "Sun" */
  weekday: string;
  /** 1 to 31, unpadded */
  day: number;
  /** "Nov" */
  monthShort: string;
}

/**
 * A stored date split into the three pieces the fixture list's date rail
 * stacks vertically. Kept here rather than in the component so the weekday and
 * month tables have one home.
 */
export function dateParts(date: string): DateParts {
  const [year, month, day] = date.split("-").map(Number);
  return {
    weekday: DAY_SHORT[new Date(Date.UTC(year, month - 1, day)).getUTCDay()],
    day,
    monthShort: MONTH_SHORT[month - 1],
  };
}

/** "15 Feb 26", the compact form used in the head to head list. */
export function formatShortDate(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  return `${day} ${MONTH_SHORT[month - 1]} ${String(year).slice(2)}`;
}

/** 1 to "1st", 2 to "2nd", 11 to "11th". Used for league positions. */
export function ordinal(value: number): string {
  const lastTwo = Math.abs(value) % 100;
  const last = lastTwo % 10;
  if (lastTwo >= 11 && lastTwo <= 13) return `${value}th`;
  if (last === 1) return `${value}st`;
  if (last === 2) return `${value}nd`;
  if (last === 3) return `${value}rd`;
  return `${value}th`;
}

export interface CalendarMonth {
  year: number;
  /** 1 to 12, matching the stored date rather than JavaScript's 0 based month */
  month: number;
  /** e.g. "November 2026" */
  label: string;
}

/**
 * Every month from the first fixture to the last, with no gaps. Unlike
 * `groupByMonth`, months with no matches are included, because the calendar
 * navigates through them rather than skipping them. The ends of this list are
 * what the calendar arrows clamp to, so a visitor cannot page off into empty
 * months either side of the season.
 */
export function calendarRange(data: FixturesData): CalendarMonth[] {
  const keys = data.matches.map((match) => match.date.slice(0, 7)).sort();
  if (keys.length === 0) return [];

  const index = (key: string): number =>
    Number(key.slice(0, 4)) * 12 + Number(key.slice(5, 7)) - 1;

  const first = index(keys[0]);
  const last = index(keys[keys.length - 1]);
  const months: CalendarMonth[] = [];

  for (let i = first; i <= last; i += 1) {
    const year = Math.floor(i / 12);
    const month = (i % 12) + 1;
    months.push({ year, month, label: `${MONTH_NAMES[month - 1]} ${year}` });
  }

  return months;
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
