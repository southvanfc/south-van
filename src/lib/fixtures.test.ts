import { describe, expect, it } from "vitest";
import type { FixturesData, Match, StandingsRow } from "../types/types";
import { fixturesData } from "../data/fixtures";
import {
  OUR_SLUG,
  calendarRange,
  formatLongDate,
  formatShortDate,
  groupByMonth,
  isAwaitingResult,
  isoKickoff,
  kickoffAt,
  localDate,
  ordinal,
  headToHead,
  isPlayed,
  lastResult,
  matchesInMonth,
  nextMatch,
  outcome,
  ourScore,
  positionOf,
  seasonSummary,
  sortedStandings,
  theirScore,
  upcomingMatches,
} from "./fixtures";

/** Minimal match, overridden per test. Scores are HOME team first. */
function match(overrides: Partial<Match> = {}): Match {
  return {
    id: "test-1",
    date: "2026-09-13",
    time: "14:00",
    opponentSlug: "cmfsc-caproni",
    isHome: true,
    venue: "Memorial South Park",
    competition: "league",
    competitionLabel: "VMSL Division 4A",
    homeScore: null,
    awayScore: null,
    ...overrides,
  };
}

function standingsRow(overrides: Partial<StandingsRow> = {}): StandingsRow {
  return {
    clubSlug: "a-fc",
    played: 9,
    won: 0,
    drawn: 0,
    lost: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    form: "",
    ...overrides,
  };
}

function dataWith(overrides: Partial<FixturesData> = {}): FixturesData {
  return {
    season: "2026-27",
    division: "VMSL Division 4A",
    updatedAt: "2026-11-16T08:30:00-08:00",
    clubs: [],
    matches: [],
    standings: [],
    history: [],
    ...overrides,
  };
}

/*
 * The away cases below are the important ones. An earlier prototype stored
 * away scores South Van first, which silently turned two defeats into wins.
 * These tests fail loudly if that ever comes back.
 */
describe("ourScore, theirScore and outcome", () => {
  it("reads a home win", () => {
    const m = match({ isHome: true, homeScore: 2, awayScore: 1 });
    expect(ourScore(m)).toBe(2);
    expect(theirScore(m)).toBe(1);
    expect(outcome(m)).toBe("W");
  });

  it("reads a home defeat", () => {
    const m = match({ isHome: true, homeScore: 0, awayScore: 2 });
    expect(ourScore(m)).toBe(0);
    expect(theirScore(m)).toBe(2);
    expect(outcome(m)).toBe("L");
  });

  it("reads an away win, where our goals are the AWAY score", () => {
    // We won 3-1 away. Stored home team first: opponent 1, us 3.
    const m = match({ isHome: false, homeScore: 1, awayScore: 3 });
    expect(ourScore(m)).toBe(3);
    expect(theirScore(m)).toBe(1);
    expect(outcome(m)).toBe("W");
  });

  it("reads an away defeat, where our goals are the AWAY score", () => {
    // We lost 3-2 away. Stored home team first: opponent 3, us 2.
    // Stored the other way round this would read as a win.
    const m = match({ isHome: false, homeScore: 3, awayScore: 2 });
    expect(ourScore(m)).toBe(2);
    expect(theirScore(m)).toBe(3);
    expect(outcome(m)).toBe("L");
  });

  it("reads a draw", () => {
    const m = match({ isHome: false, homeScore: 1, awayScore: 1 });
    expect(ourScore(m)).toBe(1);
    expect(theirScore(m)).toBe(1);
    expect(outcome(m)).toBe("D");
  });

  it("returns null for an unplayed match", () => {
    const m = match();
    expect(isPlayed(m)).toBe(false);
    expect(ourScore(m)).toBeNull();
    expect(theirScore(m)).toBeNull();
    expect(outcome(m)).toBeNull();
  });

  it("treats a half filled scoreline as unplayed rather than guessing", () => {
    expect(isPlayed(match({ homeScore: 2, awayScore: null }))).toBe(false);
    expect(outcome(match({ homeScore: 2, awayScore: null }))).toBeNull();
  });

  it("counts a cup tie won on penalties as a draw, since the 90 minutes was drawn", () => {
    const m = match({
      isHome: false,
      competition: "cup",
      homeScore: 2,
      awayScore: 2,
      note: "Drawn 2-2 after 90 minutes. South Van FC won 5-4 on penalties.",
    });
    expect(outcome(m)).toBe("D");
  });
});

describe("seasonSummary on the seed data", () => {
  it("agrees exactly with South Van's standings row", () => {
    const summary = seasonSummary(fixturesData);
    const row = fixturesData.standings.find((r) => r.clubSlug === OUR_SLUG);

    expect(row).toBeDefined();
    expect(summary).toEqual({
      played: row?.played,
      won: row?.won,
      drawn: row?.drawn,
      lost: row?.lost,
      goalsFor: row?.goalsFor,
      goalsAgainst: row?.goalsAgainst,
      points: (row?.won ?? 0) * 3 + (row?.drawn ?? 0),
    });
  });

  it("adds up the way the table says", () => {
    const summary = seasonSummary(fixturesData);
    expect(summary.won + summary.drawn + summary.lost).toBe(summary.played);
    expect(summary.points).toBe(summary.won * 3 + summary.drawn);
  });

  it("ignores cup ties, so it still matches the league table once one is played", () => {
    const data = dataWith({
      matches: [
        match({ id: "1", competition: "league", isHome: true, homeScore: 2, awayScore: 1 }),
        match({ id: "2", competition: "cup", isHome: true, homeScore: 5, awayScore: 0 }),
      ],
    });
    const summary = seasonSummary(data);
    expect(summary.played).toBe(1);
    expect(summary.goalsFor).toBe(2);
  });

  it("derives from match records rather than the standings row", () => {
    const data = dataWith({
      matches: [match({ id: "1", isHome: false, homeScore: 0, awayScore: 4 })],
      standings: [standingsRow({ clubSlug: OUR_SLUG, won: 99, goalsFor: 99 })],
    });
    expect(seasonSummary(data)).toEqual({
      played: 1,
      won: 1,
      drawn: 0,
      lost: 0,
      goalsFor: 4,
      goalsAgainst: 0,
      points: 3,
    });
  });
});

describe("sortedStandings", () => {
  it("sorts by points first", () => {
    const data = dataWith({
      standings: [
        standingsRow({ clubSlug: "low", won: 1, drawn: 0, lost: 8 }),
        standingsRow({ clubSlug: "high", won: 7, drawn: 1, lost: 1 }),
        standingsRow({ clubSlug: "mid", won: 4, drawn: 2, lost: 3 }),
      ],
    });
    expect(sortedStandings(data).map((r) => r.clubSlug)).toEqual(["high", "mid", "low"]);
  });

  it("breaks a points tie on goal difference", () => {
    // Both on 15 points. "better-gd" is +10, "worse-gd" is +2.
    const data = dataWith({
      standings: [
        standingsRow({ clubSlug: "worse-gd", won: 5, goalsFor: 12, goalsAgainst: 10 }),
        standingsRow({ clubSlug: "better-gd", won: 5, goalsFor: 18, goalsAgainst: 8 }),
      ],
    });
    const sorted = sortedStandings(data);
    expect(sorted.map((r) => r.clubSlug)).toEqual(["better-gd", "worse-gd"]);
    expect(sorted[0]?.goalDifference).toBe(10);
    expect(sorted[0]?.points).toBe(15);
  });

  it("breaks a goal difference tie on goals for", () => {
    // Both on 15 points and +5 goal difference.
    const data = dataWith({
      standings: [
        standingsRow({ clubSlug: "fewer-gf", won: 5, goalsFor: 10, goalsAgainst: 5 }),
        standingsRow({ clubSlug: "more-gf", won: 5, goalsFor: 20, goalsAgainst: 15 }),
      ],
    });
    expect(sortedStandings(data).map((r) => r.clubSlug)).toEqual(["more-gf", "fewer-gf"]);
  });

  it("numbers positions from 1 and does not mutate the input", () => {
    const data = dataWith({
      standings: [
        standingsRow({ clubSlug: "second", won: 1 }),
        standingsRow({ clubSlug: "first", won: 5 }),
      ],
    });
    const before = data.standings.map((r) => r.clubSlug);
    expect(sortedStandings(data).map((r) => r.position)).toEqual([1, 2]);
    expect(data.standings.map((r) => r.clubSlug)).toEqual(before);
  });

  it("finds a club's position via positionOf, and null when it is not in the table", () => {
    const data = dataWith({
      standings: [
        standingsRow({ clubSlug: "leader", won: 8 }),
        standingsRow({ clubSlug: OUR_SLUG, won: 4, drawn: 2, lost: 2 }),
        standingsRow({ clubSlug: "bottom", lost: 8 }),
      ],
    });
    expect(positionOf(data, OUR_SLUG)).toBe(2);
    expect(positionOf(data, "not-a-club")).toBeNull();
  });
});

describe("headToHead", () => {
  it("counts across several meetings, newest first", () => {
    const data = dataWith({
      history: [
        match({ id: "h1", opponentSlug: "rivals-fc", date: "2024-11-10", isHome: true, homeScore: 3, awayScore: 1 }),
        match({ id: "h2", opponentSlug: "rivals-fc", date: "2025-03-02", isHome: true, homeScore: 2, awayScore: 2 }),
        match({ id: "h3", opponentSlug: "rivals-fc", date: "2025-10-19", isHome: true, homeScore: 0, awayScore: 2 }),
      ],
      matches: [
        match({ id: "m1", opponentSlug: "rivals-fc", date: "2026-09-13", isHome: true, homeScore: 2, awayScore: 1 }),
      ],
    });
    const h2h = headToHead(data, "rivals-fc");

    expect(h2h.played).toBe(4);
    expect(h2h.won).toBe(2);
    expect(h2h.drawn).toBe(1);
    expect(h2h.lost).toBe(1);
    expect(h2h.won + h2h.drawn + h2h.lost).toBe(h2h.played);

    const dates = h2h.meetings.map((m) => m.date);
    expect(dates).toEqual([...dates].sort().reverse());
    expect(dates[0]).toBe("2026-09-13");
  });

  it("reports an away defeat as a defeat", () => {
    const data = dataWith({
      history: [
        match({
          id: "h1",
          opponentSlug: "rivals-fc",
          date: "2025-10-19",
          isHome: false,
          homeScore: 2,
          awayScore: 0,
        }),
      ],
    });
    const away = headToHead(data, "rivals-fc").meetings.find((m) => m.date === "2025-10-19");
    expect(away?.us).toBe(0);
    expect(away?.them).toBe(2);
    expect(away?.result).toBe("L");
  });

  it("combines this season and history, and skips unplayed fixtures", () => {
    const data = dataWith({
      matches: [
        match({ id: "1", opponentSlug: "x-fc", isHome: false, homeScore: 3, awayScore: 2 }),
        match({ id: "2", opponentSlug: "x-fc", date: "2027-01-10" }),
      ],
      history: [
        match({ id: "3", opponentSlug: "x-fc", date: "2025-10-05", isHome: true, homeScore: 2, awayScore: 0 }),
      ],
    });
    const h2h = headToHead(data, "x-fc");
    expect(h2h.played).toBe(2);
    expect(h2h.won).toBe(1);
    expect(h2h.lost).toBe(1);
    expect(h2h.meetings.map((m) => m.id)).toEqual(["1", "3"]);
  });

  it("returns zeros and an empty array for an opponent never played", () => {
    const h2h = headToHead(fixturesData, "never-played-fc");
    expect(h2h.meetings).toEqual([]);
    expect(h2h).toMatchObject({ played: 0, won: 0, drawn: 0, lost: 0 });
  });
});

describe("nextMatch and lastResult", () => {
  const data = dataWith({
    matches: [
      match({ id: "r1", date: "2026-09-13", time: "14:00", opponentSlug: "a-fc", homeScore: 2, awayScore: 1 }),
      match({ id: "r2", date: "2026-11-15", time: "14:00", opponentSlug: "b-fc", homeScore: 4, awayScore: 1 }),
      match({ id: "u1", date: "2026-11-22", time: "12:00", opponentSlug: "c-fc" }),
      match({ id: "u2", date: "2026-11-29", time: "14:00", opponentSlug: "d-fc" }),
      match({ id: "p1", date: "2026-12-06", time: "13:00", opponentSlug: "e-fc", status: "postponed" }),
      match({ id: "u3", date: "2026-12-12", time: "19:00", opponentSlug: "f-fc", competition: "cup" }),
    ],
  });

  it("returns the earliest unplayed match", () => {
    const next = nextMatch(data, new Date("2026-11-18T20:15:00-08:00"));
    expect(next?.date).toBe("2026-11-22");
    expect(next?.opponentSlug).toBe("c-fc");
  });

  it("skips a postponed fixture, since its date is no longer real", () => {
    const next = nextMatch(data, new Date("2026-12-01T09:00:00-08:00"));
    expect(next?.date).toBe("2026-12-12");
    expect(next?.competition).toBe("cup");
  });

  it("returns null when the season is over", () => {
    expect(nextMatch(data, new Date("2027-06-01T09:00:00-07:00"))).toBeNull();
  });

  it("does not return a match that has already kicked off", () => {
    const justAfter = nextMatch(data, new Date("2026-11-22T12:01:00-08:00"));
    expect(justAfter?.date).toBe("2026-11-29");
  });

  it("returns the most recent result", () => {
    const last = lastResult(data, new Date("2026-11-18T20:15:00-08:00"));
    expect(last?.date).toBe("2026-11-15");
    expect(outcome(last ?? match())).toBe("W");
  });

  it("returns null for lastResult before the season starts", () => {
    expect(lastResult(data, new Date("2026-08-01T09:00:00-07:00"))).toBeNull();
  });
});

describe("upcomingMatches", () => {
  it("agrees with nextMatch on the first entry", () => {
    const now = new Date("2026-11-18T20:15:00-08:00");
    expect(upcomingMatches(fixturesData, now)[0]?.id).toBe(nextMatch(fixturesData, now)?.id);
  });

  it("excludes a postponed fixture with no confirmed date, same as nextMatch", () => {
    const now = new Date("2026-12-01T09:00:00-08:00");
    expect(upcomingMatches(fixturesData, now).some((m) => m.status === "postponed")).toBe(false);
  });

  it("is empty once the season is over", () => {
    expect(upcomingMatches(fixturesData, new Date("2027-06-01T09:00:00-07:00"))).toEqual([]);
  });
});

describe("isAwaitingResult", () => {
  it("is false for a match that has not kicked off yet", () => {
    const m = match({ date: "2026-11-22", time: "12:00" });
    expect(isAwaitingResult(m, new Date("2026-11-22T11:59:00-08:00"))).toBe(false);
  });

  it("is true once kickoff has passed with no score and no status", () => {
    const m = match({ date: "2026-11-22", time: "12:00" });
    expect(isAwaitingResult(m, new Date("2026-11-22T14:00:00-08:00"))).toBe(true);
  });

  it("is false once a score is recorded, even after kickoff", () => {
    const m = match({ date: "2026-11-22", time: "12:00", homeScore: 2, awayScore: 1 });
    expect(isAwaitingResult(m, new Date("2026-11-22T14:00:00-08:00"))).toBe(false);
  });

  it("is false for a match carrying a status, postponed or otherwise", () => {
    const m = match({ date: "2026-11-22", time: "12:00", status: "postponed" });
    expect(isAwaitingResult(m, new Date("2026-11-22T14:00:00-08:00"))).toBe(false);
  });

  it("agrees with nextMatch: once awaiting a result, the match is not upcoming", () => {
    const m = match({ id: "awaiting-1", date: "2026-11-22", time: "12:00" });
    const now = new Date("2026-11-22T14:00:00-08:00");
    expect(isAwaitingResult(m, now)).toBe(true);
    expect(upcomingMatches(dataWith({ matches: [m] }), now)).toEqual([]);
  });
});

describe("isoKickoff", () => {
  it("writes a winter kickoff with the -08:00 offset", () => {
    expect(isoKickoff(match({ date: "2026-11-22", time: "12:00" }))).toBe(
      "2026-11-22T12:00:00-08:00",
    );
  });

  it("writes an autumn kickoff with the -07:00 offset, before the clocks change", () => {
    expect(isoKickoff(match({ date: "2026-09-13", time: "14:00" }))).toBe(
      "2026-09-13T14:00:00-07:00",
    );
  });
});

describe("league table integrity on the seed data", () => {
  const total = (pick: (row: StandingsRow) => number): number =>
    fixturesData.standings.reduce((sum, row) => sum + pick(row), 0);

  it("has total wins equal to total losses", () => {
    expect(total((r) => r.won)).toBe(total((r) => r.lost));
  });

  it("has an even number of drawn matches", () => {
    expect(total((r) => r.drawn) % 2).toBe(0);
  });

  it("has total goals for equal to total goals against", () => {
    expect(total((r) => r.goalsFor)).toBe(total((r) => r.goalsAgainst));
  });

  it("has each row's played equal to won plus drawn plus lost", () => {
    for (const row of fixturesData.standings) {
      expect(row.won + row.drawn + row.lost, row.clubSlug).toBe(row.played);
    }
  });

  it("has every standings row and opponent resolving to a club", () => {
    const slugs = new Set(fixturesData.clubs.map((c) => c.slug));
    for (const row of fixturesData.standings) expect(slugs).toContain(row.clubSlug);
    for (const m of [...fixturesData.matches, ...fixturesData.history]) {
      expect(slugs, m.id).toContain(m.opponentSlug);
    }
  });
});

describe("matchesInMonth and groupByMonth", () => {
  const data = dataWith({
    matches: [
      match({ id: "1", date: "2026-09-13", opponentSlug: "a-fc" }),
      match({ id: "2", date: "2026-11-01", opponentSlug: "b-fc" }),
      match({ id: "3", date: "2026-11-07", opponentSlug: "c-fc" }),
      match({ id: "4", date: "2026-11-15", opponentSlug: "d-fc" }),
      match({ id: "5", date: "2027-03-07", opponentSlug: "e-fc" }),
    ],
  });

  it("selects one calendar month, with month numbered 1 to 12", () => {
    const november = matchesInMonth(data, 2026, 11);
    expect(november.map((m) => m.date)).toEqual(["2026-11-01", "2026-11-07", "2026-11-15"]);
    expect(matchesInMonth(data, 2026, 7)).toEqual([]);
  });

  it("groups into months oldest first with a readable label", () => {
    const groups = groupByMonth(data.matches);
    expect(groups[0]).toMatchObject({ year: 2026, month: 9, label: "September 2026" });
    expect(groups.at(-1)).toMatchObject({ year: 2027, month: 3, label: "March 2027" });
    expect(groups.reduce((n, g) => n + g.matches.length, 0)).toBe(data.matches.length);
  });

  it("does not mutate the array it is given", () => {
    const input = [
      match({ id: "b", date: "2026-10-04" }),
      match({ id: "a", date: "2026-09-13" }),
    ];
    groupByMonth(input);
    expect(input.map((m) => m.id)).toEqual(["b", "a"]);
  });
});

/*
 * This describes the real, live src/data/fixtures.json, not a fixed sample,
 * so it only asserts things that hold regardless of where the season is:
 * before a schedule exists, mid season, or after it. A test that hardcodes
 * today's match count would break the day a real result comes in, which is
 * exactly the kind of test that broke here once already.
 */
describe("the real fixtures data", () => {
  it("has no duplicate match ids", () => {
    const ids = [...fixturesData.matches, ...fixturesData.history].map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("splits every match into league, cup or friendly with nothing left over", () => {
    const league = fixturesData.matches.filter((m) => m.competition === "league");
    const cup = fixturesData.matches.filter((m) => m.competition === "cup");
    const friendly = fixturesData.matches.filter((m) => m.competition === "friendly");
    expect(league.length + cup.length + friendly.length).toBe(fixturesData.matches.length);
  });

  it("plays every league opponent home and away, once a schedule exists", () => {
    const league = fixturesData.matches.filter((m) => m.competition === "league");
    if (league.length === 0) return; // 2026-27 schedule not published yet

    const byOpponent = new Map<string, { home: number; away: number }>();
    for (const m of league) {
      const entry = byOpponent.get(m.opponentSlug) ?? { home: 0, away: 0 };
      if (m.isHome) entry.home += 1;
      else entry.away += 1;
      byOpponent.set(m.opponentSlug, entry);
    }
    for (const [slug, { home, away }] of byOpponent) {
      expect(home, `${slug} home`).toBeGreaterThan(0);
      expect(away, `${slug} away`).toBeGreaterThan(0);
    }
  });

  it("gives every club a vmslName, so VMSL matching never half works", () => {
    for (const club of fixturesData.clubs) {
      expect(club.vmslName, club.slug).toBeTruthy();
    }
  });
});

describe("kickoffAt", () => {
  it("reads a winter kickoff as Pacific Standard Time", () => {
    const at = kickoffAt(match({ date: "2026-11-22", time: "12:00" }));
    expect(at.toISOString()).toBe("2026-11-22T20:00:00.000Z");
  });

  it("reads an autumn kickoff as Pacific Daylight Time", () => {
    const at = kickoffAt(match({ date: "2026-09-13", time: "14:00" }));
    expect(at.toISOString()).toBe("2026-09-13T21:00:00.000Z");
  });

  it("is right on the day the clocks go back", () => {
    // Daylight time ends at 02:00 on 1 November 2026, so a 14:00 kickoff
    // that day is already on -08:00 rather than the -07:00 of the day before.
    const at = kickoffAt(match({ date: "2026-11-01", time: "14:00" }));
    expect(at.toISOString()).toBe("2026-11-01T22:00:00.000Z");
  });

  it("is right on the day the clocks go forward", () => {
    // Daylight time starts at 02:00 on 14 March 2027.
    const at = kickoffAt(match({ date: "2027-03-14", time: "14:00" }));
    expect(at.toISOString()).toBe("2027-03-14T21:00:00.000Z");
  });

  it("does not drift a day at a Vancouver midnight", () => {
    const at = kickoffAt(match({ date: "2027-01-10", time: "00:00" }));
    expect(at.toISOString()).toBe("2027-01-10T08:00:00.000Z");
  });
});

describe("localDate", () => {
  it("reports the Vancouver date, not the UTC one", () => {
    // 04:00 UTC on 23 November is still the evening of the 22nd here.
    expect(localDate(new Date("2026-11-23T04:00:00Z"))).toBe("2026-11-22");
  });
});

describe("date formatting", () => {
  it("writes a long date with its weekday", () => {
    expect(formatLongDate("2026-11-22")).toBe("Sun 22 November");
  });

  it("writes a short date for the head to head list", () => {
    expect(formatShortDate("2026-02-15")).toBe("15 Feb 26");
  });

  it("writes ordinals, including the teens", () => {
    expect(ordinal(1)).toBe("1st");
    expect(ordinal(2)).toBe("2nd");
    expect(ordinal(3)).toBe("3rd");
    expect(ordinal(4)).toBe("4th");
    expect(ordinal(11)).toBe("11th");
    expect(ordinal(12)).toBe("12th");
    expect(ordinal(13)).toBe("13th");
    expect(ordinal(21)).toBe("21st");
  });
});

describe("calendarRange", () => {
  it("covers every month from the first fixture to the last", () => {
    const data = dataWith({
      matches: [
        match({ id: "1", date: "2026-09-13", opponentSlug: "a-fc" }),
        match({ id: "2", date: "2027-03-07", opponentSlug: "b-fc" }),
      ],
    });
    const range = calendarRange(data);
    expect(range[0]).toMatchObject({ year: 2026, month: 9, label: "September 2026" });
    expect(range[range.length - 1]).toMatchObject({
      year: 2027,
      month: 3,
      label: "March 2027",
    });
    expect(range).toHaveLength(7);
  });

  it("includes months with no matches, so the arrows step through them", () => {
    const range = calendarRange(
      dataWith({
        matches: [
          match({ id: "a", date: "2026-09-13" }),
          match({ id: "b", date: "2026-12-06" }),
        ],
      }),
    );
    expect(range.map((m) => m.label)).toEqual([
      "September 2026",
      "October 2026",
      "November 2026",
      "December 2026",
    ]);
  });

  it("is empty when there are no matches", () => {
    expect(calendarRange(dataWith())).toEqual([]);
  });
});
