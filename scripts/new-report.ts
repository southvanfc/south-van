/*
 * Starts a match report post for one match.
 *
 *   npm run new:report -- 24206
 *   npm run new:report -- 24206 --author "Harjit Kainth"
 *   npm run new:report -- latest
 *
 * "latest" is the most recent match that has a score. It is the only one that
 * is picked for you, and the output names the match it chose.
 *
 * Fills docs/templates/match-report.md in from src/data/fixtures.json and
 * writes it to src/content/blog/. The file is not publishable as written:
 * every placeholder says TODO, and `npm run validate:reports` (which the build
 * runs) refuses a report that still has one. That is deliberate, so an
 * unfinished report cannot deploy by accident.
 *
 * It never overwrites a post that already exists.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import type { FixturesData } from "../src/types/types";
import {
  OUR_SLUG,
  formatLongDate,
  getClub,
  isPlayed,
  isoKickoff,
  lastResult,
  localDate,
  ourScore,
  outcome,
  theirScore,
} from "../src/lib/fixtures.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const args = process.argv.slice(2);
const authorFlag = args.indexOf("--author");
const authorValue = authorFlag >= 0 ? authorFlag + 1 : -1;
const author = authorFlag >= 0 ? (args[authorValue] ?? "") : "South Van FC";
const requested = args.find((arg, i) => !arg.startsWith("--") && i !== authorValue);

function stop(message: string): never {
  console.error(`\n${message}\n`);
  process.exit(1);
}

if (!requested) {
  stop(
    'Which match? Pass its id from src/data/fixtures.json, or "latest" for the most recent result, for example:\n  npm run new:report -- 24206 --author "Harjit Kainth"\n  npm run new:report -- latest',
  );
}
if (authorFlag >= 0 && author === "") {
  stop('--author needs a name, for example --author "Harjit Kainth".');
}

const data = JSON.parse(
  readFileSync(path.join(ROOT, "src", "data", "fixtures.json"), "utf8"),
) as FixturesData;

/*
 * "latest" is the most recent match with a score and a kickoff in the past,
 * which is lastResult(). A match VMSL has not posted a score for yet is not
 * counted, so it will name the previous game until the result lands.
 */
const isLatest = requested === "latest";
const match = isLatest
  ? lastResult(data, new Date())
  : data.matches.find((m) => m.id === requested);

if (!match) {
  if (isLatest) {
    stop("There are no played matches in src/data/fixtures.json yet, so there is no latest game.");
  }
  const played = data.matches
    .filter(isPlayed)
    .map((m) => `  ${m.id}  ${m.date}  ${getClub(data, m.opponentSlug)?.name ?? m.opponentSlug}`)
    .join("\n");
  stop(`No match with id "${requested}" in src/data/fixtures.json. Played matches:\n${played}`);
}
if (!isPlayed(match)) {
  stop(
    `Match ${match.id} has no final score yet. VMSL can post results a day or two late. Add the score to src/data/fixtures.json by hand (see src/data/README.md), or wait for the next scrape, then run this again.`,
  );
}

const opponent = getClub(data, match.opponentSlug)?.name ?? match.opponentSlug;
const ours = ourScore(match) ?? 0;
const theirs = theirScore(match) ?? 0;
const resultWord = { W: "win", D: "draw", L: "loss" }[outcome(match) ?? "D"];
const venueWord = match.isHome ? "home" : "away";

const fileName = `match-report-${match.opponentSlug}-${match.date}.md`;
const target = path.join(ROOT, "src", "content", "blog", fileName);
if (existsSync(target)) {
  stop(
    `src/content/blog/${fileName} already exists, so nothing was written.${
      isLatest ? " That is the latest result. Pass a match id to start a different game." : ""
    }`,
  );
}

/*
 * Today at midnight Vancouver time, with its offset, like the other posts. A
 * bare date is read as UTC midnight, which the page then shows as the day
 * before for anyone west of Greenwich.
 */
const pubDate = isoKickoff({ ...match, date: localDate(new Date()), time: "00:00" });

/* One empty entry per goal South Van scored, so the count is already right. */
const goals =
  ours > 0
    ? [
        "# Our goals, one per goal. Minute, assist and detail are optional, so delete",
        "# whatever you do not know (detail is for things like \"Penalty\" or \"Own goal\").",
        "# Add opponent goals with `team: \"them\"` if you want them shown. List all or none.",
        "goals:",
        ...Array.from({ length: ours }, () => '  - { minute: 1, scorer: "TODO", assist: "TODO" }'),
      ].join("\n")
    : [
        "# South Van did not score, so there is no goals list.",
        "# To show the opponent's goals, add `goals:` with entries like",
        '#   - { team: "them", minute: 30, scorer: "Number 9" }',
        "# and list all of them.",
      ].join("\n");

const template = readFileSync(
  path.join(ROOT, "docs", "templates", "match-report.md"),
  "utf8",
);

const filled = template
  .replaceAll(
    "{{summary}}",
    `${data.clubs.find((c) => c.slug === OUR_SLUG)?.name ?? "South Van FC"} ${ours}-${theirs} ${opponent}, ${resultWord}, ${venueWord}, ${formatLongDate(match.date)}, ${match.competitionLabel}`,
  )
  .replaceAll("{{opponent}}", opponent)
  .replaceAll("{{pubDate}}", pubDate)
  .replaceAll("{{author}}", author)
  .replaceAll("{{matchId}}", match.id)
  .replaceAll("{{goals}}", goals);

writeFileSync(target, filled, { flag: "wx" });

console.log(`\nCreated src/content/blog/${fileName}`);
console.log(
  `  ${isLatest ? "Latest result is" : "Match"} ${match.id}: ${opponent}, ${formatLongDate(match.date)}, ${venueWord}.`,
);
console.log(`  South Van ${ours}, ${opponent} ${theirs} (${resultWord}).`);
console.log("  Add the match photo to public/assets/blog/ and set coverImage to it.");
console.log("  Replace every TODO, then run npm run validate:reports.\n");
