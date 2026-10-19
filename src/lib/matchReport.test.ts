import { describe, expect, it } from "vitest";
import type { Club, FixturesData, Match, PlayerStat, PlayersData } from "../types/types";
import { buildMatchReport, normaliseName, validateReport } from "./matchReport";
import type { ReportFrontmatter } from "./matchReport";

/** Minimal match, overridden per test. Scores are HOME team first. */
function match(overrides: Partial<Match> = {}): Match {
  return {
    id: "m1",
    date: "2026-10-10",
    time: "20:00",
    opponentSlug: "coastal-fc-c",
    isHome: false,
    venue: "South Surrey Athl 9 Turf - SRY",
    competition: "league",
    competitionLabel: "VMSL Division 4A",
    homeScore: 1,
    awayScore: 0,
    ...overrides,
  };
}

const CLUBS: Club[] = [
  { name: "South Van FC", tag: "SVFC", slug: "south-van-fc", colour: "#013478" },
  { name: "Coastal FC C", tag: "CFC", slug: "coastal-fc-c", colour: "#aa0000" },
];

function dataWith(matches: Match[]): FixturesData {
  return {
    season: "2026-27",
    division: "VMSL Division 4A",
    updatedAt: "2026-10-11T08:00:00-07:00",
    clubs: CLUBS,
    matches,
    standings: [],
    history: [],
  };
}

function player(overrides: Partial<PlayerStat>): PlayerStat {
  return {
    name: "Nobody",
    goals: 0,
    assists: 0,
    mvps: 0,
    goalkeeper: false,
    cleanSheets: 0,
    number: null,
    gamesPlayed: 0,
    yellows: 0,
    reds: 0,
    ...overrides,
  };
}

const PLAYERS: PlayersData = {
  season: "2026-27",
  updatedAt: "2026-10-11T08:00:00-07:00",
  players: [
    player({ name: "Harjit Kainth", number: 10 }),
    player({ name: "Erfan Amini", number: 6 }),
    player({ name: "Steven Alix-Meade", number: 1, goalkeeper: true }),
    player({ name: "Joe Bench", number: null }),
  ],
};

const ROSTER = PLAYERS.players.map((p) => p.name);
const NOW = new Date("2026-10-12T12:00:00-07:00");

/** A home win 2-1 with every optional block filled in. */
const HOME_WIN = match({ id: "w", isHome: true, homeScore: 2, awayScore: 1 });

describe("buildMatchReport", () => {
  it("returns null when the post has no matchId", () => {
    expect(buildMatchReport({}, dataWith([match()]), PLAYERS, NOW)).toBeNull();
  });

  it("returns null for an unknown match id", () => {
    expect(buildMatchReport({ matchId: "nope" }, dataWith([match()]), PLAYERS, NOW)).toBeNull();
  });

  it("returns null for a match that has not been played", () => {
    const unplayed = match({ homeScore: null, awayScore: null });
    expect(buildMatchReport({ matchId: "m1" }, dataWith([unplayed]), PLAYERS, NOW)).toBeNull();
  });

  /*
   * The scores are stored home team first, so an away defeat is "1-0" with us
   * on the right. The scoreboard shows them as stored and the result chip is
   * what tells the reader how it went.
   */
  it("puts the home team on the left for an away defeat", () => {
    const report = buildMatchReport({ matchId: "m1" }, dataWith([match()]), PLAYERS, NOW);
    expect(report).not.toBeNull();
    expect(report?.home).toMatchObject({ slug: "coastal-fc-c", score: 1, isUs: false });
    expect(report?.away).toMatchObject({ slug: "south-van-fc", score: 0, isUs: true });
    expect(report?.result).toBe("L");
  });

  it("reads a home win, a draw and an away win", () => {
    const win = buildMatchReport({ matchId: "w" }, dataWith([HOME_WIN]), PLAYERS, NOW);
    expect(win?.home).toMatchObject({ slug: "south-van-fc", score: 2, isUs: true });
    expect(win?.result).toBe("W");

    const draw = match({ id: "d", isHome: false, homeScore: 1, awayScore: 1 });
    expect(buildMatchReport({ matchId: "d" }, dataWith([draw]), PLAYERS, NOW)?.result).toBe("D");

    const awayWin = match({ id: "aw", isHome: false, homeScore: 0, awayScore: 3 });
    expect(buildMatchReport({ matchId: "aw" }, dataWith([awayWin]), PLAYERS, NOW)?.result).toBe("W");
  });

  it("sorts goals by minute, untimed last, and defaults team to us", () => {
    const front: ReportFrontmatter = {
      matchId: "w",
      goals: [
        { scorer: "Erfan Amini" },
        { minute: 67, scorer: "Harjit Kainth", detail: "Penalty" },
        { team: "them", minute: 80, scorer: "Number 9" },
        { minute: 23, scorer: "Harjit Kainth", assist: "Erfan Amini" },
      ],
    };
    const report = buildMatchReport(front, dataWith([HOME_WIN]), PLAYERS, NOW);
    expect(report?.goals.map((g) => g.minute)).toEqual([23, 67, 80, null]);
    expect(report?.goals[0]).toMatchObject({ team: "us", assist: "Erfan Amini" });
    expect(report?.goals[2].team).toBe("them");
  });

  it("builds lineup players with numbers, captain, keeper and goal counts", () => {
    const front: ReportFrontmatter = {
      matchId: "w",
      goals: [
        { minute: 23, scorer: "harjit  kainth", assist: "Erfan Amini" },
        { minute: 67, scorer: "Harjit Kainth" },
      ],
      lineup: {
        captain: "Erfan Amini",
        starters: ["Steven Alix-Meade", "Erfan Amini", "Harjit Kainth"],
        bench: ["Joe Bench"],
      },
    };
    const report = buildMatchReport(front, dataWith([HOME_WIN]), PLAYERS, NOW);
    const [keeper, amini, kainth] = report?.lineup?.starters ?? [];

    expect(keeper).toMatchObject({ number: 1, goalkeeper: true, captain: false });
    expect(amini).toMatchObject({ number: 6, captain: true, assists: 1, goals: 0 });
    expect(kainth).toMatchObject({ number: 10, goals: 2, assists: 0 });
    expect(report?.lineup?.bench[0]).toMatchObject({ name: "Joe Bench", number: null });
  });

  it("looks up the man of the match shirt number and tolerates missing fields", () => {
    const front: ReportFrontmatter = { matchId: "w", motm: { player: "erfan amini" } };
    const report = buildMatchReport(front, dataWith([HOME_WIN]), PLAYERS, NOW);
    expect(report?.motm).toEqual({ name: "erfan amini", reason: null, number: 6 });
    expect(report?.lineup).toBeNull();
    expect(report?.goals).toEqual([]);
  });

  /*
   * A report is read for months. Its form strip has to end at its own match,
   * otherwise it changes every time a later result comes in.
   */
  it("reports form as of the match, not as of today", () => {
    const matches = [
      match({ id: "a", date: "2026-09-01", homeScore: 3, awayScore: 0, isHome: true }),
      match({ id: "b", date: "2026-09-08", homeScore: 0, awayScore: 0, isHome: true }),
      match({ id: "c", date: "2026-09-15", homeScore: 2, awayScore: 0, isHome: false }),
      match({ id: "d", date: "2026-09-22", homeScore: 1, awayScore: 1, isHome: true }),
      match({ id: "e", date: "2026-09-29", homeScore: 0, awayScore: 1, isHome: true }),
      match({ id: "f", date: "2026-10-06", homeScore: 4, awayScore: 0, isHome: false }),
      match({ id: "g", date: "2026-10-13", homeScore: null, awayScore: null }),
    ];
    const data = dataWith(matches);

    const early = buildMatchReport({ matchId: "c" }, data, PLAYERS, NOW);
    expect(early?.form).toEqual(["W", "D", "L"]);

    // W D L D L L up to match f, so the strip keeps the last five
    const late = buildMatchReport({ matchId: "f" }, data, PLAYERS, NOW);
    expect(late?.form).toEqual(["D", "L", "D", "L", "L"]);
  });

  it("offers the next fixture, or null once the season is over", () => {
    const upcoming = match({ id: "n", date: "2026-10-17", homeScore: null, awayScore: null });
    const withNext = buildMatchReport({ matchId: "m1" }, dataWith([match(), upcoming]), PLAYERS, NOW);
    expect(withNext?.next?.id).toBe("n");

    const over = buildMatchReport({ matchId: "m1" }, dataWith([match()]), PLAYERS, NOW);
    expect(over?.next).toBeNull();
  });
});

describe("validateReport", () => {
  const data = dataWith([HOME_WIN]);

  const good: ReportFrontmatter = {
    matchId: "w",
    goals: [
      { minute: 23, scorer: "Harjit Kainth", assist: "Erfan Amini" },
      { minute: 67, scorer: "Harjit Kainth" },
      { team: "them", minute: 80, scorer: "Number 9" },
    ],
    motm: { player: "Erfan Amini" },
    lineup: {
      captain: "Erfan Amini",
      starters: ["Steven Alix-Meade", "Erfan Amini", "Harjit Kainth"],
      bench: ["Joe Bench"],
    },
  };

  it("passes a consistent report", () => {
    expect(validateReport(good, data, ROSTER)).toEqual([]);
  });

  it("passes a report that is only a matchId", () => {
    expect(validateReport({ matchId: "w" }, data, ROSTER)).toEqual([]);
  });

  it("flags an unknown match id", () => {
    const problems = validateReport({ matchId: "nope" }, data, ROSTER);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("not in src/data/fixtures.json");
  });

  it("flags a match with no score", () => {
    const unplayed = dataWith([match({ homeScore: null, awayScore: null })]);
    expect(validateReport({ matchId: "m1" }, unplayed, ROSTER)[0]).toContain("no final score");
  });

  it("flags goals that do not add up to our score", () => {
    const front = { ...good, goals: [{ minute: 23, scorer: "Harjit Kainth" }] };
    const problems = validateReport(front, data, ROSTER);
    expect(problems.some((p) => p.includes("lists 1 South Van goal but the final score has 2"))).toBe(true);
  });

  it("flags opponent goals that do not add up, but allows leaving them out", () => {
    const wrong = {
      ...good,
      goals: [
        ...good.goals!.slice(0, 2),
        { team: "them" as const, scorer: "A" },
        { team: "them" as const, scorer: "B" },
      ],
    };
    expect(validateReport(wrong, data, ROSTER).some((p) => p.includes("opponent goals"))).toBe(true);

    const omitted = { ...good, goals: good.goals!.slice(0, 2) };
    expect(validateReport(omitted, data, ROSTER)).toEqual([]);
  });

  it("flags a name that is not on the roster, with its location", () => {
    const front = {
      ...good,
      goals: [
        { minute: 23, scorer: "Harjit Kainthh" },
        { minute: 67, scorer: "Harjit Kainth" },
      ],
    };
    const problems = validateReport(front, data, ROSTER);
    expect(problems.some((p) => p.includes('"Harjit Kainthh" is not in src/data/roster.json'))).toBe(true);
  });

  it("flags a captain, man of the match or scorer who is not in the lineup", () => {
    const front: ReportFrontmatter = {
      ...good,
      motm: { player: "Joe Bench" },
      lineup: { captain: "Erfan Amini", starters: ["Steven Alix-Meade"], bench: [] },
    };
    const problems = validateReport(front, data, ROSTER).join("\n");
    expect(problems).toContain('captain "Erfan Amini" is not in starters or bench');
    expect(problems).toContain('motm: "Joe Bench" is not in the lineup');
    expect(problems).toContain('"Harjit Kainth" scored but is not in the lineup');
  });

  it("reports a brace scorer missing from the lineup only once", () => {
    const front: ReportFrontmatter = {
      ...good,
      lineup: { starters: ["Steven Alix-Meade", "Erfan Amini"], bench: [] },
    };
    const hits = validateReport(front, data, ROSTER).filter((p) => p.includes("scored but"));
    expect(hits).toHaveLength(1);
  });

  it("flags a player listed twice and a scorer who is also the assist", () => {
    const front: ReportFrontmatter = {
      ...good,
      goals: [
        { minute: 23, scorer: "Harjit Kainth", assist: "harjit kainth" },
        { minute: 67, scorer: "Harjit Kainth" },
      ],
      lineup: {
        starters: ["Steven Alix-Meade", "Erfan Amini", "Harjit Kainth"],
        bench: ["Harjit Kainth"],
      },
    };
    const problems = validateReport(front, data, ROSTER).join("\n");
    expect(problems).toContain("appears more than once");
    expect(problems).toContain("both scorer and assist");
  });
});

describe("normaliseName", () => {
  it("ignores case and stray whitespace", () => {
    expect(normaliseName("  Erfan   AMINI ")).toBe("erfan amini");
  });
});
