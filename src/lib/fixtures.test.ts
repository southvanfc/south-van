import { describe, expect, it } from "vitest";
import type { FixturesData, Match, StandingsRow } from "../types/types";
import { fixturesData } from "../data/fixtures";
import {
  OUR_SLUG,
  calendarRange,
  formatLongDate,
  formatShortDate,
  groupByMonth,
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

  it("places South Van in the seed data by points", () => {
    const sorted = sortedStandings(fixturesData);
    expect(sorted).toHaveLength(10);
    expect(sorted[0]?.clubSlug).toBe("new-wells-city-fc");
    expect(positionOf(fixturesData, OUR_SLUG)).toBe(3);
    expect(positionOf(fixturesData, "not-a-club")).toBeNull();
  });
});

describe("headToHead", () => {
  it("counts the seed data from South Van's perspective, newest first", () => {
    const h2h = headToHead(fixturesData, "cmfsc-caproni");

    expect(h2h.played).toBe(5);
    expect(h2h.won).toBe(2);
    expect(h2h.drawn).toBe(2);
    expect(h2h.lost).toBe(1);
    expect(h2h.won + h2h.drawn + h2h.lost).toBe(h2h.played);

    const dates = h2h.meetings.map((m) => m.date);
    expect(dates).toEqual([...dates].sort().reverse());
    expect(dates[0]).toBe("2026-09-13");
  });

  it("reports an away defeat as a defeat", () => {
    // 2025-10-19 was a 0-2 home defeat, 2026-02-15 a 1-1 away draw.
    const h2h = headToHead(fixturesData, "cmfsc-caproni");
    const away = h2h.meetings.find((m) => m.date === "2026-02-15");
    expect(away?.us).toBe(1);
    expect(away?.them).toBe(1);
    expect(away?.result).toBe("D");
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
  it("returns the earliest unplayed match", () => {
    const next = nextMatch(fixturesData, new Date("2026-11-18T20:15:00-08:00"));
    expect(next?.date).toBe("2026-11-22");
    expect(next?.opponentSlug).toBe("cmfsc-caproni");
  });

  it("skips a postponed fixture, since its date is no longer real", () => {
    const next = nextMatch(fixturesData, new Date("2026-12-01T09:00:00-08:00"));
    expect(next?.date).toBe("2026-12-12");
    expect(next?.competition).toBe("cup");
  });

  it("returns null when the season is over", () => {
    expect(nextMatch(fixturesData, new Date("2027-06-01T09:00:00-07:00"))).toBeNull();
  });

  it("does not return a match that has already kicked off", () => {
    const justAfter = nextMatch(fixturesData, new Date("2026-11-22T12:01:00-08:00"));
    expect(justAfter?.date).toBe("2026-11-29");
  });

  it("returns the most recent result", () => {
    const last = lastResult(fixturesData, new Date("2026-11-18T20:15:00-08:00"));
    expect(last?.date).toBe("2026-11-15");
    expect(outcome(last ?? match())).toBe("W");
  });

  it("returns null for lastResult before the season starts", () => {
    expect(lastResult(fixturesData, new Date("2026-08-01T09:00:00-07:00"))).toBeNull();
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
  it("selects one calendar month, with month numbered 1 to 12", () => {
    const november = matchesInMonth(fixturesData, 2026, 11);
    expect(november.map((m) => m.date)).toEqual([
      "2026-11-01",
      "2026-11-07",
      "2026-11-15",
      "2026-11-22",
      "2026-11-29",
    ]);
    expect(matchesInMonth(fixturesData, 2026, 7)).toEqual([]);
  });

  it("groups into months oldest first with a readable label", () => {
    const groups = groupByMonth(fixturesData.matches);
    expect(groups[0]).toMatchObject({ year: 2026, month: 9, label: "September 2026" });
    expect(groups.at(-1)).toMatchObject({ year: 2027, month: 3, label: "March 2027" });
    expect(groups.reduce((n, g) => n + g.matches.length, 0)).toBe(
      fixturesData.matches.length,
    );
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

describe("the seed data itself", () => {
  it("has no duplicate match ids", () => {
    const ids = [...fixturesData.matches, ...fixturesData.history].map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has 18 league matches and one cup tie", () => {
    const league = fixturesData.matches.filter((m) => m.competition === "league");
    const cup = fixturesData.matches.filter((m) => m.competition === "cup");
    expect(league).toHaveLength(18);
    expect(cup).toHaveLength(1);
  });

  it("plays every opponent home and away in the league", () => {
    for (const club of fixturesData.clubs.filter((c) => c.slug !== OUR_SLUG)) {
      const league = fixturesData.matches.filter(
        (m) => m.competition === "league" && m.opponentSlug === club.slug,
      );
      expect(league.filter((m) => m.isHome), club.slug).toHaveLength(1);
      expect(league.filter((m) => !m.isHome), club.slug).toHaveLength(1);
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
    const range = calendarRange(fixturesData);
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
