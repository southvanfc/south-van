import type { Club, FixturesData, Match, PlayersData } from "../types/types";
import {
  OUR_SLUG,
  getClub,
  isPlayed,
  nextMatch,
  ourScore,
  outcome,
  theirScore,
} from "./fixtures.ts";

/**
 * Pure helpers behind the match report blog template.
 *
 * A report is a blog post with a `matchId`. Everything fixtures.json already
 * knows is looked up from it, and only goals, man of the match and lineup come
 * from the post's frontmatter. Like src/lib/fixtures.ts, nothing here touches
 * the DOM or Astro, so the page, the validation script and the tests all call
 * the same code.
 */

export interface ReportGoal {
  /** Defaults to "us" */
  team?: "us" | "them";
  minute?: number;
  scorer: string;
  assist?: string;
  detail?: string;
}

export interface ReportFrontmatter {
  matchId?: string;
  goals?: ReportGoal[];
  motm?: { player: string; reason?: string };
  lineup?: { captain?: string; starters: string[]; bench?: string[] };
}

type PlayedMatch = Match & { homeScore: number; awayScore: number };
type Result = "W" | "D" | "L";

/** One team in the scoreboard. Home is always built first, as on /fixtures. */
export interface ReportSide {
  slug: string;
  club: Club | undefined;
  score: number;
  isUs: boolean;
}

export interface ReportGoalView {
  team: "us" | "them";
  minute: number | null;
  scorer: string;
  assist: string | null;
  detail: string | null;
}

export interface ReportPlayer {
  name: string;
  /** Shirt number, or null when players.json has none for this name */
  number: number | null;
  goalkeeper: boolean;
  captain: boolean;
  /** Goals and assists in this match only, counted from the report's goals */
  goals: number;
  assists: number;
}

export interface MatchReport {
  match: PlayedMatch;
  home: ReportSide;
  away: ReportSide;
  opponent: Club | undefined;
  result: Result;
  /** Sorted by minute, goals without a minute last. Empty when none were given. */
  goals: ReportGoalView[];
  motm: { name: string; reason: string | null; number: number | null } | null;
  lineup: { starters: ReportPlayer[]; bench: ReportPlayer[] } | null;
  /** Up to five results, oldest first, ending with this match */
  form: Result[];
  /** The next fixture at `now`, or null when the season is over */
  next: Match | null;
}

/**
 * Case and whitespace insensitive key for a player name. The same tolerance
 * `checkManualStats` applies in scripts/vmsl-parse.ts, so a name that passes
 * there passes here.
 */
export function normaliseName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

function kickoffKey(match: Match): string {
  return `${match.date} ${match.time}`;
}

function findMatch(data: FixturesData, matchId: string | undefined): Match | null {
  if (!matchId) return null;
  return data.matches.find((m) => m.id === matchId) ?? null;
}

/**
 * Results up to and including `match`, never later ones. A report is written
 * once and read for months, so its form strip must not shift as the season
 * goes on.
 */
function formAsOf(data: FixturesData, match: Match, limit = 5): Result[] {
  const results: Result[] = [];
  const upToHere = data.matches
    .filter(isPlayed)
    .filter((m) => kickoffKey(m) <= kickoffKey(match))
    .sort((a, b) => kickoffKey(a).localeCompare(kickoffKey(b)));

  for (const m of upToHere) {
    const result = outcome(m);
    if (result) results.push(result);
  }
  return results.slice(-limit);
}

/**
 * Everything the report components render, or null when the post is not a
 * report or cannot be resolved to a played match. Null is the signal for the
 * page to fall back to the ordinary post layout.
 */
export function buildMatchReport(
  front: ReportFrontmatter,
  data: FixturesData,
  players: PlayersData,
  now: Date,
): MatchReport | null {
  const found = findMatch(data, front.matchId);
  if (!found || !isPlayed(found)) return null;
  const match: PlayedMatch = found;

  const result = outcome(match);
  if (!result) return null;

  const us = getClub(data, OUR_SLUG);
  const opponent = getClub(data, match.opponentSlug);

  const home: ReportSide = match.isHome
    ? { slug: OUR_SLUG, club: us, score: match.homeScore, isUs: true }
    : { slug: match.opponentSlug, club: opponent, score: match.homeScore, isUs: false };
  const away: ReportSide = match.isHome
    ? { slug: match.opponentSlug, club: opponent, score: match.awayScore, isUs: false }
    : { slug: OUR_SLUG, club: us, score: match.awayScore, isUs: true };

  const goals: ReportGoalView[] = (front.goals ?? [])
    .map((goal, index) => ({
      index,
      view: {
        team: goal.team ?? "us",
        minute: goal.minute ?? null,
        scorer: goal.scorer,
        assist: goal.assist ?? null,
        detail: goal.detail ?? null,
      } satisfies ReportGoalView,
    }))
    // Stable: untimed goals go last, and ties keep the order they were written in
    .sort((a, b) => {
      const am = a.view.minute ?? Number.POSITIVE_INFINITY;
      const bm = b.view.minute ?? Number.POSITIVE_INFINITY;
      return am - bm || a.index - b.index;
    })
    .map((entry) => entry.view);

  const stats = new Map(players.players.map((p) => [normaliseName(p.name), p]));
  const numberOf = (name: string): number | null => stats.get(normaliseName(name))?.number ?? null;

  const ourGoals = goals.filter((g) => g.team === "us");
  const countGoals = (name: string): number =>
    ourGoals.filter((g) => normaliseName(g.scorer) === normaliseName(name)).length;
  const countAssists = (name: string): number =>
    ourGoals.filter((g) => g.assist !== null && normaliseName(g.assist) === normaliseName(name))
      .length;

  const captain = front.lineup?.captain ? normaliseName(front.lineup.captain) : null;
  const toPlayer = (name: string): ReportPlayer => ({
    name,
    number: numberOf(name),
    goalkeeper: stats.get(normaliseName(name))?.goalkeeper ?? false,
    captain: captain !== null && normaliseName(name) === captain,
    goals: countGoals(name),
    assists: countAssists(name),
  });

  return {
    match,
    home,
    away,
    opponent,
    result,
    goals,
    motm: front.motm
      ? {
          name: front.motm.player,
          reason: front.motm.reason ?? null,
          number: numberOf(front.motm.player),
        }
      : null,
    lineup: front.lineup
      ? {
          starters: front.lineup.starters.map(toPlayer),
          bench: (front.lineup.bench ?? []).map(toPlayer),
        }
      : null,
    form: formAsOf(data, match),
    next: nextMatch(data, now),
  };
}

/**
 * Everything wrong with a report's frontmatter, as plain sentences that say
 * what is wrong and what to do. An empty array means it is fine.
 *
 * This is the safety net behind `npm run validate:reports`. The site renders
 * per request, so without it a misspelt scorer would only be noticed by a
 * visitor. `roster` is the list of names in src/data/roster.json.
 */
export function validateReport(
  front: ReportFrontmatter,
  data: FixturesData,
  roster: string[],
): string[] {
  const problems: string[] = [];
  const match = findMatch(data, front.matchId);

  if (!match) {
    problems.push(
      `matchId "${front.matchId ?? ""}" is not in src/data/fixtures.json. Copy the id from the match's entry in the matches list.`,
    );
    return problems;
  }
  if (!isPlayed(match)) {
    problems.push(
      `Match ${match.id} has no final score yet, so there is nothing to report on. VMSL can post results a day or two late. Add the score to src/data/fixtures.json by hand (see src/data/README.md), or wait for the next scrape.`,
    );
    return problems;
  }

  const known = new Set(roster.map(normaliseName));
  const checkName = (name: string, where: string): void => {
    if (!known.has(normaliseName(name))) {
      problems.push(
        `${where}: "${name}" is not in src/data/roster.json. Fix the spelling, or add the player to the roster first.`,
      );
    }
  };

  const goals = front.goals ?? [];
  const ours = goals.filter((g) => (g.team ?? "us") === "us");
  const theirs = goals.filter((g) => g.team === "them");

  if (goals.length > 0) {
    const expected = ourScore(match);
    if (ours.length !== expected) {
      problems.push(
        `goals lists ${ours.length} South Van goal${ours.length === 1 ? "" : "s"} but the final score has ${expected}. Add or remove entries so they agree.`,
      );
    }
    const conceded = theirScore(match);
    if (theirs.length > 0 && theirs.length !== conceded) {
      problems.push(
        `goals lists ${theirs.length} opponent goal${theirs.length === 1 ? "" : "s"} but the final score has ${conceded}. List all of them or none.`,
      );
    }
  }

  ours.forEach((goal, i) => {
    checkName(goal.scorer, `goals (South Van goal ${i + 1}) scorer`);
    if (goal.assist) {
      checkName(goal.assist, `goals (South Van goal ${i + 1}) assist`);
      if (normaliseName(goal.assist) === normaliseName(goal.scorer)) {
        problems.push(
          `goals (South Van goal ${i + 1}): ${goal.scorer} is listed as both scorer and assist. Remove the assist.`,
        );
      }
    }
  });

  if (front.motm) checkName(front.motm.player, "motm player");

  if (front.lineup) {
    const { captain, starters, bench = [] } = front.lineup;
    starters.forEach((name) => checkName(name, "lineup starters"));
    bench.forEach((name) => checkName(name, "lineup bench"));

    const inLineup = new Set([...starters, ...bench].map(normaliseName));

    const seen = new Set<string>();
    for (const name of [...starters, ...bench]) {
      const key = normaliseName(name);
      if (seen.has(key)) {
        problems.push(`lineup: "${name}" appears more than once. Each player goes in starters or bench, not both.`);
      }
      seen.add(key);
    }

    if (captain) {
      checkName(captain, "lineup captain");
      if (!inLineup.has(normaliseName(captain))) {
        problems.push(`lineup: captain "${captain}" is not in starters or bench. Add them, or fix the name.`);
      }
    }
    if (front.motm && !inLineup.has(normaliseName(front.motm.player))) {
      problems.push(
        `motm: "${front.motm.player}" is not in the lineup. Add them to starters or bench, or fix the name.`,
      );
    }
    const reported = new Set<string>();
    for (const goal of ours) {
      const key = normaliseName(goal.scorer);
      if (inLineup.has(key) || reported.has(key)) continue;
      reported.add(key);
      problems.push(
        `goals: "${goal.scorer}" scored but is not in the lineup. Add them to starters or bench, or fix the name.`,
      );
    }
  }

  return problems;
}
