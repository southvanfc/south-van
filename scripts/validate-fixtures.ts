/*
 * Validates src/data/fixtures.json before it can be committed or deployed.
 *
 * This is the safety net for someone editing the JSON by hand on a Sunday
 * evening, so the error messages matter more than the code. Every message says
 * what is wrong, where it is, and what to do about it.
 *
 * Run it with `npm run validate:fixtures`. `npm run build` runs it first, so a
 * broken data file cannot deploy.
 *
 * An optional file path argument checks a different file instead of the real
 * one. scrape-vmsl.ts uses that to hold its proposed file to exactly the same
 * standard as a hand edit, before deciding whether to put it in place.
 *
 * The arithmetic is not reimplemented here. It comes from src/lib/fixtures.ts,
 * which is the same code the page itself uses.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import type { FixturesData, Match } from "../src/types/types";
import { OUR_SLUG, isPlayed, seasonSummary } from "../src/lib/fixtures.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TARGET = process.argv[2];
const DATA_PATH = TARGET
  ? path.resolve(process.cwd(), TARGET)
  : path.join(ROOT, "src", "data", "fixtures.json");
const DISPLAY_PATH = TARGET ? path.relative(ROOT, DATA_PATH) : "src/data/fixtures.json";

/** Statuses where an empty scoreline is legitimate. */
const SCORELESS_STATUSES = ["postponed", "cancelled", "incomplete"];
const VALID_STATUSES = [
  "postponed",
  "cancelled",
  "forfeited",
  "incomplete",
  "completion",
];
const VALID_COMPETITIONS = ["league", "cup", "friendly"];

const CLUB_KEYS = ["name", "vmslName", "tag", "slug", "colour", "crest"];
const CLUB_REQUIRED = ["name", "tag", "slug", "colour"];
const MATCH_KEYS = [
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
];
const MATCH_REQUIRED = [
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
];
const STANDINGS_KEYS = [
  "clubSlug",
  "played",
  "won",
  "drawn",
  "lost",
  "goalsFor",
  "goalsAgainst",
  "form",
];
const TOP_LEVEL_KEYS = [
  "season",
  "division",
  "updatedAt",
  "clubs",
  "matches",
  "standings",
  "history",
];

interface Problem {
  where: string;
  what: string;
  fix: string;
}

const errors: Problem[] = [];
const warnings: Problem[] = [];

function fail(where: string, what: string, fix: string): void {
  errors.push({ where, what, fix });
}

function warn(where: string, what: string, fix: string): void {
  warnings.push({ where, what, fix });
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Suggests the intended key when someone misspells one, so the message can say
 * "did you mean" rather than only "unexpected key".
 */
function closestKey(key: string, allowed: string[]): string | null {
  const lower = key.toLowerCase();
  const hit = allowed.find((candidate) => candidate.toLowerCase() === lower);
  if (hit && hit !== key) return hit;

  let best: string | null = null;
  let bestDistance = Infinity;
  for (const candidate of allowed) {
    const distance = editDistance(lower, candidate.toLowerCase());
    if (distance < bestDistance) {
      bestDistance = distance;
      best = candidate;
    }
  }
  return bestDistance <= 3 ? best : null;
}

function editDistance(a: string, b: string): number {
  const rows: number[][] = [];
  for (let i = 0; i <= a.length; i += 1) rows.push([i, ...Array<number>(b.length).fill(0)]);
  const first = rows[0];
  if (first) for (let j = 0; j <= b.length; j += 1) first[j] = j;

  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const prev = rows[i - 1];
      const row = rows[i];
      if (!prev || !row) continue;
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min(
        (row[j - 1] ?? 0) + 1,
        (prev[j] ?? 0) + 1,
        (prev[j - 1] ?? 0) + cost,
      );
    }
  }
  return rows[a.length]?.[b.length] ?? Infinity;
}

function checkKeys(where: string, value: Record<string, unknown>, allowed: string[]): void {
  for (const key of Object.keys(value)) {
    if (allowed.includes(key)) continue;
    const suggestion = closestKey(key, allowed);
    fail(
      where,
      `Unexpected key "${key}".`,
      suggestion
        ? `Did you mean "${suggestion}"? Rename it, or delete the line if it is left over.`
        : `Remove it. Allowed keys here are: ${allowed.join(", ")}.`,
    );
  }
}

function requireString(where: string, value: Record<string, unknown>, key: string): void {
  const found = value[key];
  if (typeof found === "string" && found.trim() !== "") return;
  fail(
    where,
    found === undefined ? `Missing "${key}".` : `"${key}" must be text, found ${describe(found)}.`,
    `Set "${key}" to a non empty value in quotes.`,
  );
}

function requireInteger(where: string, value: Record<string, unknown>, key: string): void {
  const found = value[key];
  if (typeof found === "number" && Number.isInteger(found) && found >= 0) return;
  fail(
    where,
    found === undefined
      ? `Missing "${key}".`
      : `"${key}" must be a whole number of 0 or more, found ${describe(found)}.`,
    `Set "${key}" to a number with no quotes around it, for example ${key}: 3.`,
  );
}

function describe(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "a list";
  if (typeof value === "string") return `the text "${value}"`;
  return `${typeof value} ${JSON.stringify(value)}`;
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

function isRealDate(value: string): boolean {
  if (!DATE_PATTERN.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  if (year === undefined || month === undefined || day === undefined) return false;
  const asDate = new Date(Date.UTC(year, month - 1, day));
  return (
    asDate.getUTCFullYear() === year &&
    asDate.getUTCMonth() === month - 1 &&
    asDate.getUTCDate() === day
  );
}

/** Today's date in Vancouver, as YYYY-MM-DD, so the stale check is not off by a timezone. */
function vancouverDateNDaysAgo(days: number): string {
  const now = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Vancouver",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/* ------------------------------------------------------------------ */
/* Read and parse                                                      */
/* ------------------------------------------------------------------ */

let raw: string;
try {
  raw = readFileSync(DATA_PATH, "utf8");
} catch {
  console.error(`\nCould not read ${DISPLAY_PATH}.\n`);
  console.error("  Check the file exists and that you are running this from the project root.\n");
  process.exit(1);
}

let parsed: unknown;
try {
  parsed = JSON.parse(raw);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`\n${DISPLAY_PATH} is not valid JSON.\n`);
  console.error(`  ${message}\n`);
  console.error("  This is almost always a missing comma, an extra comma before a closing");
  console.error("  bracket, or a missing quote. Your editor usually underlines the spot.\n");
  process.exit(1);
}

if (!isObject(parsed)) {
  console.error(`\n${DISPLAY_PATH} should contain a single object wrapped in { }.\n`);
  process.exit(1);
}

/* ------------------------------------------------------------------ */
/* Shape                                                               */
/* ------------------------------------------------------------------ */

checkKeys(DISPLAY_PATH, parsed, TOP_LEVEL_KEYS);
for (const key of ["season", "division", "updatedAt"]) {
  requireString(DISPLAY_PATH, parsed, key);
}
for (const key of ["clubs", "matches", "standings", "history"]) {
  if (!Array.isArray(parsed[key])) {
    fail(
      DISPLAY_PATH,
      `"${key}" must be a list.`,
      `Set "${key}" to a list wrapped in [ ], even if it is empty: "${key}": [].`,
    );
  }
}

const clubsRaw = Array.isArray(parsed["clubs"]) ? parsed["clubs"] : [];
const matchesRaw = Array.isArray(parsed["matches"]) ? parsed["matches"] : [];
const standingsRaw = Array.isArray(parsed["standings"]) ? parsed["standings"] : [];
const historyRaw = Array.isArray(parsed["history"]) ? parsed["history"] : [];

/* Clubs */

const clubSlugs = new Set<string>();
const seenSlugs = new Set<string>();
let clubsWithVmslName = 0;

clubsRaw.forEach((club, index) => {
  const where = `clubs[${index}]`;
  if (!isObject(club)) {
    fail(where, "This entry is not an object.", "Each club should be wrapped in { }.");
    return;
  }

  checkKeys(where, club, CLUB_KEYS);
  for (const key of CLUB_REQUIRED) requireString(where, club, key);

  const slug = club["slug"];
  if (typeof slug === "string" && slug !== "") {
    if (seenSlugs.has(slug)) {
      fail(
        `${where} (${slug})`,
        `Duplicate slug "${slug}".`,
        "Every club needs its own slug. Change one of them.",
      );
    }
    seenSlugs.add(slug);
    clubSlugs.add(slug);
    if (!/^[a-z0-9-]+$/.test(slug)) {
      fail(
        `${where} (${slug})`,
        `Slug "${slug}" has characters other than lowercase letters, numbers and hyphens.`,
        'Use a url safe slug, for example "west-hounds-fc-b".',
      );
    }
  }

  const tag = club["tag"];
  if (typeof tag === "string" && (tag.length < 2 || tag.length > 4)) {
    fail(
      `${where} (${String(club["name"])})`,
      `Tag "${tag}" is ${tag.length} characters.`,
      "Tags are 2 to 4 letters, for example \"HIB\".",
    );
  }

  const colour = club["colour"];
  if (typeof colour === "string" && !/^#[0-9a-fA-F]{6}$/.test(colour)) {
    fail(
      `${where} (${String(club["name"])})`,
      `Colour "${colour}" is not a 6 digit hex colour.`,
      'Use the form "#013478", including the leading #.',
    );
  }

  if (typeof club["vmslName"] === "string" && club["vmslName"] !== "") clubsWithVmslName += 1;
});

if (clubsWithVmslName > 0 && clubsWithVmslName < clubsRaw.length) {
  const missing = clubsRaw
    .map((club, index) => ({ club, index }))
    .filter(({ club }) => !(isObject(club) && typeof club["vmslName"] === "string"))
    .map(({ club, index }) =>
      isObject(club) ? `clubs[${index}] ${String(club["name"])}` : `clubs[${index}]`,
    );

  fail(
    "clubs",
    `${clubsWithVmslName} of ${clubsRaw.length} clubs have a vmslName, the rest do not.`,
    `Matching against VMSL data uses vmslName, so half filling it makes matching fail silently. Add a vmslName to: ${missing.join(", ")}. Where the VMSL name is the same as ours, repeat it rather than leaving it out.`,
  );
}

if (!clubSlugs.has(OUR_SLUG)) {
  fail(
    "clubs",
    `No club has the slug "${OUR_SLUG}".`,
    `Our own club must be in the clubs list with slug "${OUR_SLUG}".`,
  );
}

/* Matches and history */

const seenMatchIds = new Map<string, string>();
const staleCutoff = vancouverDateNDaysAgo(3);

function validateMatch(entry: unknown, where: string, label: string): void {
  if (!isObject(entry)) {
    fail(where, "This entry is not an object.", `Each ${label} should be wrapped in { }.`);
    return;
  }

  checkKeys(where, entry, MATCH_KEYS);
  for (const key of MATCH_REQUIRED) {
    if (key === "homeScore" || key === "awayScore" || key === "isHome") continue;
    requireString(where, entry, key);
  }

  const id = typeof entry["id"] === "string" ? entry["id"] : "";
  const date = typeof entry["date"] === "string" ? entry["date"] : "";
  const opponentSlug = typeof entry["opponentSlug"] === "string" ? entry["opponentSlug"] : "";
  const context = id ? `${where} (id ${id}${date ? `, ${date}` : ""})` : where;

  if (id) {
    const seenAt = seenMatchIds.get(id);
    if (seenAt) {
      fail(
        context,
        `Duplicate match id "${id}", already used by ${seenAt}.`,
        "Match ids are VMSL's sched_seq_no and must be unique. If you copied a match to make a new one, change the id.",
      );
    } else {
      seenMatchIds.set(id, where);
    }
  }

  if (date && !isRealDate(date)) {
    fail(
      context,
      `Date "${date}" is not a real date in YYYY-MM-DD form.`,
      'Write the year first, for example "2026-11-22" for 22 November 2026. VMSL shows dates as 11/22/2026, month first, so this is a conversion and not a copy.',
    );
  }

  const time = entry["time"];
  if (typeof time === "string" && !TIME_PATTERN.test(time)) {
    fail(
      context,
      `Time "${time}" is not a 24 hour time in HH:MM form.`,
      'Use 24 hour time, so a 6:00PM kickoff is "18:00" and a 12:30PM kickoff is "12:30".',
    );
  }

  if (typeof entry["isHome"] !== "boolean") {
    fail(
      context,
      `"isHome" must be true or false, found ${describe(entry["isHome"])}.`,
      "Set isHome to true when we are the home team, false when we are away. No quotes around it.",
    );
  }

  const competition = entry["competition"];
  if (typeof competition === "string" && !VALID_COMPETITIONS.includes(competition)) {
    fail(
      context,
      `Competition "${competition}" is not recognised.`,
      `Use one of: ${VALID_COMPETITIONS.join(", ")}.`,
    );
  }

  const status = entry["status"];
  if (status !== undefined && (typeof status !== "string" || !VALID_STATUSES.includes(status))) {
    fail(
      context,
      `Status ${describe(status)} is not recognised.`,
      `Use one of: ${VALID_STATUSES.join(", ")}. Leave the status line out entirely for a normal match.`,
    );
  }

  if (opponentSlug && !clubSlugs.has(opponentSlug)) {
    const suggestion = closestKey(opponentSlug, [...clubSlugs]);
    fail(
      context,
      `opponentSlug "${opponentSlug}" does not match any club.`,
      suggestion
        ? `Did you mean "${suggestion}"? Fix the spelling here, or add the club to the "clubs" list.`
        : `Add a club with slug "${opponentSlug}" to the "clubs" list, or correct the spelling here. Known slugs: ${[...clubSlugs].join(", ")}.`,
    );
  }

  if (opponentSlug === OUR_SLUG) {
    fail(
      context,
      `opponentSlug is "${OUR_SLUG}", which is us.`,
      "opponentSlug names the other team, not South Van FC.",
    );
  }

  /* Scores */

  const home = entry["homeScore"];
  const away = entry["awayScore"];
  const homeOk = home === null || (typeof home === "number" && Number.isInteger(home) && home >= 0);
  const awayOk = away === null || (typeof away === "number" && Number.isInteger(away) && away >= 0);

  if (!homeOk) {
    fail(
      context,
      `homeScore must be a whole number or null, found ${describe(home)}.`,
      "Write the score as a plain number with no quotes, for example 2, or null if the match has not been played.",
    );
  }
  if (!awayOk) {
    fail(
      context,
      `awayScore must be a whole number or null, found ${describe(away)}.`,
      "Write the score as a plain number with no quotes, for example 1, or null if the match has not been played.",
    );
  }

  if (homeOk && awayOk) {
    const homeSet = home !== null;
    const awaySet = away !== null;
    const statusText = typeof status === "string" ? status : undefined;

    if (homeSet !== awaySet) {
      const setName = homeSet ? "homeScore" : "awayScore";
      const emptyName = homeSet ? "awayScore" : "homeScore";
      const setValue = homeSet ? home : away;
      fail(
        context,
        `${setName} is set to ${String(setValue)} but ${emptyName} is null.`,
        `A match has both scores or neither. Add the missing ${emptyName}, or set ${setName} back to null if the match has not been played. Remember both scores are the HOME team first, so if we were away then awayScore is ours.`,
      );
    }

    if (!homeSet && !awaySet && statusText !== undefined && !SCORELESS_STATUSES.includes(statusText)) {
      fail(
        context,
        `Status is "${statusText}" but there is no scoreline.`,
        statusText === "forfeited"
          ? "A forfeit is recorded as a result, usually 3-0 to the team that turned up. Fill in homeScore and awayScore."
          : `A match with status "${statusText}" should have a scoreline. Fill in both scores, or use "postponed", "cancelled" or "incomplete" if the match genuinely has no score.`,
      );
    }

    if (homeSet && awaySet && statusText !== undefined && SCORELESS_STATUSES.includes(statusText)) {
      fail(
        context,
        `Status is "${statusText}" but a scoreline is filled in.`,
        `A ${statusText} match has no score. Set both scores back to null, or change the status if the match was actually played. Use "completion" for a match that was abandoned and later finished.`,
      );
    }

    /* Stale fixture warning, current season only. */
    if (label === "match" && !homeSet && !awaySet && date && date < staleCutoff) {
      if (statusText === undefined) {
        warn(
          context,
          `Kicked off on ${date}, more than three days ago, and still has no score.`,
          "Add the result, or set a status of postponed or cancelled if it was not played.",
        );
      }
    }
  }
}

matchesRaw.forEach((entry, index) => validateMatch(entry, `matches[${index}]`, "match"));
historyRaw.forEach((entry, index) => validateMatch(entry, `history[${index}]`, "history entry"));

/* Standings */

const standingsSlugs = new Set<string>();

standingsRaw.forEach((row, index) => {
  const where = `standings[${index}]`;
  if (!isObject(row)) {
    fail(where, "This entry is not an object.", "Each standings row should be wrapped in { }.");
    return;
  }

  checkKeys(where, row, STANDINGS_KEYS);
  requireString(where, row, "clubSlug");
  for (const key of ["played", "won", "drawn", "lost", "goalsFor", "goalsAgainst"]) {
    requireInteger(where, row, key);
  }

  const slug = typeof row["clubSlug"] === "string" ? row["clubSlug"] : "";
  const context = slug ? `${where} (${slug})` : where;

  if (slug) {
    if (!clubSlugs.has(slug)) {
      const suggestion = closestKey(slug, [...clubSlugs]);
      fail(
        context,
        `clubSlug "${slug}" does not match any club.`,
        suggestion
          ? `Did you mean "${suggestion}"? Fix the spelling here, or add the club to the "clubs" list.`
          : `Add a club with slug "${slug}" to the "clubs" list, or correct the spelling here.`,
      );
    }
    if (standingsSlugs.has(slug)) {
      fail(context, `"${slug}" appears twice in the table.`, "Each club gets one row. Delete the duplicate.");
    }
    standingsSlugs.add(slug);
  }

  const played = row["played"];
  const won = row["won"];
  const drawn = row["drawn"];
  const lost = row["lost"];
  if (
    typeof played === "number" &&
    typeof won === "number" &&
    typeof drawn === "number" &&
    typeof lost === "number"
  ) {
    const accounted = won + drawn + lost;
    if (accounted !== played) {
      fail(
        context,
        `played is ${played} but won plus drawn plus lost is ${accounted}.`,
        `After a result, played goes up by one and exactly one of won, drawn or lost goes up by one. Set played to ${accounted}, or correct the win, draw and loss counts.`,
      );
    }
  }

  const form = row["form"];
  if (typeof form === "string") {
    if (form.length > 5) {
      fail(context, `form "${form}" is ${form.length} characters.`, "Form shows the last 5 results at most, most recent last.");
    }
    if (!/^[WDL]*$/.test(form)) {
      fail(context, `form "${form}" has characters other than W, D and L.`, 'Use only W, D and L, most recent last, for example "DWWLW".');
    }
  }
});

/* ------------------------------------------------------------------ */
/* Arithmetic, only once the shape is sound                            */
/* ------------------------------------------------------------------ */

if (errors.length === 0) {
  const data = parsed as unknown as FixturesData;

  /* Derived summary against our own standings row. */
  const summary = seasonSummary(data);
  const ourRow = data.standings.find((row) => row.clubSlug === OUR_SLUG);

  if (!ourRow) {
    fail(
      "standings",
      `There is no standings row for "${OUR_SLUG}".`,
      "Add a row for South Van FC to the standings list.",
    );
  } else {
    const comparisons: Array<[string, number, number]> = [
      ["played", summary.played, ourRow.played],
      ["won", summary.won, ourRow.won],
      ["drawn", summary.drawn, ourRow.drawn],
      ["lost", summary.lost, ourRow.lost],
      ["goalsFor", summary.goalsFor, ourRow.goalsFor],
      ["goalsAgainst", summary.goalsAgainst, ourRow.goalsAgainst],
    ];

    const mismatches = comparisons.filter(([, derived, stored]) => derived !== stored);

    if (mismatches.length > 0) {
      /*
       * Naming the field that disagrees is not much help on its own, because it
       * does not say which match to look at. So before reporting, try swapping
       * each played match's scores in turn. If exactly that swap makes the whole
       * row agree, we have almost certainly found a result entered our goals
       * first, and we can point straight at it.
       */
      const agrees = (candidate: FixturesData): boolean => {
        const s = seasonSummary(candidate);
        return (
          s.played === ourRow.played &&
          s.won === ourRow.won &&
          s.drawn === ourRow.drawn &&
          s.lost === ourRow.lost &&
          s.goalsFor === ourRow.goalsFor &&
          s.goalsAgainst === ourRow.goalsAgainst
        );
      };

      const suspects: Array<{ index: number; match: Match }> = [];
      for (const [index, candidateMatch] of data.matches.entries()) {
        if (!isPlayed(candidateMatch)) continue;
        if (candidateMatch.homeScore === candidateMatch.awayScore) continue;
        const swapped = {
          ...candidateMatch,
          homeScore: candidateMatch.awayScore,
          awayScore: candidateMatch.homeScore,
        };
        const trial: FixturesData = {
          ...data,
          matches: data.matches.map((m, j) => (j === index ? swapped : m)),
        };
        if (agrees(trial)) suspects.push({ index, match: candidateMatch });
      }

      /* Away matches first. Reversing a home score is possible but far rarer,
         and listing the likely one first saves the reader time. */
      suspects.sort((a, b) => Number(a.match.isHome) - Number(b.match.isHome));

      const detail = mismatches
        .map(([field, derived, stored]) => `${field}: table says ${stored}, results give ${derived}`)
        .join("; ");

      const describeSuspect = ({ index, match: m }: { index: number; match: Match }): string => {
        const side = m.isHome ? "at home to" : "away to";
        return `  matches[${index}] (id ${m.id}, ${m.date} ${side} ${m.opponentSlug}) is stored homeScore ${String(m.homeScore)}, awayScore ${String(m.awayScore)}, and would become homeScore ${String(m.awayScore)}, awayScore ${String(m.homeScore)}`;
      };

      const homeFirstReminder =
        "Scores are always the HOME team first, so an away 3-2 defeat is homeScore 3, awayScore 2, isHome false. Entering it our goals first turns a defeat into a win, which is what this check exists to catch.";

      if (suspects.length > 0) {
        const listed = suspects.slice(0, 5).map(describeSuspect).join("\n");
        const more =
          suspects.length > 5 ? `\n  and ${suspects.length - 5} more.` : "";
        fail(
          `standings (${OUR_SLUG})`,
          `The standings row for South Van FC disagrees with the match results (${detail}).`,
          `One scoreline stored the wrong way round would explain this exactly. Any of these would fit, away matches first because that is where this mistake happens:\n${listed}${more}\n\n${homeFirstReminder} Check the real results against VMSL. If every scoreline is correct, then the standings row is what needs updating.`,
        );
      } else {
        fail(
          `standings (${OUR_SLUG})`,
          `The standings row for South Van FC disagrees with the match results (${detail}).`,
          `Either the standings row or a scoreline in "matches" is wrong. If you just added a result, check the standings row moved with it: played up by one, one of won, drawn or lost up by one, and both goal columns. ${homeFirstReminder}`,
        );
      }
    } else {
      /* Form only makes sense to check once the totals agree, otherwise it just
         repeats the same underlying problem in a second message. */
      const derivedForm = data.matches
        .filter((m) => m.competition === "league")
        .filter(isPlayed)
        .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`))
        .map((m) => {
          const us = m.isHome ? m.homeScore : m.awayScore;
          const them = m.isHome ? m.awayScore : m.homeScore;
          return us > them ? "W" : us < them ? "L" : "D";
        })
        .slice(-5)
        .join("");

      if (ourRow.form !== derivedForm) {
        fail(
          `standings (${OUR_SLUG}) form`,
          `The table says our form is "${ourRow.form}", but our last five league results read "${derivedForm}".`,
          `Set form to "${derivedForm}". It runs oldest to newest, so the most recent result is the last character.`,
        );
      }
    }
  }

  /* Whole table integrity. Every match has one winner and one loser, or two
     teams that drew, so these three totals must balance across the division. */
  const totals = data.standings.reduce(
    (acc, row) => ({
      won: acc.won + row.won,
      drawn: acc.drawn + row.drawn,
      lost: acc.lost + row.lost,
      goalsFor: acc.goalsFor + row.goalsFor,
      goalsAgainst: acc.goalsAgainst + row.goalsAgainst,
    }),
    { won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0 },
  );

  if (totals.won !== totals.lost) {
    fail(
      "standings",
      `Total wins across the division is ${totals.won} but total losses is ${totals.lost}.`,
      "Every win is somebody else's loss, so these must be equal. A result was probably added to one club's row and not the other's.",
    );
  }

  if (totals.drawn % 2 !== 0) {
    fail(
      "standings",
      `Total draws across the division is ${totals.drawn}, which is an odd number.`,
      "A draw is recorded by both clubs, so the total is always even. One club's row is missing a draw.",
    );
  }

  if (totals.goalsFor !== totals.goalsAgainst) {
    fail(
      "standings",
      `Total goals for across the division is ${totals.goalsFor} but total goals against is ${totals.goalsAgainst}.`,
      "Every goal scored is conceded by somebody, so these must be equal. Check the goalsFor and goalsAgainst you changed most recently.",
    );
  }
}

/* ------------------------------------------------------------------ */
/* Report                                                              */
/* ------------------------------------------------------------------ */

/** Prints text that may span several lines, keeping the indent consistent. */
function block(text: string, indent: string): void {
  for (const line of text.split("\n")) {
    console.error(line === "" ? "" : `${indent}${line}`);
  }
}

function report(problems: Problem[], marker: string): void {
  for (const problem of problems) {
    console.error(`  ${marker} ${problem.where}`);
    block(problem.what, "     ");
    block(`Fix: ${problem.fix}`, "     ");
    console.error("");
  }
}

if (errors.length > 0) {
  console.error(`\n${DISPLAY_PATH} has ${errors.length} problem${errors.length === 1 ? "" : "s"}.\n`);
  report(errors, "x");
  if (warnings.length > 0) {
    console.error(`Also ${warnings.length} warning${warnings.length === 1 ? "" : "s"}.\n`);
    report(warnings, "!");
  }
  console.error("Nothing was changed. Fix the problems above and run npm run validate:fixtures again.\n");
  process.exit(1);
}

const played = matchesRaw.filter((m) => isObject(m) && m["homeScore"] !== null).length;
console.log(`\n${DISPLAY_PATH} looks good.`);
console.log(
  `  ${clubsRaw.length} clubs, ${matchesRaw.length} matches (${played} played), ${standingsRaw.length} standings rows, ${historyRaw.length} in history.`,
);

if (errors.length === 0) {
  const summary = seasonSummary(parsed as unknown as FixturesData);
  console.log(
    `  South Van FC: P${summary.played} W${summary.won} D${summary.drawn} L${summary.lost} GF${summary.goalsFor} GA${summary.goalsAgainst} Pts${summary.points}, and the standings row agrees.`,
  );
}

if (warnings.length > 0) {
  console.log(`\n${warnings.length} warning${warnings.length === 1 ? "" : "s"}, not a failure.\n`);
  report(warnings, "!");
} else {
  console.log("");
}
