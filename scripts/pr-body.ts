/*
 * Turns a scrape log into the body of the fixture refresh pull request.
 *
 *   node scripts/pr-body.ts <path to scrape log> > body.md
 *
 * The scraper already prints a line per change against src/data/fixtures.json.
 * This reads those lines back and groups them the way a reviewer reads them:
 * results first, then new fixtures, then moved kickoffs and venues, then the
 * table. Nothing here is a second source of truth. If a line cannot be parsed
 * it is passed through as the scraper wrote it rather than dropped, because a
 * change nobody can see is worse than an ugly bullet.
 *
 * Club names and venues are looked up in fixtures.json so the body reads in
 * English rather than in slugs. The scrape has already been written to disk by
 * the time this runs, so that lookup describes the proposed state, which is
 * what the pull request is asking to merge.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import type { Club, FixturesData, Match } from "../src/types/types";
import { OUR_SLUG, sortedStandings } from "../src/lib/fixtures.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA_PATH = path.join(ROOT, "src", "data", "fixtures.json");

/* ------------------------------------------------------------------ */
/* Reading the log                                                     */
/* ------------------------------------------------------------------ */

/**
 * A parsed match line. The scraper writes these as
 * "  ~ 21810 2026-11-22 14:00 v joyous-fc 3-1: score none-none to 3-1",
 * where the description is always the proposed state and anything after the
 * colon is the list of what moved.
 */
interface MatchLine {
  marker: "+" | "~" | "-";
  id: string;
  date: string;
  time: string;
  isHome: boolean;
  slug: string;
  score: string | null;
  status: string | null;
  changes: string;
  raw: string;
}

const MATCH_LINE =
  /^([+~-]) (\S+) (\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}) (v|away to) ([a-z0-9-]+)(?: (\d+-\d+))?(?: \[([^\]]+)\])?(?:: (.*))?$/;

interface ScrapeLog {
  warnings: string[];
  matches: MatchLine[];
  standings: string[];
  unparsed: string[];
  raw: string;
}

function readLog(logPath: string): ScrapeLog {
  const raw = readFileSync(logPath, "utf8");
  const log: ScrapeLog = { warnings: [], matches: [], standings: [], unparsed: [], raw };

  let inDiff = false;
  for (const line of raw.split("\n")) {
    if (line.startsWith("Changes against")) {
      inDiff = true;
      continue;
    }

    if (line.startsWith("  ! ")) {
      log.warnings.push(line.slice(4).trim());
      continue;
    }

    if (!inDiff) continue;

    const body = line.startsWith("  ") ? line.slice(2) : line;
    if (body.trim() === "") continue;

    // The diff block is contiguous. The first line that is not a diff line is
    // the validator starting up, so stop reading rather than guessing.
    if (!/^[+~-] /.test(body)) break;

    if (/^[+~-] standings /.test(body)) {
      log.standings.push(body);
      continue;
    }

    const parsed = MATCH_LINE.exec(body);
    if (!parsed) {
      log.unparsed.push(body);
      continue;
    }

    log.matches.push({
      marker: parsed[1] as MatchLine["marker"],
      id: parsed[2]!,
      date: parsed[3]!,
      time: parsed[4]!,
      isHome: parsed[5] === "v",
      slug: parsed[6]!,
      score: parsed[7] ?? null,
      status: parsed[8] ?? null,
      changes: parsed[9] ?? "",
      raw: body,
    });
  }

  return log;
}

/* ------------------------------------------------------------------ */
/* Naming things                                                       */
/* ------------------------------------------------------------------ */

function clubNames(data: FixturesData): Map<string, string> {
  return new Map(data.clubs.map((club: Club) => [club.slug, club.name]));
}

/** "Sat 22 Nov". The date is stored as a plain day, so it is read as UTC. */
function readableDate(date: string): string {
  const parsed = new Date(`${date}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return date;
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(parsed);
}

function ordinal(value: number): string {
  const tens = value % 100;
  if (tens >= 11 && tens <= 13) return `${value}th`;
  const suffix = ["th", "st", "nd", "rd"][value % 10] ?? "th";
  return `${value}${suffix}`;
}

function signed(value: number): string {
  return value > 0 ? `+${value}` : String(value);
}

/* ------------------------------------------------------------------ */
/* Rendering                                                           */
/* ------------------------------------------------------------------ */

function build(log: ScrapeLog, data: FixturesData): string {
  const names = clubNames(data);
  const name = (slug: string): string => names.get(slug) ?? slug;
  const byId = new Map<string, Match>(
    [...data.matches, ...data.history].map((match: Match) => [match.id, match]),
  );

  /* Slugs in a passed through line read badly, so swap in the club names. */
  const readable = (text: string): string => {
    let result = text;
    for (const [slug, clubName] of names) result = result.split(slug).join(clubName);
    return result;
  };

  const scoreChange = (line: MatchLine): { from: string; to: string } | null => {
    const found = /score (\S+) to (\S+)/.exec(line.changes);
    return found ? { from: found[1]!, to: found[2]! } : null;
  };

  const moved = (line: MatchLine): boolean =>
    /\d{4}-\d{2}-\d{2} \d{2}:\d{2} to /.test(line.changes) || line.changes.includes("venue ");

  /* Home team first, which is how the scores are stored. */
  const scoreline = (line: MatchLine, score: string): string => {
    const opponent = name(line.slug);
    const us = name(OUR_SLUG);
    return line.isHome ? `${us} ${score} ${opponent}` : `${opponent} ${score} ${us}`;
  };

  const fixtureLabel = (line: MatchLine): string => {
    const where = line.isHome ? `v ${name(line.slug)}` : `away to ${name(line.slug)}`;
    const venue = byId.get(line.id)?.venue;
    const competition = byId.get(line.id)?.competitionLabel;
    const parts = [`${readableDate(line.date)}, ${line.time}, ${where}`];
    if (venue) parts.push(venue);
    if (competition && competition !== data.division) parts.push(competition);
    return parts.join(", ");
  };

  const results: string[] = [];
  const added: string[] = [];
  const changed: string[] = [];
  const dropped: string[] = [];

  for (const line of log.matches) {
    if (line.marker === "-") {
      dropped.push(`${readable(line.raw.slice(2))}`);
      continue;
    }

    const score = scoreChange(line);

    if (line.marker === "+") {
      if (line.score) {
        results.push(
          `${readableDate(line.date)}: ${scoreline(line, line.score)}, added already played`,
        );
      } else {
        added.push(fixtureLabel(line));
      }
      continue;
    }

    if (score && line.score) {
      const correction = score.from === "none-none" ? "" : ` (was ${score.from})`;
      results.push(`${readableDate(line.date)}: ${scoreline(line, line.score)}${correction}`);
      if (moved(line)) changed.push(`${fixtureLabel(line)}: ${readable(line.changes)}`);
      continue;
    }

    changed.push(`${fixtureLabel(line)}: ${readable(line.changes)}`);
  }

  const ours = sortedStandings(data).find((row) => row.clubSlug === OUR_SLUG);
  const standingsChanges = log.standings.filter((line) => !line.includes(OUR_SLUG));
  const ourStandingsChange = log.standings.find((line) => line.includes(OUR_SLUG));

  const out: string[] = [];

  out.push(
    `The scraper found changes on vmslsoccer.com for ${data.season}, ${data.division}. ` +
      `fixtures.json is hand maintained and stays the source of truth, so this is a proposal, not a fact.`,
  );

  if (results.length > 0) {
    out.push("", "## Results", "");
    for (const line of results) out.push(`- ${line}`);
  }

  if (added.length > 0) {
    out.push("", "## New fixtures", "");
    for (const line of added) out.push(`- ${line}`);
  }

  if (changed.length > 0) {
    out.push("", "## Kickoff, venue and status changes", "");
    for (const line of changed) out.push(`- ${line}`);
  }

  if (dropped.length > 0) {
    out.push("", "## No longer listed by VMSL", "");
    for (const line of dropped) out.push(`- ${line}`);
    out.push("", "Check these by hand. A fixture vanishing is usually a reschedule, not a deletion.");
  }

  out.push("", "## League position", "");
  if (ours) {
    out.push(
      `${name(OUR_SLUG)} sit ${ordinal(ours.position)} of ${data.standings.length} in ${data.division}, ` +
        `played ${ours.played}, ${ours.points} points, goal difference ${signed(ours.goalDifference)}, form ${ours.form || "none yet"}.`,
    );
  } else {
    out.push(`${name(OUR_SLUG)} are not in the table yet, so there is no position to report.`);
  }
  if (ourStandingsChange) out.push("", `Our row moved: \`${readable(ourStandingsChange)}\``);
  if (standingsChanges.length > 0) {
    out.push(
      "",
      `${standingsChanges.length} other ${standingsChanges.length === 1 ? "club's row" : "clubs' rows"} also moved.`,
    );
  }

  if (log.warnings.length > 0) {
    out.push("", "## Worth a look", "");
    for (const warning of log.warnings) out.push(`- ${readable(warning)}`);
  }

  if (log.unparsed.length > 0) {
    out.push("", "## Other changes", "");
    for (const line of log.unparsed) out.push(`- \`${readable(line)}\``);
  }

  if (log.matches.length === 0 && log.standings.length === 0) {
    out.push(
      "",
      "The scraper reported no line level changes, so whatever moved is in a field the diff does not cover. Read the file diff before merging.",
    );
  }

  out.push(
    "",
    "<details>",
    "<summary>Full scraper output</summary>",
    "",
    "```",
    log.raw.trim(),
    "```",
    "",
    "</details>",
    "",
    "---",
    "",
    "Scores are stored home team first. Check anything surprising against VMSL before merging, " +
      "and edit this branch directly if the scrape got something wrong. Nothing ships from here, " +
      "Vercel builds from main.",
  );

  return `${out.join("\n")}\n`;
}

/* ------------------------------------------------------------------ */
/* Main                                                                */
/* ------------------------------------------------------------------ */

const logPath = process.argv[2];
if (!logPath) {
  console.error("Usage: node scripts/pr-body.ts <path to scrape log>");
  process.exit(1);
}

const data = JSON.parse(readFileSync(DATA_PATH, "utf8")) as FixturesData;
process.stdout.write(build(readLog(path.resolve(logPath)), data));
