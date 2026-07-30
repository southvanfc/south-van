/*
 * Proposes updates to src/data/fixtures.json from vmslsoccer.com.
 *
 *   npm run scrape:vmsl -- --dry-run
 *   npm run scrape:vmsl -- --verbose
 *   npm run scrape:vmsl -- --allow-empty-season
 *
 * READ THIS BEFORE CHANGING ANYTHING HERE.
 *
 * fixtures.json is hand maintained and is the source of truth. This script is a
 * convenience that suggests changes, never the system of record. So it is built
 * to fail safe: every failure path leaves the existing file exactly as it was,
 * and a run that cannot prove its own output is sound writes nothing at all. A
 * stale page is a small problem. A page silently overwritten with an empty or
 * wrong table is a much bigger one.
 *
 * The site never fetches VMSL. This script writes a file, the site reads the
 * file, and that is the whole contract. Delete this script tomorrow and the
 * site keeps working.
 *
 * VMSL have no API and none of this is supported by them, so assume it will
 * break eventually. The checks below are there to make that break loud.
 *
 * Note on robots.txt: vmslsoccer.com disallows /webapps, which is every
 * endpoint used here. This is written to be run by hand by a club member, with
 * VMSL's agreement, not on an unattended schedule. Keep it that way until that
 * agreement is in writing and robots.txt says so too.
 */

import { readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import type { Club, FixturesData, Match, StandingsRow } from "../src/types/types";
import { OUR_SLUG, isPlayed, outcome, seasonSummary } from "../src/lib/fixtures.ts";
import {
  deriveTag,
  findPoolForTeam,
  matchesOutsideSeason,
  normaliseMatches,
  parseSchedule,
  parseStandings,
  placeholderColour,
  seasonWindow,
  slugify,
  stripNewPrefix,
  type RawStandingsRow,
} from "./vmsl-parse.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA_PATH = path.join(ROOT, "src", "data", "fixtures.json");
const VALIDATOR_PATH = path.join(ROOT, "scripts", "validate-fixtures.ts");
const DISPLAY_PATH = "src/data/fixtures.json";
const BASE = "https://vmslsoccer.com/webapps/spappz_live";

/* ------------------------------------------------------------------ */
/* Config                                                              */
/* ------------------------------------------------------------------ */

interface Config {
  season: string;
  regYear: number;
  division: string;
  divisionLabel: string;
  teamName: string;
  teamId: string;
  homeVenue: string;
  userAgent: string;
}

function loadConfig(configPath: string): Config {
  let raw: string;
  try {
    raw = readFileSync(configPath, "utf8");
  } catch {
    throw new Error(`Could not read the config at ${configPath}.`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(
      `${configPath} is not valid JSON. ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error(`${configPath} should contain a single object wrapped in { }.`);
  }

  const value = parsed as Record<string, unknown>;
  const text = (key: keyof Config): string => {
    const found = value[key];
    if (typeof found !== "string" || found.trim() === "") {
      throw new Error(`${configPath} is missing "${key}", which must be a non empty string.`);
    }
    return found;
  };

  const regYear = value["regYear"];
  if (typeof regYear !== "number" || !Number.isInteger(regYear)) {
    throw new Error(`${configPath} is missing "regYear", which must be a whole number like 2027.`);
  }

  const config: Config = {
    season: text("season"),
    regYear,
    division: text("division"),
    divisionLabel: text("divisionLabel"),
    teamName: text("teamName"),
    teamId: text("teamId"),
    homeVenue: text("homeVenue"),
    userAgent: text("userAgent"),
  };

  /*
   * reg_year is the season END year: reg_year=2027 is season 2026-27. Getting
   * this wrong at the August rollover scrapes last season and republishes it as
   * this season, with no error anywhere. season and regYear are deliberately
   * redundant in the config so that mistake cannot pass quietly, and the match
   * date range check later is the second line of defence.
   */
  const expectedSeason = `${config.regYear - 1}-${String(config.regYear).slice(-2)}`;
  if (config.season !== expectedSeason) {
    throw new Error(
      `Config mismatch: regYear ${config.regYear} means season "${expectedSeason}", but season says "${config.season}".\n` +
        `  regYear is the season END year, so 2026-27 is regYear 2027.\n` +
        `  Fix whichever of the two is wrong in ${path.relative(ROOT, configPath)}.`,
    );
  }

  return config;
}

/* ------------------------------------------------------------------ */
/* Arguments                                                           */
/* ------------------------------------------------------------------ */

interface Options {
  dryRun: boolean;
  verbose: boolean;
  allowEmptySeason: boolean;
  configPath: string;
}

function parseArgs(argv: string[]): Options {
  const options: Options = {
    dryRun: false,
    verbose: false,
    allowEmptySeason: false,
    configPath: path.join(ROOT, "scripts", "vmsl.config.json"),
  };

  for (const arg of argv) {
    if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--verbose") options.verbose = true;
    else if (arg === "--allow-empty-season") options.allowEmptySeason = true;
    else if (arg.startsWith("--config=")) {
      options.configPath = path.resolve(ROOT, arg.slice("--config=".length));
    } else {
      throw new Error(
        `Unknown option "${arg}". Valid options are --dry-run, --verbose, --allow-empty-season and --config=<path>.`,
      );
    }
  }

  return options;
}

/* ------------------------------------------------------------------ */
/* Fetching                                                            */
/* ------------------------------------------------------------------ */

const RATE_LIMIT_MS = 1000;
let lastRequestAt = 0;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * One GET, rate limited to at most one request per second and retried twice
 * with backoff. Two requests per run against someone else's unpaid server is
 * already polite; the delay keeps it that way.
 */
async function get(url: string, userAgent: string, verbose: boolean): Promise<string> {
  const attempts = 3;
  let lastError = "";

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const wait = Math.max(0, lastRequestAt + RATE_LIMIT_MS - Date.now());
    if (wait > 0) await sleep(wait);
    lastRequestAt = Date.now();

    if (verbose) console.log(`  GET ${url}${attempt > 1 ? ` (attempt ${attempt})` : ""}`);

    try {
      const response = await fetch(url, { headers: { "User-Agent": userAgent } });
      if (response.ok) return await response.text();
      lastError = `HTTP ${response.status} ${response.statusText}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }

    if (attempt < attempts) {
      const backoff = 2000 * attempt;
      console.warn(`  Request failed (${lastError}), retrying in ${backoff / 1000}s.`);
      await sleep(backoff);
    }
  }

  throw new Error(`Gave up on ${url} after ${attempts} attempts. Last error: ${lastError}`);
}

/* ------------------------------------------------------------------ */
/* Existing file                                                       */
/* ------------------------------------------------------------------ */

function readExisting(): FixturesData {
  let raw: string;
  try {
    raw = readFileSync(DATA_PATH, "utf8");
  } catch {
    throw new Error(
      `Could not read ${DISPLAY_PATH}. This script proposes changes to that file, so it has to exist first.`,
    );
  }

  try {
    return JSON.parse(raw) as FixturesData;
  } catch (error) {
    throw new Error(
      `${DISPLAY_PATH} is not valid JSON, so there is nothing safe to compare against. ` +
        `Fix it by hand first. ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/* ------------------------------------------------------------------ */
/* Club resolution                                                     */
/* ------------------------------------------------------------------ */

/**
 * Resolves VMSL club names onto our own club records.
 *
 * Clubs already in fixtures.json keep the name, tag, colour and crest a human
 * chose. Only genuinely new clubs get invented values, and those are listed in
 * the run summary so someone can improve on them. Clubs are never removed,
 * because history entries still point at them.
 */
class ClubRegistry {
  private readonly bySlug = new Map<string, Club>();
  private readonly byVmslName = new Map<string, Club>();
  readonly added: Club[] = [];

  constructor(existing: Club[]) {
    for (const club of existing) {
      this.bySlug.set(club.slug, club);
      this.byVmslName.set((club.vmslName ?? club.name).toLowerCase(), club);
    }
  }

  /** The slug for a VMSL club name, registering the club if it is new. */
  slugFor(vmslName: string): string {
    const cleaned = stripNewPrefix(vmslName);
    const known = this.byVmslName.get(cleaned.toLowerCase());
    if (known) return known.slug;

    // A club we hold under the same slug but without a matching vmslName. Adopt
    // it rather than creating a near duplicate.
    const slug = slugify(cleaned);
    const bySlug = this.bySlug.get(slug);
    if (bySlug) {
      const updated: Club = { ...bySlug, vmslName: cleaned };
      this.bySlug.set(slug, updated);
      this.byVmslName.set(cleaned.toLowerCase(), updated);
      return slug;
    }

    const club: Club = {
      name: cleaned,
      vmslName: cleaned,
      tag: deriveTag(cleaned),
      slug,
      colour: placeholderColour(slug),
    };
    this.bySlug.set(slug, club);
    this.byVmslName.set(cleaned.toLowerCase(), club);
    this.added.push(club);
    return slug;
  }

  all(): Club[] {
    return [...this.bySlug.values()];
  }
}

/* ------------------------------------------------------------------ */
/* Standings                                                           */
/* ------------------------------------------------------------------ */

/**
 * Our last five league results, oldest first. This is derived rather than
 * scraped because VMSL's standings table has no form column: it publishes Pos,
 * Team, GP, W, D, L, GF, GA, GD and PTS and nothing else. The same derivation
 * runs in validate-fixtures.ts, and the two have to agree or the file will not
 * validate.
 */
function deriveForm(matches: Match[]): string {
  return matches
    .filter((match) => match.competition === "league")
    .filter(isPlayed)
    .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`))
    .map((match) => outcome(match) ?? "")
    .slice(-5)
    .join("");
}

function buildStandings(
  rows: RawStandingsRow[],
  clubs: ClubRegistry,
  matches: Match[],
  existing: StandingsRow[],
): StandingsRow[] {
  const previousForm = new Map(existing.map((row) => [row.clubSlug, row.form]));

  return rows.map((row) => {
    const clubSlug = clubs.slugFor(row.team);
    /*
     * Our own form comes from our own results. For every other club we keep
     * whatever a human last entered, because VMSL does not publish form and
     * blanking it would throw away their work. It is left empty for a club we
     * have never seen before.
     */
    const form = clubSlug === OUR_SLUG ? deriveForm(matches) : previousForm.get(clubSlug) ?? "";

    return {
      clubSlug,
      played: row.played,
      won: row.won,
      drawn: row.drawn,
      lost: row.lost,
      goalsFor: row.goalsFor,
      goalsAgainst: row.goalsAgainst,
      form,
    };
  });
}

/* ------------------------------------------------------------------ */
/* Reconciliation                                                      */
/* ------------------------------------------------------------------ */

/** A match id VMSL issued, as opposed to one typed in by hand. */
function isVmslId(id: string): boolean {
  return /^\d+$/.test(id);
}

interface Reconciled {
  matches: Match[];
  history: Match[];
  notes: string[];
}

/**
 * Merge scraped matches with what is already in the file.
 *
 * Matches reconcile on VMSL's sched_seq_no, never on date plus opponent, which
 * stops working the first time a match is rescheduled. Matches held under a
 * hand written id are kept, since they were entered before VMSL published them,
 * unless VMSL has now published the same fixture and superseded them.
 */
function reconcile(
  existing: FixturesData,
  scraped: Match[],
  config: Config,
): Reconciled {
  const notes: string[] = [];
  const rollover = existing.season !== config.season;

  let history = [...existing.history];
  let priorMatches = existing.matches;

  if (rollover) {
    /*
     * A new season. Completed matches from the finished season move into
     * history so head to head records survive, and the current season starts
     * from whatever VMSL has published.
     */
    const completed = existing.matches.filter(isPlayed);
    history = [...history, ...completed];
    priorMatches = [];
    notes.push(
      `Season rollover: the file holds "${existing.season}" and the config asks for "${config.season}". ` +
        `${completed.length} completed match${completed.length === 1 ? "" : "es"} moved into history.`,
    );
  }

  const scrapedIds = new Set(scraped.map((match) => match.id));
  const scrapedKeys = new Set(scraped.map((match) => `${match.date}|${match.opponentSlug}`));

  const handEntered = priorMatches.filter((match) => !isVmslId(match.id));
  const kept = handEntered.filter((match) => {
    const superseded = scrapedKeys.has(`${match.date}|${match.opponentSlug}`);
    if (superseded) {
      notes.push(
        `Hand entered match "${match.id}" (${match.date} v ${match.opponentSlug}) has been superseded by VMSL's own record and dropped.`,
      );
    }
    return !superseded;
  });

  if (kept.length > 0) {
    notes.push(
      `${kept.length} hand entered match${kept.length === 1 ? "" : "es"} kept, since VMSL has not published ${kept.length === 1 ? "it" : "them"} yet.`,
    );
  }

  const dropped = priorMatches.filter(
    (match) => isVmslId(match.id) && !scrapedIds.has(match.id),
  );
  if (dropped.length > 0) {
    notes.push(
      `${dropped.length} match${dropped.length === 1 ? "" : "es"} in the file ${dropped.length === 1 ? "is" : "are"} no longer on VMSL: ${dropped.map((match) => match.id).join(", ")}.`,
    );
  }

  const matches = [...scraped, ...kept].sort((a, b) =>
    `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`),
  );

  return { matches, history, notes };
}

/* ------------------------------------------------------------------ */
/* Checks                                                              */
/* ------------------------------------------------------------------ */

/**
 * Everything that has to hold before this script is allowed to touch the file.
 * Each of these turns a plausible looking wrong answer into a loud failure,
 * which is the only reason it is safe to run this against a hand maintained
 * file at all.
 */
function runChecks(
  candidate: FixturesData,
  existing: FixturesData,
  config: Config,
  claimedCount: number | null,
  parsedCount: number,
  poolRowCount: number,
  options: Options,
): string[] {
  const problems: string[] = [];

  /* VMSL's own footer count, the cheapest integrity check available. */
  if (claimedCount !== null && claimedCount !== parsedCount) {
    problems.push(
      `VMSL's footer says ${claimedCount} records but ${parsedCount} were parsed. ` +
        `That gap means the page layout changed, so the parse can no longer be trusted.`,
    );
  }

  /* Volume. */
  if (parsedCount === 0) {
    if (!options.allowEmptySeason) {
      problems.push(
        `No matches were found for season ${config.season} (reg_year ${config.regYear}). ` +
          `Mid season that means something has broken. If the season genuinely is not published yet, ` +
          `re-run with --allow-empty-season.`,
      );
    }
  } else if (parsedCount < 10) {
    problems.push(
      `Only ${parsedCount} matches were parsed, and a full season is at least 18 league games. ` +
        `A partial parse is treated as breakage, not as a short season. ` +
        `--allow-empty-season covers a season with no fixtures at all, not a half read one.`,
    );
  }

  /* Standings. */
  if (parsedCount > 0 || poolRowCount > 0) {
    if (poolRowCount < 6) {
      problems.push(
        `The standings table has ${poolRowCount} clubs, and a VMSL division pool has around 10. ` +
          `Fewer than 6 means the table did not parse.`,
      );
    }
    if (!candidate.standings.some((row) => row.clubSlug === OUR_SLUG)) {
      problems.push(
        `South Van FC is not in the parsed standings. The pool is derived by finding team ` +
          `${config.teamId} in division ${config.division}, so either the team id is wrong or ` +
          `the club has moved division.`,
      );
    }
  }

  /* Per match integrity. */
  for (const match of candidate.matches) {
    const where = `Match ${match.id} (${match.date || "no date"})`;

    if (!match.date) problems.push(`${where} has no date.`);
    if (!match.time) problems.push(`${where} has no kickoff time.`);
    if (!match.opponentSlug) problems.push(`${where} has no opponent.`);

    const homeSet = match.homeScore !== null;
    const awaySet = match.awayScore !== null;
    if (homeSet !== awaySet) {
      problems.push(
        `${where} has one score filled in and the other null. A match has both or neither.`,
      );
    }
  }

  /*
   * The reg_year off by one check. reg_year is the season END year, so asking
   * for 2027 and getting matches dated 2025 means last season was scraped and
   * is about to be republished as this one. Nothing else would notice: the
   * fixtures parse, the footer count agrees and the table looks entirely sane.
   */
  const strays = matchesOutsideSeason(candidate.matches, config.regYear);
  if (strays.length > 0) {
    const { start, end } = seasonWindow(config.regYear);
    const listed = strays.slice(0, 5).map((match) => `${match.id} on ${match.date}`).join(", ");
    problems.push(
      `${strays.length} match${strays.length === 1 ? "" : "es"} fall outside season ${config.season}, ` +
        `which runs ${start} to ${end}: ${listed}${strays.length > 5 ? ", and more" : ""}. ` +
        `reg_year is the season END year, so reg_year ${config.regYear} means ${config.season}. ` +
        `If every match is a year out, the config is pointing at the wrong season.`,
    );
  }

  /* Nothing below this line is meaningful before the season starts. */
  if (candidate.matches.length === 0) return problems;

  /* The derived record has to agree with the published table. */
  const summary = seasonSummary(candidate);
  const ourRow = candidate.standings.find((row) => row.clubSlug === OUR_SLUG);
  if (ourRow) {
    const comparisons: Array<[string, number, number]> = [
      ["played", summary.played, ourRow.played],
      ["won", summary.won, ourRow.won],
      ["drawn", summary.drawn, ourRow.drawn],
      ["lost", summary.lost, ourRow.lost],
      ["goalsFor", summary.goalsFor, ourRow.goalsFor],
      ["goalsAgainst", summary.goalsAgainst, ourRow.goalsAgainst],
    ];
    const mismatches = comparisons
      .filter(([, derived, published]) => derived !== published)
      .map(([field, derived, published]) => `${field}: table says ${published}, results give ${derived}`);

    if (mismatches.length > 0) {
      problems.push(
        `The scraped results and VMSL's own standings row for South Van FC disagree (${mismatches.join("; ")}). ` +
          `Either a scoreline was read the wrong way round, or VMSL's table has not caught up with a result yet. ` +
          `Check the fixtures above against vmslsoccer.com before forcing this through by hand.`,
      );
    }
  }

  /* Do not quietly delete a season. */
  const existingVmslMatches = existing.matches.filter((match) => isVmslId(match.id));
  if (existingVmslMatches.length > 0 && existing.season === config.season) {
    const survivingIds = new Set(candidate.matches.map((match) => match.id));
    const removed = existingVmslMatches.filter((match) => !survivingIds.has(match.id));
    const share = removed.length / existingVmslMatches.length;
    if (share > 0.25) {
      problems.push(
        `This run would remove ${removed.length} of ${existingVmslMatches.length} existing matches ` +
          `(${Math.round(share * 100)} percent), which is more than the 25 percent that is ever plausible. ` +
          `Removed ids: ${removed.map((match) => match.id).join(", ")}.`,
      );
    }
  }

  /*
   * The check that protects manual edits. A result already recorded should
   * never change underneath someone. Corrections do happen, but they are rare
   * enough to be worth a human look rather than a silent rewrite.
   */
  const candidateById = new Map(candidate.matches.map((match) => [match.id, match]));
  for (const before of existing.matches) {
    if (!isPlayed(before)) continue;
    const after = candidateById.get(before.id);
    if (!after) continue;
    if (after.homeScore === before.homeScore && after.awayScore === before.awayScore) continue;

    problems.push(
      `Match ${before.id} (${before.date} v ${before.opponentSlug}) is recorded as ` +
        `${before.homeScore}-${before.awayScore} but VMSL now says ` +
        `${after.homeScore ?? "null"}-${after.awayScore ?? "null"}. ` +
        `Played results are not overwritten automatically. If VMSL is right, edit ${DISPLAY_PATH} by hand.`,
    );
  }

  return problems;
}

/* ------------------------------------------------------------------ */
/* Serialising                                                         */
/* ------------------------------------------------------------------ */

/**
 * Writes the file the way a person would: 2 space indent, keys in the order the
 * interfaces declare them, optional keys left out when unset. Stable output
 * keeps week to week diffs down to the lines that actually changed, which is
 * what makes reviewing a scrape quick.
 */
function serialise(data: FixturesData): string {
  const club = (value: Club): Club => pick(value, ["name", "vmslName", "tag", "slug", "colour", "crest"]);
  const match = (value: Match): Match =>
    pick(value, [
      "id",
      "date",
      "time",
      "opponentSlug",
      "isHome",
      "venue",
      "competition",
      "competitionLabel",
      "homeScore",
      "awayScore",
      "status",
      "note",
    ]);
  const standings = (value: StandingsRow): StandingsRow =>
    pick(value, ["clubSlug", "played", "won", "drawn", "lost", "goalsFor", "goalsAgainst", "form"]);

  const ordered = {
    season: data.season,
    division: data.division,
    updatedAt: data.updatedAt,
    clubs: data.clubs.map(club),
    matches: data.matches.map(match),
    standings: data.standings.map(standings),
    history: data.history.map(match),
  };

  return `${JSON.stringify(ordered, null, 2)}\n`;
}

/** Rebuild an object with its keys in a fixed order, dropping unset ones. */
function pick<T extends object>(value: T, keys: Array<keyof T>): T {
  const result: Partial<T> = {};
  for (const key of keys) {
    if (value[key] !== undefined) result[key] = value[key];
  }
  return result as T;
}

/** An ISO timestamp in Vancouver local time, matching what is in the file already. */
function vancouverTimestamp(now: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Vancouver",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
    timeZoneName: "longOffset",
  }).formatToParts(now);

  const part = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((piece) => piece.type === type)?.value ?? "00";

  const hour = part("hour") === "24" ? "00" : part("hour");
  const offset = part("timeZoneName").replace("GMT", "") || "+00:00";
  return `${part("year")}-${part("month")}-${part("day")}T${hour}:${part("minute")}:${part("second")}${offset}`;
}

/* ------------------------------------------------------------------ */
/* Diff reporting                                                      */
/* ------------------------------------------------------------------ */

function describeMatch(match: Match): string {
  const side = match.isHome ? "v" : "away to";
  const score =
    match.homeScore !== null && match.awayScore !== null
      ? ` ${match.homeScore}-${match.awayScore}`
      : "";
  const status = match.status ? ` [${match.status}]` : "";
  return `${match.date} ${match.time} ${side} ${match.opponentSlug}${score}${status}`;
}

function reportDiff(existing: FixturesData, candidate: FixturesData): string[] {
  const lines: string[] = [];
  const before = new Map(existing.matches.map((match) => [match.id, match]));
  const after = new Map(candidate.matches.map((match) => [match.id, match]));

  for (const [id, match] of after) {
    const previous = before.get(id);
    if (!previous) {
      lines.push(`  + ${id} ${describeMatch(match)}`);
      continue;
    }
    const changes: string[] = [];
    if (previous.date !== match.date || previous.time !== match.time) {
      changes.push(`${previous.date} ${previous.time} to ${match.date} ${match.time}`);
    }
    if (previous.venue !== match.venue) changes.push(`venue "${previous.venue}" to "${match.venue}"`);
    if (previous.homeScore !== match.homeScore || previous.awayScore !== match.awayScore) {
      changes.push(
        `score ${previous.homeScore ?? "none"}-${previous.awayScore ?? "none"} to ${match.homeScore ?? "none"}-${match.awayScore ?? "none"}`,
      );
    }
    if (previous.status !== match.status) {
      changes.push(`status ${previous.status ?? "none"} to ${match.status ?? "none"}`);
    }
    if ((previous.note ?? "") !== (match.note ?? "")) changes.push("note");
    if (previous.competitionLabel !== match.competitionLabel) changes.push("competition label");
    if (changes.length > 0) lines.push(`  ~ ${id} ${describeMatch(match)}: ${changes.join(", ")}`);
  }

  for (const [id, match] of before) {
    if (!after.has(id)) lines.push(`  - ${id} ${describeMatch(match)}`);
  }

  const standingsBefore = new Map(existing.standings.map((row) => [row.clubSlug, row]));
  for (const row of candidate.standings) {
    const previous = standingsBefore.get(row.clubSlug);
    if (!previous) {
      lines.push(`  + standings ${row.clubSlug} P${row.played} W${row.won} D${row.drawn} L${row.lost}`);
    } else if (
      previous.played !== row.played ||
      previous.won !== row.won ||
      previous.drawn !== row.drawn ||
      previous.lost !== row.lost ||
      previous.goalsFor !== row.goalsFor ||
      previous.goalsAgainst !== row.goalsAgainst ||
      previous.form !== row.form
    ) {
      lines.push(
        `  ~ standings ${row.clubSlug} P${previous.played} W${previous.won} D${previous.drawn} L${previous.lost} GF${previous.goalsFor} GA${previous.goalsAgainst} "${previous.form}"` +
          ` to P${row.played} W${row.won} D${row.drawn} L${row.lost} GF${row.goalsFor} GA${row.goalsAgainst} "${row.form}"`,
      );
    }
  }

  return lines;
}

/* ------------------------------------------------------------------ */
/* Main                                                                */
/* ------------------------------------------------------------------ */

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const config = loadConfig(options.configPath);
  const existing = readExisting();

  console.log(
    `\nVMSL scrape: season ${config.season} (reg_year ${config.regYear}), division ${config.division}, team ${config.teamName} (${config.teamId}).`,
  );
  if (options.dryRun) console.log("Dry run. Nothing will be written.\n");
  else console.log("");

  /* Fetch. Two requests, one second apart. */
  const scheduleUrl = `${BASE}/team_page?reg_year=${config.regYear}&id=${config.teamId}&cmd=htmlsched`;
  // sched_pool is deliberately left empty so every pool comes back at once and
  // the pool can be derived rather than hardcoded. firsttime=1 is required, and
  // without it the form short circuits and returns an empty page.
  const standingsUrl = `${BASE}/div_stats?reg_year=${config.regYear}&division=${config.division}&sched_pool=&sched_type=reg&firsttime=1`;

  const scheduleHtml = await get(scheduleUrl, config.userAgent, options.verbose);
  const standingsHtml = await get(standingsUrl, config.userAgent, options.verbose);

  /* Parse. */
  const schedule = parseSchedule(scheduleHtml);
  const pools = parseStandings(standingsHtml);
  const ourPool = findPoolForTeam(pools, config.teamId);

  if (!ourPool && (schedule.fixtures.length > 0 || pools.length > 0)) {
    throw new Error(
      `Team ${config.teamId} was not found in any pool of division ${config.division} for ${config.season}. ` +
        `Pools seen: ${pools.map((pool) => `${pool.pool} (${pool.rows.length} clubs)`).join(", ") || "none"}. ` +
        `Pools are reshuffled every season by promotion and relegation, so check which division the club is in.`,
    );
  }

  if (ourPool) {
    console.log(`Pool ${ourPool.pool} derived from team ${config.teamId}'s place in the division.`);
  }

  /* Normalise. */
  const clubs = new ClubRegistry(existing.clubs);
  const ourClub = existing.clubs.find((club) => club.slug === OUR_SLUG);
  if (!ourClub) {
    throw new Error(
      `${DISPLAY_PATH} has no club with slug "${OUR_SLUG}", so there is nothing to attach results to.`,
    );
  }

  const { matches: scraped, warnings } = normaliseMatches(schedule.fixtures, {
    teamName: config.teamName,
    divisionLabel: config.divisionLabel,
    slugFor: (vmslName) => clubs.slugFor(vmslName),
  });
  const { matches, history, notes } = reconcile(existing, scraped, config);
  const standings = ourPool ? buildStandings(ourPool.rows, clubs, matches, existing.standings) : [];

  if (options.verbose) {
    console.log(`\n${matches.length} matches:`);
    for (const match of matches) console.log(`  ${match.id} ${describeMatch(match)}`);
    console.log("");
  }

  const candidate: FixturesData = {
    season: config.season,
    division: config.divisionLabel,
    updatedAt: existing.updatedAt,
    clubs: clubs.all(),
    matches,
    standings,
    history,
  };

  /* Checks. */
  const problems = runChecks(
    candidate,
    existing,
    config,
    schedule.claimedCount,
    schedule.fixtures.length,
    ourPool?.rows.length ?? 0,
    options,
  );

  if (problems.length > 0) {
    console.error(`\nThe scrape was rejected. ${DISPLAY_PATH} has not been changed.\n`);
    for (const problem of problems) console.error(`  x ${problem}\n`);
    process.exit(1);
  }

  /*
   * The pre season case. Zero matches with the flag set is a real outcome, not
   * a failure, but it must never replace a populated file with an empty one.
   * This returns before the reconciliation notes are printed, because "these
   * matches are no longer on VMSL" is true but misleading when the answer is
   * simply that nothing has been published yet.
   */
  if (schedule.fixtures.length === 0) {
    console.log(
      `\nSeason ${config.season} is not published yet. VMSL returned no fixtures, which is expected before ` +
        `the schedule is released, usually mid to late August.`,
    );
    if (existing.matches.length > 0) {
      console.log(
        `${DISPLAY_PATH} already holds ${existing.matches.length} matches and has been left alone.\n`,
      );
      return;
    }
    console.log("The existing file is empty too, so there is nothing to change.\n");
    return;
  }

  for (const warning of [...warnings, ...notes]) console.log(`  ! ${warning}`);

  /*
   * updatedAt only moves when something else did, so a run that finds no news
   * produces no diff at all rather than a one line timestamp change.
   */
  const unchanged = serialise({ ...candidate, updatedAt: existing.updatedAt }) === serialise(existing);
  if (!unchanged) candidate.updatedAt = vancouverTimestamp(new Date());

  const diff = reportDiff(existing, candidate);
  const played = matches.filter(isPlayed).length;
  const upcoming = matches.length - played;

  if (clubs.added.length > 0) {
    console.log(`\n${clubs.added.length} new club${clubs.added.length === 1 ? "" : "s"} added, please check the tag and colour:`);
    for (const club of clubs.added) {
      console.log(`  ${club.slug}: name "${club.name}", tag "${club.tag}", colour ${club.colour}`);
    }
  }

  const awayHome = matches.filter(
    (match) => match.isHome && match.venue && match.venue !== config.homeVenue,
  ).length;
  if (awayHome > 0) {
    console.log(
      `\n${awayHome} home match${awayHome === 1 ? "" : "es"} ${awayHome === 1 ? "is" : "are"} at a venue other than the configured "${config.homeVenue}". VMSL's venue has been used.`,
    );
  }

  if (diff.length > 0) {
    console.log(`\nChanges against ${DISPLAY_PATH}:`);
    for (const line of diff) console.log(line);
  } else {
    console.log(`\nNo changes against ${DISPLAY_PATH}.`);
  }

  /*
   * The shared validator has the last word, so scraped data is held to exactly
   * the standard a hand edit is. It runs against a temporary file, and the real
   * one is only replaced once it passes.
   */
  const candidateJson = serialise(candidate);
  const tempPath = path.join(ROOT, "src", "data", ".fixtures.candidate.json");
  writeFileSync(tempPath, candidateJson, "utf8");

  const validation = spawnSync(process.execPath, [VALIDATOR_PATH, tempPath], { stdio: "inherit" });
  unlinkSync(tempPath);

  if (validation.status !== 0) {
    console.error(
      `\nThe proposed file did not pass validate-fixtures. ${DISPLAY_PATH} has not been changed.\n`,
    );
    process.exit(1);
  }

  if (options.dryRun) {
    console.log(`Dry run, so ${DISPLAY_PATH} was not written.`);
  } else if (unchanged) {
    console.log(`${DISPLAY_PATH} is already up to date, so it was not rewritten.`);
  } else {
    writeFileSync(DATA_PATH, candidateJson, "utf8");
    console.log(`Wrote ${DISPLAY_PATH}.`);
  }

  console.log(
    `\n${matches.length} matches (${played} played, ${upcoming} upcoming), ${standings.length} standings rows, ` +
      `${candidate.clubs.length} clubs, ${history.length} in history, ${diff.length} change${diff.length === 1 ? "" : "s"}.\n`,
  );
}

main().catch((error: unknown) => {
  console.error(`\nScrape failed. ${DISPLAY_PATH} has not been changed.\n`);
  console.error(`  ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
