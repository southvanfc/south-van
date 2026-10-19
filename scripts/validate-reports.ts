/*
 * Validates the match reports in src/content/blog before they can deploy.
 *
 * A report names players as free text and points at a match by id, and the
 * site renders per request, so a typo would otherwise only be found by a
 * visitor. Every message says what is wrong, where, and what to do about it.
 *
 * Run it with `npm run validate:reports`. `npm run build` runs it after
 * validate:fixtures, so a broken report cannot deploy.
 *
 * An optional directory argument checks that folder instead of the real blog
 * folder, which is how the checks themselves were tried out without touching
 * a post.
 *
 * The rules live in src/lib/matchReport.ts, next to the code that renders a
 * report, so what is allowed here and what is drawn on the page cannot drift.
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import type { FixturesData, RosterData } from "../src/types/types";
import { validateReport } from "../src/lib/matchReport.ts";
import type { ReportFrontmatter } from "../src/lib/matchReport.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TARGET = process.argv[2];
const BLOG_DIR = TARGET
  ? path.resolve(process.cwd(), TARGET)
  : path.join(ROOT, "src", "content", "blog");

const fixtures = JSON.parse(
  readFileSync(path.join(ROOT, "src", "data", "fixtures.json"), "utf8"),
) as FixturesData;
const roster = (
  JSON.parse(readFileSync(path.join(ROOT, "src", "data", "roster.json"), "utf8")) as RosterData
).players;

interface Problem {
  file: string;
  message: string;
}

const errors: Problem[] = [];
const warnings: Problem[] = [];

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const isString = (value: unknown): value is string => typeof value === "string";

/**
 * The shape checks Astro's schema also makes at build time, repeated here so
 * that `validateReport` is never handed something it would crash on and the
 * author gets a sentence instead of a stack trace.
 */
function shapeProblems(front: Record<string, unknown>): string[] {
  const out: string[] = [];
  const { goals, motm, lineup } = front;

  if (goals !== undefined) {
    if (!Array.isArray(goals)) {
      out.push("goals must be a list. Each goal is written as `- { minute: 23, scorer: \"Name\" }`.");
    } else {
      goals.forEach((goal, i) => {
        if (!isObject(goal) || !isString(goal["scorer"])) {
          out.push(`goals item ${i + 1} needs a scorer written as text, for example \`scorer: "Name"\`.`);
          return;
        }
        if (goal["team"] !== undefined && goal["team"] !== "us" && goal["team"] !== "them") {
          out.push(`goals item ${i + 1} has team "${String(goal["team"])}". Use "us" or "them", or leave it out for ours.`);
        }
        if (goal["minute"] !== undefined && typeof goal["minute"] !== "number") {
          out.push(`goals item ${i + 1} has a minute that is not a number. Write 23, not "23'".`);
        }
      });
    }
  }

  if (motm !== undefined && (!isObject(motm) || !isString(motm["player"]))) {
    out.push('motm needs a player, written as `motm: { player: "Name", reason: "Why" }`.');
  }

  if (lineup !== undefined) {
    if (!isObject(lineup) || !Array.isArray(lineup["starters"]) || !lineup["starters"].every(isString)) {
      out.push("lineup needs `starters` as a list of names.");
    } else if (
      lineup["bench"] !== undefined &&
      (!Array.isArray(lineup["bench"]) || !lineup["bench"].every(isString))
    ) {
      out.push("lineup `bench` must be a list of names.");
    }
  }

  return out;
}

/**
 * Line numbers (1 based) that still say TODO, the marker scripts/new-report.ts
 * leaves for everything the author has to fill in. Comments are skipped, since
 * the template's own header explains the marker by name.
 */
function todoLines(source: string): number[] {
  const lines = source.split(/\r?\n/);
  const hits: number[] = [];
  let fence = 0;
  let inHtmlComment = false;

  lines.forEach((line, index) => {
    if (line.trim() === "---" && fence < 2) {
      fence += 1;
      return;
    }
    const inFrontmatter = fence === 1;
    if (inFrontmatter && line.trim().startsWith("#")) return;

    if (!inFrontmatter) {
      if (line.includes("<!--")) inHtmlComment = true;
      const skip = inHtmlComment;
      if (line.includes("-->")) inHtmlComment = false;
      if (skip) return;
    }
    if (/\bTODO\b/.test(line)) hits.push(index + 1);
  });

  return hits;
}

/** The YAML between the opening and closing `---`, or null if there is none. */
function frontmatterOf(source: string): string | null {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(source);
  return match ? (match[1] ?? null) : null;
}

const files = readdirSync(BLOG_DIR, { recursive: true })
  .map(String)
  .filter((name) => /\.(md|mdx)$/.test(name))
  .sort();

const displayName = (file: string): string =>
  TARGET ? path.join(TARGET, file) : path.join("src", "content", "blog", file);

const reportsByMatch = new Map<string, string[]>();
let reportCount = 0;

for (const file of files) {
  const where = displayName(file);
  const source = readFileSync(path.join(BLOG_DIR, file), "utf8");
  const raw = frontmatterOf(source);
  if (raw === null) continue;

  let front: unknown;
  try {
    front = parseYaml(raw);
  } catch (error) {
    errors.push({
      file: where,
      message: `The frontmatter is not valid YAML: ${error instanceof Error ? error.message : String(error)}`,
    });
    continue;
  }
  if (!isObject(front)) continue;

  const hasMatchId = front["matchId"] !== undefined && front["matchId"] !== null;
  const extras = ["goals", "motm", "lineup"].filter((key) => front[key] !== undefined);

  if (!hasMatchId) {
    if (extras.length > 0) {
      errors.push({
        file: where,
        message: `Has ${extras.join(", ")} but no matchId, so none of it would be shown. Add \`matchId: "<id>"\` from fixtures.json, or remove the report fields.`,
      });
    } else if (front["category"] === "Match Report") {
      warnings.push({
        file: where,
        message:
          'The category is "Match Report" but there is no matchId, so it will render as an ordinary post with no scoreboard. Add `matchId` if that is not what you want.',
      });
    }
    continue;
  }

  reportCount += 1;
  const matchId = String(front["matchId"]);
  reportsByMatch.set(matchId, [...(reportsByMatch.get(matchId) ?? []), where]);

  // An unfinished scaffold. Say so once, rather than a pile of name errors.
  const todos = todoLines(source);
  if (todos.length > 0) {
    errors.push({
      file: where,
      message: `Still has TODO placeholders on line${todos.length === 1 ? "" : "s"} ${todos.join(", ")}. Replace each one, or delete the line if it is optional.`,
    });
    continue;
  }

  // Every report comes with a match photo, so a missing or mistyped one is an error.
  const cover = front["coverImage"];
  if (!isString(cover) || cover.trim() === "") {
    errors.push({
      file: where,
      message:
        'A match report needs a match photo. Put it in public/assets/blog/ and add `coverImage: "/assets/blog/<name>.webp"` with a `coverImageAlt` sentence.',
    });
  } else if (cover.startsWith("/") && !existsSync(path.join(ROOT, "public", cover))) {
    errors.push({
      file: where,
      message: `coverImage "${cover}" is not in public/. Check the file name, or add the photo to public/assets/blog/.`,
    });
  }

  const shape = shapeProblems(front);
  if (shape.length > 0) {
    for (const message of shape) errors.push({ file: where, message });
    continue;
  }

  const report: ReportFrontmatter = {
    matchId,
    goals: front["goals"] as ReportFrontmatter["goals"],
    motm: front["motm"] as ReportFrontmatter["motm"],
    lineup: front["lineup"] as ReportFrontmatter["lineup"],
  };
  for (const message of validateReport(report, fixtures, roster)) {
    errors.push({ file: where, message });
  }
}

for (const [matchId, posts] of reportsByMatch) {
  if (posts.length > 1) {
    warnings.push({
      file: posts.join(", "),
      message: `More than one report is attached to match ${matchId}. That is allowed, but check it is not a copy that was never renamed.`,
    });
  }
}

function printAll(problems: Problem[], marker: string): void {
  for (const problem of problems) {
    console.error(`  ${marker} ${problem.file}`);
    for (const line of problem.message.split("\n")) console.error(`     ${line}`);
    console.error("");
  }
}

if (errors.length > 0) {
  console.error(
    `\nMatch reports have ${errors.length} problem${errors.length === 1 ? "" : "s"}.\n`,
  );
  printAll(errors, "x");
  if (warnings.length > 0) {
    console.error(`Also ${warnings.length} warning${warnings.length === 1 ? "" : "s"}.\n`);
    printAll(warnings, "!");
  }
  console.error("Nothing was changed. Fix the problems above and run npm run validate:reports again.\n");
  process.exit(1);
}

console.log(
  `\nMatch reports look good. ${reportCount} report${reportCount === 1 ? "" : "s"} checked across ${files.length} posts.`,
);
if (warnings.length > 0) {
  console.log(`\n${warnings.length} warning${warnings.length === 1 ? "" : "s"}, not a failure.\n`);
  printAll(warnings, "!");
} else {
  console.log("");
}
