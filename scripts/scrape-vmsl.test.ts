/*
 * Offline tests for the VMSL parse and normalise steps.
 *
 * Every test runs against real responses saved under scripts/__fixtures__/, so
 * nothing here touches the network. That matters twice over: the tests stay
 * fast and deterministic, and they do not hit someone else's server on every
 * `npm test`.
 *
 * 2025-26 is deliberately the season under test. It is the awkward one: 23
 * matches including two forfeits, a match abandoned and completed three months
 * later, and a cup group tie settled on penalties. A parser that only handles
 * tidy fixtures passes on a friendlier season and fails on this one.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import type { Match } from "../src/types/types";
import {
  classifyCompetition,
  deriveTag,
  findPoolForTeam,
  mapStatus,
  matchesOutsideSeason,
  normaliseMatches,
  parseKickoff,
  parseSchedule,
  parseStandings,
  seasonWindow,
  slugify,
  stripNewPrefix,
} from "./vmsl-parse.ts";

const HERE = path.dirname(fileURLToPath(import.meta.url));

function fixture(name: string): string {
  return readFileSync(path.join(HERE, "__fixtures__", name), "utf8");
}

const SCHEDULE_2025_26 = fixture("schedule-2025-26.html");
const SCHEDULE_2026_27 = fixture("schedule-2026-27.html");
const STANDINGS_ALL_2025_26 = fixture("standings-2025-26-all.html");
const STANDINGS_2026_27 = fixture("standings-2026-27.html");

const OUR_TEAM = "SouthVan FC";
const OUR_TEAM_ID = "827";

/** Normalise the saved season the way the scraper does, with plain slugs. */
function normalised(): Match[] {
  const { fixtures } = parseSchedule(SCHEDULE_2025_26);
  return normaliseMatches(fixtures, {
    teamName: OUR_TEAM,
    divisionLabel: "VMSL Division 4B",
    slugFor: slugify,
  }).matches;
}

function byId(id: string): Match {
  const match = normalised().find((entry) => entry.id === id);
  if (!match) throw new Error(`No match ${id} in the parsed season.`);
  return match;
}

/* ------------------------------------------------------------------ */

describe("parseSchedule", () => {
  it("parses all 23 matches and agrees with VMSL's own record count", () => {
    const { fixtures, claimedCount, tableFound } = parseSchedule(SCHEDULE_2025_26);

    expect(tableFound).toBe(true);
    expect(fixtures).toHaveLength(23);
    // The free integrity check: if these ever disagree, the markup changed.
    expect(claimedCount).toBe(23);
    expect(fixtures.length).toBe(claimedCount);
  });

  it("gives every match a sched_seq_no, and they are unique", () => {
    const { fixtures } = parseSchedule(SCHEDULE_2025_26);
    const ids = fixtures.map((entry) => entry.id);

    expect(ids.every((id) => id !== null && /^\d+$/.test(id))).toBe(true);
    expect(new Set(ids).size).toBe(23);
  });

  it("reads a readable venue for every match, with no field code lookup", () => {
    const { fixtures } = parseSchedule(SCHEDULE_2025_26);
    expect(fixtures.every((entry) => (entry.venue ?? "").length > 3)).toBe(true);
    expect(fixtures[0]?.venue).toBe("Fen Burdett Mahon Turf - NVAN");
  });

  it("treats a season with no schedule table as empty rather than failing", () => {
    const { fixtures, claimedCount, tableFound } = parseSchedule(SCHEDULE_2026_27);

    expect(tableFound).toBe(false);
    expect(fixtures).toHaveLength(0);
    expect(claimedCount).toBeNull();
  });

  it("does not leak one match's status marker onto the next", () => {
    const { fixtures } = parseSchedule(SCHEDULE_2025_26);
    const marked = fixtures.filter((entry) => entry.statusMarker !== null);

    // Exactly four of the 23 carry a marker. A sticky marker would give more.
    expect(marked.map((entry) => entry.id)).toEqual(["21810", "21855", "22149", "22374"]);
  });
});

describe("scores are stored home team first", () => {
  /*
   * The single most likely bug in this whole script, and it fails silently,
   * because a table built from reversed scores still looks entirely plausible.
   */
  it("keeps an away win as the home team's goals first", () => {
    // VMSL: Highlands VFC 1 - 3 SouthVan FC. We were away and we won.
    const match = byId("21891");

    expect(match.isHome).toBe(false);
    expect(match.opponentSlug).toBe("highlands-vfc");
    expect(match.homeScore).toBe(1);
    expect(match.awayScore).toBe(3);
  });

  it("keeps an away defeat as the home team's goals first", () => {
    // VMSL: Dinamo Anatolia 8 - 2 SouthVan FC. Away, and a heavy defeat.
    const match = byId("21856");

    expect(match.isHome).toBe(false);
    expect(match.homeScore).toBe(8);
    expect(match.awayScore).toBe(2);
    // Read our way round, this is 2-8. Stored the wrong way it would read as a win.
    expect(match.awayScore).toBeLessThan(match.homeScore ?? 0);
  });

  it("keeps a home result as our goals first, because we are the home team", () => {
    // VMSL: SouthVan FC 4 - 0 NorthStars VFC.
    const match = byId("21841");

    expect(match.isHome).toBe(true);
    expect(match.homeScore).toBe(4);
    expect(match.awayScore).toBe(0);
  });

  it("never fills in one score without the other", () => {
    for (const match of normalised()) {
      expect(match.homeScore === null).toBe(match.awayScore === null);
    }
  });
});

describe("statuses and notes", () => {
  it("records a forfeit with its status, its scoreline and its note", () => {
    // VMSL: NVFC Norvan Lions 3 - 0 SouthVan FC (Forfeited).
    const match = byId("21810");

    expect(match.status).toBe("forfeited");
    expect(match.isHome).toBe(false);
    expect(match.homeScore).toBe(3);
    expect(match.awayScore).toBe(0);
    expect(match.note).toBe("Forfeited by SouthVan FC");
  });

  it("records the second forfeit, which is a cup tie", () => {
    const match = byId("22149");

    expect(match.status).toBe("forfeited");
    expect(match.competition).toBe("cup");
    expect(match.note).toContain("Forfeited by SouthVan FC");
  });

  it("drops the partial score of an abandoned match and keeps it in the note", () => {
    /*
     * VMSL shows this as 1-1 with an (Incomplete) marker, but that is not a
     * result: the last 75 minutes were played on 22 February and appear as a
     * separate Completion fixture. Keeping the 1-1 would count the match twice.
     */
    const match = byId("21855");

    expect(match.status).toBe("incomplete");
    expect(match.homeScore).toBeNull();
    expect(match.awayScore).toBeNull();
    expect(match.note).toContain("Deemed incomplete");
    expect(match.note).toContain("Abandoned at 1-1.");
  });

  it("records the completion of that match as the real result", () => {
    const match = byId("22374");

    expect(match.status).toBe("completion");
    expect(match.homeScore).toBe(3);
    expect(match.awayScore).toBe(3);
    expect(match.note).toBe("Last 75 minutes completed from a score of 1-1");
  });

  it("keeps the penalty shootout note on a drawn cup tie", () => {
    /*
     * A cup group tie decided on penalties has a drawn 90 minute scoreline, so
     * dropping the note leaves the stored result misleading.
     */
    const match = byId("22132");

    expect(match.competition).toBe("cup");
    expect(match.homeScore).toBe(1);
    expect(match.awayScore).toBe(2);
    expect(match.note).toBe("Group B. PK win (4-5)");
    expect(match.competitionLabel).toBe("Division 4 Cup, Group B");
  });

  it("maps VMSL's markers onto our own statuses and ignores anything unknown", () => {
    expect(mapStatus("Forfeited")).toBe("forfeited");
    expect(mapStatus("Incomplete")).toBe("incomplete");
    expect(mapStatus("Completion")).toBe("completion");
    expect(mapStatus("Postponed")).toBe("postponed");
    expect(mapStatus(null)).toBeNull();
    expect(mapStatus("Rescheduled To Mars")).toBeNull();
  });

  it("keeps an unrecognised marker in the note rather than losing it", () => {
    const { fixtures } = parseSchedule(SCHEDULE_2025_26);
    const first = fixtures[0];
    if (!first) throw new Error("No fixtures parsed.");

    const { matches, warnings } = normaliseMatches(
      [{ ...first, statusMarker: "Abandoned", note: null }],
      { teamName: OUR_TEAM, divisionLabel: "VMSL Division 4B", slugFor: slugify },
    );

    expect(matches[0]?.status).toBeUndefined();
    expect(matches[0]?.note).toContain("VMSL marker: Abandoned");
    expect(warnings[0]).toContain("unrecognised");
  });
});

describe("dates and times", () => {
  it("converts US month first dates and 12 hour times", () => {
    expect(parseKickoff("Sat 9/6/2025 6:00PM")).toEqual({ date: "2025-09-06", time: "18:00" });
    expect(parseKickoff("Sun 1/18/2026 10:10AM")).toEqual({ date: "2026-01-18", time: "10:10" });
    expect(parseKickoff("Fri 12/12/2025 12:00PM")).toEqual({ date: "2025-12-12", time: "12:00" });
    expect(parseKickoff("Fri 12/12/2025 12:30AM")).toEqual({ date: "2025-12-12", time: "00:30" });
    expect(parseKickoff("nothing useful here")).toBeNull();
  });

  it("does not shift kickoffs across the November DST change", () => {
    /*
     * Vancouver leaves daylight time on 2 November 2025. These two matches sit
     * either side of it and both kick off at 14:05 local. Nothing here builds a
     * Date, so there is no offset to apply and no hour to lose.
     */
    expect(byId("21846").date).toBe("2025-11-02"); // the morning the clocks went back
    expect(byId("21846").time).toBe("14:05");
    expect(byId("21841").time).toBe("14:05"); // 26 October, still daylight time
    expect(byId("21855").time).toBe("14:05"); // 9 November, standard time
  });

  it("gives every match a date and a time", () => {
    for (const match of normalised()) {
      expect(match.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(match.time).toMatch(/^([01]\d|2[0-3]):[0-5]\d$/);
      expect(match.opponentSlug).not.toBe("");
    }
  });
});

describe("the reg_year off by one", () => {
  /*
   * reg_year is the season END year, so reg_year 2027 is season 2026-27. Point
   * it at the wrong season and every fixture still parses cleanly, the footer
   * count still agrees and the standings still look sane. Only the dates give
   * it away, which is what this check reads.
   */
  it("works out the window a season can cover", () => {
    expect(seasonWindow(2027)).toEqual({ start: "2026-07-01", end: "2027-06-30" });
    expect(seasonWindow(2026)).toEqual({ start: "2025-07-01", end: "2026-06-30" });
  });

  it("accepts the 2025-26 season under its own reg_year of 2026", () => {
    expect(matchesOutsideSeason(normalised(), 2026)).toHaveLength(0);
  });

  it("rejects last season's fixtures when the config asks for 2026-27", () => {
    const strays = matchesOutsideSeason(normalised(), 2027);

    // Every one of the 23 is a year early, which is exactly the failure this catches.
    expect(strays).toHaveLength(23);
    expect(strays[0]?.date).toBe("2025-09-06");
  });

  it("catches a single stray fixture as well as a whole wrong season", () => {
    const strays = matchesOutsideSeason(
      [
        { id: "1", date: "2026-09-13" },
        { id: "2", date: "2027-03-07" },
        { id: "3", date: "2027-08-01" },
      ],
      2027,
    );

    expect(strays.map((match) => match.id)).toEqual(["3"]);
  });
});

describe("competition classification", () => {
  it("splits the season into 19 league rows and 4 cup ties", () => {
    /*
     * 19 rather than 18, because the abandoned match against NVFC occupies two
     * rows: the abandonment itself, which carries no result, and the completion
     * three months later, which carries the real one. Only 18 of the 19 have a
     * scoreline, which is why the derived record still reads P18 and agrees
     * with the published standings row.
     */
    const matches = normalised();
    const league = matches.filter((match) => match.competition === "league");

    expect(league).toHaveLength(19);
    expect(league.filter((match) => match.homeScore !== null)).toHaveLength(18);
    expect(matches.filter((match) => match.competition === "cup")).toHaveLength(4);
  });

  it("reads league, cup and friendly off VMSL's own labels", () => {
    expect(classifyCompetition("Winter - League", "Division 4")).toBe("league");
    expect(classifyCompetition("Winter - Cup Group", "Div 4 Cup")).toBe("cup");
    expect(classifyCompetition("Winter - Friendly", "")).toBe("friendly");
    expect(classifyCompetition("", "")).toBe("league");
  });

  it("labels league matches with the configured division", () => {
    expect(byId("21811").competitionLabel).toBe("VMSL Division 4B");
  });
});

describe("club names", () => {
  it("strips the NEW - prefix VMSL puts on new entrants", () => {
    expect(stripNewPrefix("NEW - Coastal FC C")).toBe("Coastal FC C");
    expect(stripNewPrefix("new - Coastal FC C")).toBe("Coastal FC C");
    expect(stripNewPrefix("Coastal FC C")).toBe("Coastal FC C");
  });

  it("strips the square brackets VMSL wraps some new entrants in", () => {
    expect(stripNewPrefix("NEW - [AC Phantoms]")).toBe("AC Phantoms");
  });

  it("strips the prefix everywhere a club name is read", () => {
    const pools = parseStandings(STANDINGS_2026_27);
    const ours = findPoolForTeam(pools, OUR_TEAM_ID);
    const names = ours?.rows.map((row) => row.team) ?? [];

    expect(names).toContain("Coastal FC C");
    expect(names).toContain("AC Phantoms");
    expect(names).toContain("New Wells City SC B");
    expect(names.some((name) => name.includes("NEW"))).toBe(false);
    expect(names.some((name) => name.includes("["))).toBe(false);
  });

  it("drops the (FF) forfeit marker from a team name", () => {
    // SouthVan FC carries "(FF)" in the away cell of the forfeited match.
    expect(byId("21810").opponentSlug).toBe("nvfc-norvan-lions");
    const { fixtures } = parseSchedule(SCHEDULE_2025_26);
    expect(fixtures[0]?.awayTeam).toBe("SouthVan FC");
  });

  it("builds stable slugs and 2 to 4 letter tags", () => {
    expect(slugify("NVFC Norvan Lions")).toBe("nvfc-norvan-lions");
    expect(slugify("NEW - [AC Phantoms]")).toBe("ac-phantoms");
    expect(slugify("Bby Spartans FC Hades")).toBe("bby-spartans-fc-hades");

    for (const name of ["Atlixco", "FC Kova", "Bby Spartans FC Hades", "NorthStars VFC"]) {
      const tag = deriveTag(name);
      expect(tag.length).toBeGreaterThanOrEqual(2);
      expect(tag.length).toBeLessThanOrEqual(4);
      expect(tag).toMatch(/^[A-Z0-9]+$/);
    }
  });
});

describe("standings", () => {
  it("parses both pools of the division from one request", () => {
    const pools = parseStandings(STANDINGS_ALL_2025_26);

    expect(pools.map((pool) => pool.pool)).toEqual(["A", "B"]);
    expect(pools[0]?.rows).toHaveLength(10);
    expect(pools[1]?.rows).toHaveLength(10);
  });

  it("derives the pool from where the team actually sits, not from config", () => {
    /*
     * South Van were in Pool B in 2025-26 and Pool A in 2026-27. Promotion and
     * relegation reshuffle the pools every season, so a hardcoded pool is wrong
     * roughly every August.
     */
    expect(findPoolForTeam(parseStandings(STANDINGS_ALL_2025_26), OUR_TEAM_ID)?.pool).toBe("B");
    expect(findPoolForTeam(parseStandings(STANDINGS_2026_27), OUR_TEAM_ID)?.pool).toBe("A");
  });

  it("returns null when the team is nowhere in the division", () => {
    expect(findPoolForTeam(parseStandings(STANDINGS_ALL_2025_26), "999999")).toBeNull();
  });

  it("reads the columns in VMSL's order of GP, W, D, L, GF, GA, GD, PTS", () => {
    const pool = findPoolForTeam(parseStandings(STANDINGS_ALL_2025_26), OUR_TEAM_ID);
    const ours = pool?.rows.find((row) => row.teamId === OUR_TEAM_ID);

    expect(ours).toMatchObject({
      position: 7,
      team: "SouthVan FC",
      played: 18,
      won: 5,
      drawn: 5,
      lost: 8,
      goalsFor: 39,
      goalsAgainst: 54,
      goalDifference: -15,
      points: 20,
    });
  });

  it("parses a published but unplayed season as a full table of zeros", () => {
    const pool = findPoolForTeam(parseStandings(STANDINGS_2026_27), OUR_TEAM_ID);

    expect(pool?.rows).toHaveLength(10);
    expect(pool?.rows.every((row) => row.played === 0)).toBe(true);
  });

  it("reads a club's crest as the src VMSL served for its row", () => {
    const pool = findPoolForTeam(parseStandings(STANDINGS_2026_27), OUR_TEAM_ID);
    const ours = pool?.rows.find((row) => row.teamId === OUR_TEAM_ID);

    expect(ours?.crestUrl).toBe("/upload/img/teamcrest_827.jpg");
  });

  it("still reads a crest url for a club with no badge uploaded, since deciding what counts as real is not this file's job", () => {
    const pool = findPoolForTeam(parseStandings(STANDINGS_2026_27), OUR_TEAM_ID);
    const newEntrant = pool?.rows.find((row) => row.team.includes("AC Phantoms"));

    expect(newEntrant?.crestUrl).toBe("/upload/img/logo_sm.jpg");
  });

  it("agrees with the results we parsed, which is the check that catches reversed scores", () => {
    /*
     * VMSL's published row and our own arithmetic over the fixtures are two
     * independent sources. If a score were stored the wrong way round, the wins
     * and the goal columns would part company here.
     */
    const pool = findPoolForTeam(parseStandings(STANDINGS_ALL_2025_26), OUR_TEAM_ID);
    const published = pool?.rows.find((row) => row.teamId === OUR_TEAM_ID);
    if (!published) throw new Error("South Van FC is not in the standings.");

    const league = normalised().filter(
      (match) => match.competition === "league" && match.homeScore !== null,
    );

    let won = 0;
    let drawn = 0;
    let lost = 0;
    let goalsFor = 0;
    let goalsAgainst = 0;

    for (const match of league) {
      const us = match.isHome ? match.homeScore : match.awayScore;
      const them = match.isHome ? match.awayScore : match.homeScore;
      if (us === null || them === null) continue;
      goalsFor += us;
      goalsAgainst += them;
      if (us > them) won += 1;
      else if (us < them) lost += 1;
      else drawn += 1;
    }

    expect({ played: league.length, won, drawn, lost, goalsFor, goalsAgainst }).toEqual({
      played: published.played,
      won: published.won,
      drawn: published.drawn,
      lost: published.lost,
      goalsFor: published.goalsFor,
      goalsAgainst: published.goalsAgainst,
    });
  });
});

describe("normaliseMatches guards", () => {
  it("refuses a fixture that does not involve us", () => {
    const { fixtures } = parseSchedule(SCHEDULE_2025_26);
    const first = fixtures[0];
    if (!first) throw new Error("No fixtures parsed.");

    expect(() =>
      normaliseMatches([{ ...first, homeTeam: "Atlixco", awayTeam: "FC Kova" }], {
        teamName: OUR_TEAM,
        divisionLabel: "VMSL Division 4B",
        slugFor: slugify,
      }),
    ).toThrow(/exactly one of those should be/);
  });

  it("refuses a fixture with no sched_seq_no, since that is the reconciliation key", () => {
    const { fixtures } = parseSchedule(SCHEDULE_2025_26);
    const first = fixtures[0];
    if (!first) throw new Error("No fixtures parsed.");

    expect(() =>
      normaliseMatches([{ ...first, id: null }], {
        teamName: OUR_TEAM,
        divisionLabel: "VMSL Division 4B",
        slugFor: slugify,
      }),
    ).toThrow(/sched_seq_no/);
  });

  it("refuses a date it cannot read", () => {
    const { fixtures } = parseSchedule(SCHEDULE_2025_26);
    const first = fixtures[0];
    if (!first) throw new Error("No fixtures parsed.");

    expect(() =>
      normaliseMatches([{ ...first, rawDate: "sometime next spring" }], {
        teamName: OUR_TEAM,
        divisionLabel: "VMSL Division 4B",
        slugFor: slugify,
      }),
    ).toThrow(/Could not read a kickoff/);
  });
});
