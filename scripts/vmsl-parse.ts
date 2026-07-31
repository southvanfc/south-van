/*
 * Parsing and normalising for the VMSL scrape. Pure functions only.
 *
 * Nothing in this file fetches, reads or writes anything. It takes HTML strings
 * in and gives plain data out, which is what lets scrape-vmsl.test.ts run the
 * whole parse offline against saved responses in scripts/__fixtures__/.
 *
 * The HTML being parsed is 2013 era CGI output: unquoted attributes, unclosed
 * <tr> tags, nested <a> elements and stray </font> tags. A strict parser will
 * not cope, so everything here is deliberately defensive and tolerant.
 * The reference implementation this grew from is scripts/vmsl-poc-reference.ts.
 */

import type { Competition, Match, StandingsRow } from "../src/types/types";

/* ------------------------------------------------------------------ */
/* Raw shapes, straight off the page                                   */
/* ------------------------------------------------------------------ */

/** One fixture row exactly as VMSL presents it, before any normalising. */
export interface RawFixture {
  /** VMSL `sched_seq_no`, the stable match id. */
  id: string | null;
  /** e.g. "Sat 9/6/2025 6:00PM" */
  rawDate: string;
  /** e.g. "Winter - League" */
  competition: string;
  /** e.g. "Division 4" or "Div 4 Cup" */
  division: string;
  /** e.g. "Forfeited", "Incomplete", "Completion" */
  statusMarker: string | null;
  homeTeam: string;
  homeTeamId: string | null;
  awayTeam: string;
  awayTeamId: string | null;
  /** HOME team goals, because VMSL's own column order is Home, Result, Visiting. */
  homeScore: number | null;
  /** AWAY team goals. See above. */
  awayScore: number | null;
  venue: string | null;
  note: string | null;
}

export interface RawSchedule {
  fixtures: RawFixture[];
  /** The "N Records Listed" figure in the footer, or null when absent. */
  claimedCount: number | null;
  /** False when the page has no schedule table at all, as in a pre-season run. */
  tableFound: boolean;
}

/** One club's row in a VMSL division standings table. */
export interface RawStandingsRow {
  position: number;
  team: string;
  teamId: string | null;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  /**
   * The crest VMSL shows next to the club in the standings table, as the path
   * from the response, e.g. "/upload/img/teamcrest_827.jpg". Null when the
   * row carries no crest `<img>` at all.
   *
   * A club with no badge uploaded still gets an `<img>`, just pointing at a
   * shared placeholder rather than a file named for that team, so this is a
   * straight read of whatever src is there. Deciding which src values count
   * as a real, team specific crest is scrape-vmsl.ts's job, not this file's:
   * this module only reports what is on the page.
   */
  crestUrl: string | null;
}

export interface RawPool {
  /** The pool letter, e.g. "A". */
  pool: string;
  rows: RawStandingsRow[];
}

/* ------------------------------------------------------------------ */
/* Text helpers                                                        */
/* ------------------------------------------------------------------ */

/** Strip tags and decode the handful of entities this app actually emits. */
export function decode(html: string): string {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Split a row chunk into the inner HTML of its cells. The markup does not close
 * its <td> tags reliably, so this splits on the opening tag and stops at the
 * closing one only if there is one.
 */
function cells(rowHtml: string): string[] {
  return rowHtml
    .split(/<td\b/i)
    .slice(1)
    .map((cell) => {
      const afterAttributes = cell.slice(cell.indexOf(">") + 1);
      return afterAttributes.split(/<\/td>/i)[0] ?? "";
    });
}

/**
 * VMSL prefixes clubs that are new to a division with "NEW - ", and wraps some
 * of them in square brackets, as in "NEW - [AC Phantoms]". Both are
 * presentation leaking into data and both come and go between seasons, so they
 * are stripped everywhere a club name is read.
 */
export function stripNewPrefix(name: string): string {
  return name
    .replace(/^\s*NEW\s*-\s*/i, "")
    .replace(/^\s*\[(.*)\]\s*$/, "$1")
    .trim();
}

/** Pull a club name and VMSL team id out of a cell containing a team link. */
function parseTeamCell(cellHtml: string): { name: string; id: string | null } {
  const id = cellHtml.match(/team_page\?id=(\d+)/);
  // "(FF)" sits in a nested <a> and marks a forfeit, not part of the name.
  const name = stripNewPrefix(decode(cellHtml).replace(/\(FF\)/g, "").trim());
  return { name, id: id ? id[1] ?? null : null };
}

/** Narrow an HTML document to one table, given a marker that appears inside it. */
function tableAround(html: string, markerIndex: number): string {
  const start = html.lastIndexOf("<table", markerIndex);
  if (start === -1) return "";
  const end = html.indexOf("</table>", start);
  return end === -1 ? html.slice(start) : html.slice(start, end);
}

/* ------------------------------------------------------------------ */
/* Schedule                                                            */
/* ------------------------------------------------------------------ */

/**
 * Parse a `team_page?cmd=htmlsched` response.
 *
 * Layout, which is the fragile part of all this: each fixture is three rows.
 * A full width `colspan=6` row above carries the competition and, in a
 * `<span class=red>`, an optional status marker. Then the fixture row itself.
 * Then an optional full width row below in italics carrying a free text note.
 * Any restyling by VMSL breaks that association, which is exactly what the
 * "N Records Listed" cross-check is there to catch.
 */
export function parseSchedule(html: string): RawSchedule {
  const marker = html.search(/class="?[^">]*smart_table/i);
  if (marker === -1) {
    // No schedule table at all. Normal before a season is published.
    return { fixtures: [], claimedCount: null, tableFound: false };
  }

  const table = tableAround(html, marker);
  const fixtures: RawFixture[] = [];

  let competition = "";
  let statusMarker: string | null = null;

  for (const chunk of table.split(/<tr\b/i).slice(1)) {
    const tds = cells(chunk);
    const first = tds[0] ? decode(tds[0]) : "";

    // Full width row: a competition header, a note, or the footer count.
    if (/colspan=6/i.test(chunk) && tds.length === 1) {
      if (!first || /Records Listed/i.test(first)) continue;

      if (/<i>/i.test(tds[0] ?? "")) {
        const last = fixtures[fixtures.length - 1];
        if (last) last.note = first;
        continue;
      }

      const marked = first.match(/\(([^)]+)\)\s*$/);
      statusMarker = marked ? marked[1] ?? null : null;
      competition = first.replace(/\s*\([^)]*\)\s*$/, "").trim();
      continue;
    }

    if (!/\d{1,2}\/\d{1,2}\/\d{4}/.test(first)) continue; // not a fixture row

    const home = parseTeamCell(tds[2] ?? "");
    const away = parseTeamCell(tds[4] ?? "");

    /*
     * Column order is Date, Division, Home Team, Result, Visiting Team, Field,
     * per the table's own header row. So the two numbers in the Result cell are
     * the HOME team's goals first. That is also how Match stores them, so this
     * is a straight copy and must never be reordered. See the warning on Match
     * in src/types/types.ts.
     */
    const score = decode(tds[3] ?? "").match(/(\d+)\s*-\s*(\d+)/);

    fixtures.push({
      id: (tds[3] ?? "").match(/sched_seq_no=(\d+)/)?.[1] ?? null,
      rawDate: first,
      competition,
      division: decode(tds[1] ?? ""),
      statusMarker,
      homeTeam: home.name,
      homeTeamId: home.id,
      awayTeam: away.name,
      awayTeamId: away.id,
      homeScore: score?.[1] !== undefined ? Number(score[1]) : null,
      awayScore: score?.[2] !== undefined ? Number(score[2]) : null,
      venue: decode(tds[5] ?? "") || null,
      note: null,
    });

    // The header row above each fixture carries its own marker, so consuming it
    // here stops one fixture's status from leaking onto the next.
    statusMarker = null;
  }

  const claimed = table.match(/(\d+)\s+Records Listed/i);
  return {
    fixtures,
    claimedCount: claimed?.[1] !== undefined ? Number(claimed[1]) : null,
    tableFound: true,
  };
}

/* ------------------------------------------------------------------ */
/* Standings                                                           */
/* ------------------------------------------------------------------ */

/**
 * Parse a `div_stats` response requested with an empty `sched_pool`, so every
 * pool in the division comes back in one request. Each pool is introduced by a
 * "Pool: X" heading, and the rows carry `class=stdgtbldata` numeric cells in
 * the order GP, W, D, L, GF, GA, GD, PTS.
 */
export function parseStandings(html: string): RawPool[] {
  const headings = [...html.matchAll(/Pool:\s*([A-Za-z0-9]+)/g)];
  const pools: RawPool[] = [];

  headings.forEach((heading, index) => {
    const pool = heading[1];
    if (pool === undefined || heading.index === undefined) return;

    const nextIndex = headings[index + 1]?.index;
    const section = html.slice(heading.index, nextIndex ?? html.length);
    pools.push({ pool, rows: parseStandingsRows(section) });
  });

  return pools;
}

function parseStandingsRows(section: string): RawStandingsRow[] {
  const rows: RawStandingsRow[] = [];

  for (const chunk of section.split(/<tr\b/i).slice(1)) {
    if (!/stdgtbldata/i.test(chunk)) continue; // header rows and spacers

    const tds = cells(chunk);

    // Read the club from the one cell holding its team link, not from the whole
    // row, which also contains the crest and every numeric column.
    const teamCell = tds.find((cell) => /team_page\?id=/i.test(cell));
    if (teamCell === undefined) continue;
    const team = parseTeamCell(teamCell);
    if (!team.name) continue;

    // The position sits in the first cell as "7&nbsp;&nbsp;".
    const position = Number(decode(tds[0] ?? "").trim());

    const numbers = [...chunk.matchAll(/class=stdgtbldata[^>]*>(?:<b>)?\s*(-?\d+)/gi)].map(
      (match) => Number(match[1]),
    );
    if (numbers.length < 8) continue;

    const [played, won, drawn, lost, goalsFor, goalsAgainst, goalDifference, points] = numbers as [
      number,
      number,
      number,
      number,
      number,
      number,
      number,
      number,
    ];

    // The crest sits earlier in the row than the <td> cells, as
    // <img title="TAG" class=tcicon valign=middle src="/upload/img/...">.
    const crest = chunk.match(/<img[^>]*class=tcicon[^>]*\bsrc="([^"]+)"/i);

    rows.push({
      position: Number.isFinite(position) ? position : rows.length + 1,
      team: team.name,
      teamId: team.id,
      played,
      won,
      drawn,
      lost,
      goalsFor,
      goalsAgainst,
      goalDifference,
      points,
      crestUrl: crest?.[1] ?? null,
    });
  }

  return rows;
}

/**
 * The pool our team plays in, derived rather than configured. Pools reshuffle
 * every season through promotion and relegation, so a hardcoded pool is wrong
 * roughly every August. South Van was in Pool B in 2025-26 and Pool A in
 * 2026-27, which is exactly the trap this avoids.
 */
export function findPoolForTeam(pools: RawPool[], teamId: string): RawPool | null {
  return pools.find((pool) => pool.rows.some((row) => row.teamId === teamId)) ?? null;
}

/* ------------------------------------------------------------------ */
/* Normalising                                                         */
/* ------------------------------------------------------------------ */

/**
 * "Sat 9/6/2025 6:00PM" to { date: "2025-09-06", time: "18:00" }.
 *
 * VMSL prints US month first dates and 12 hour times, with no timezone, and
 * they are always Vancouver local. We keep them as wall clock strings and never
 * build a Date from them, which is what makes the November DST change a non
 * event: nothing is ever converted, so nothing can shift by an hour.
 */
export function parseKickoff(raw: string): { date: string; time: string } | null {
  const match = raw.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!match) return null;

  const [, month, day, year, hour12, minute, meridiem] = match;
  if (
    month === undefined ||
    day === undefined ||
    year === undefined ||
    hour12 === undefined ||
    minute === undefined ||
    meridiem === undefined
  ) {
    return null;
  }

  let hour = Number(hour12) % 12;
  if (meridiem.toUpperCase() === "PM") hour += 12;

  const pad = (value: number | string): string => String(value).padStart(2, "0");
  return {
    date: `${year}-${pad(month)}-${pad(day)}`,
    time: `${pad(hour)}:${minute}`,
  };
}

/** VMSL's status markers, mapped onto the ones Match allows. */
const STATUS_BY_MARKER: Record<string, NonNullable<Match["status"]>> = {
  forfeited: "forfeited",
  incomplete: "incomplete",
  completion: "completion",
  postponed: "postponed",
  cancelled: "cancelled",
  canceled: "cancelled",
};

export function mapStatus(marker: string | null): NonNullable<Match["status"]> | null {
  if (!marker) return null;
  return STATUS_BY_MARKER[marker.trim().toLowerCase()] ?? null;
}

/** league, cup or friendly, read off the competition and division labels. */
export function classifyCompetition(competition: string, division: string): Competition {
  const text = `${competition} ${division}`.toLowerCase();
  if (text.includes("friendly") || text.includes("exhibition")) return "friendly";
  if (text.includes("cup") || text.includes("knockout") || text.includes("playoff")) return "cup";
  return "league";
}

/**
 * A url safe slug for a club. Kept deliberately simple, because the slug only
 * has to be stable, not pretty. Clubs already in fixtures.json keep the slug a
 * human gave them, so this only ever runs for a club we have not seen before.
 */
export function slugify(name: string): string {
  return stripNewPrefix(name)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * A 2 to 4 letter tag from a club name, taking the initial of each word. Tags
 * are shown in compact views, so a human will often want to improve on this.
 * New clubs are listed in the run summary for exactly that reason.
 */
export function deriveTag(name: string): string {
  const words = stripNewPrefix(name)
    .replace(/[^A-Za-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  const initials = words.map((word) => word[0] ?? "").join("").toUpperCase();
  if (initials.length >= 2) return initials.slice(0, 4);

  // One short word, e.g. "Atlixco". Fall back to its first letters.
  const letters = (words[0] ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  return letters.slice(0, 3).padEnd(2, "X");
}

/**
 * A colour for a club we have not seen before, picked deterministically from
 * the slug so that re-running the scraper never churns the diff. These are
 * placeholders and are flagged in the summary for a human to replace.
 */
const PLACEHOLDER_COLOURS = [
  "#1d5fa8",
  "#7a1f2b",
  "#1e7a4a",
  "#b02020",
  "#2b2f45",
  "#0e5c7a",
  "#d97919",
  "#5b3a8c",
];

export function placeholderColour(slug: string): string {
  let hash = 0;
  for (const character of slug) hash = (hash * 31 + character.charCodeAt(0)) % 100000;
  return PLACEHOLDER_COLOURS[hash % PLACEHOLDER_COLOURS.length] ?? "#2b2f45";
}

/** A standings row for our own data shape, given a club slug lookup. */
export function toStandingsRow(
  row: RawStandingsRow,
  clubSlug: string,
  form: string,
): StandingsRow {
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
}

/* ------------------------------------------------------------------ */
/* Season window                                                       */
/* ------------------------------------------------------------------ */

/**
 * The dates a season can legitimately cover. reg_year is the season END year,
 * so reg_year 2027 is season 2026-27 and runs from July 2026 to June 2027.
 */
export function seasonWindow(regYear: number): { start: string; end: string } {
  return { start: `${regYear - 1}-07-01`, end: `${regYear}-06-30` };
}

/**
 * Matches that fall outside the configured season.
 *
 * This is the check that turns the reg_year off by one into a failure instead
 * of a silent wrong answer. Ask for reg_year 2027 while VMSL is still serving
 * 2025-26 and every match comes back dated a year early, which no other check
 * would notice: the fixtures parse, the counts agree and the table looks fine.
 */
export function matchesOutsideSeason(
  matches: Array<{ id: string; date: string }>,
  regYear: number,
): Array<{ id: string; date: string }> {
  const { start, end } = seasonWindow(regYear);
  return matches.filter((match) => match.date < start || match.date > end);
}

/* ------------------------------------------------------------------ */
/* Fixtures to matches                                                 */
/* ------------------------------------------------------------------ */

export interface NormaliseOptions {
  /** Exactly as VMSL spells it, one word: "SouthVan FC". */
  teamName: string;
  /** Label for league fixtures, e.g. "VMSL Division 4A". */
  divisionLabel: string;
  /** Maps a VMSL club name onto our club slug, registering it if it is new. */
  slugFor: (vmslName: string) => string;
}

export interface NormaliseResult {
  matches: Match[];
  warnings: string[];
}

/** "VMSL Division 4A" for league, "Division 4 Cup, Group B" for cup. */
export function competitionLabel(
  competition: Competition,
  fixture: RawFixture,
  divisionLabel: string,
): string {
  if (competition === "league") return divisionLabel;

  const base = fixture.division.replace(/\bDiv\b/i, "Division").trim() || "Cup";
  const group = fixture.note?.match(/\bGroup\s+([A-Z])\b/);
  return group ? `${base}, Group ${group[1]}` : base;
}

/** Turn parsed VMSL rows into Match records. Throws on anything ambiguous. */
export function normaliseMatches(
  raw: RawFixture[],
  options: NormaliseOptions,
): NormaliseResult {
  const matches: Match[] = [];
  const warnings: string[] = [];
  const ourVmslName = options.teamName.toLowerCase();

  for (const fixture of raw) {
    const kickoff = parseKickoff(fixture.rawDate);
    if (!kickoff) {
      throw new Error(
        `Could not read a kickoff from "${fixture.rawDate}" (match ${fixture.id ?? "unknown"}). ` +
          `VMSL prints dates as "Sat 9/6/2025 6:00PM", so the format has probably changed.`,
      );
    }

    if (!fixture.id) {
      throw new Error(
        `A fixture on ${kickoff.date} has no sched_seq_no. That is the match id and the key ` +
          `everything reconciles on, so the scrape cannot continue without it.`,
      );
    }

    const homeIsUs = fixture.homeTeam.toLowerCase() === ourVmslName;
    const awayIsUs = fixture.awayTeam.toLowerCase() === ourVmslName;
    if (homeIsUs === awayIsUs) {
      throw new Error(
        `Match ${fixture.id} on ${kickoff.date} is "${fixture.homeTeam}" against "${fixture.awayTeam}", ` +
          `and exactly one of those should be "${options.teamName}". ` +
          `Check teamName and teamId in the config, and remember VMSL writes it as one word.`,
      );
    }

    const opponentName = homeIsUs ? fixture.awayTeam : fixture.homeTeam;
    const competition = classifyCompetition(fixture.competition, fixture.division);
    const status = mapStatus(fixture.statusMarker);

    if (fixture.statusMarker && !status) {
      warnings.push(
        `Match ${fixture.id} carries an unrecognised VMSL marker "(${fixture.statusMarker})". ` +
          `It has been kept in the note but not stored as a status.`,
      );
    }

    /*
     * Scores are copied straight across, home team first, because that is both
     * VMSL's column order and how Match stores them. Do not reorder these to
     * put South Van first. An away 3-2 defeat is homeScore 3, awayScore 2,
     * isHome false, and reading it our goals first turns a defeat into a win
     * while leaving a table that still looks perfectly plausible.
     */
    let homeScore = fixture.homeScore;
    let awayScore = fixture.awayScore;

    const noteParts: string[] = [];
    if (fixture.note) noteParts.push(fixture.note);
    if (fixture.statusMarker && !status) noteParts.push(`VMSL marker: ${fixture.statusMarker}`);

    /*
     * An abandoned match keeps its partial scoreline on VMSL, but that score is
     * not a result: the match is finished later and appears again as a separate
     * "Completion" fixture carrying the real one. Storing the partial score
     * would double count it, so it moves into the note instead.
     */
    if (status === "incomplete" && homeScore !== null && awayScore !== null) {
      noteParts.push(`Abandoned at ${homeScore}-${awayScore}.`);
      homeScore = null;
      awayScore = null;
    }

    const match: Match = {
      id: fixture.id,
      date: kickoff.date,
      time: kickoff.time,
      opponentSlug: options.slugFor(opponentName),
      isHome: homeIsUs,
      venue: fixture.venue ?? "",
      competition,
      competitionLabel: competitionLabel(competition, fixture, options.divisionLabel),
      homeScore,
      awayScore,
    };

    if (status) match.status = status;
    const note = noteParts.join(" ").trim();
    if (note) match.note = note;

    matches.push(match);
  }

  return { matches, warnings };
}
