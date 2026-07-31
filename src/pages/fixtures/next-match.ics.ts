import type { APIRoute } from "astro";
import { fixturesData } from "../../data/fixtures";
import { OUR_SLUG, getClub, kickoffAt, nextMatch } from "../../lib/fixtures";

/*
 * The "Add to calendar" button on the match card points here. An .ics file is
 * the one format every calendar app understands, Apple, Google and Outlook
 * alike, and building it needs no dependency.
 *
 * The route is dynamic, like the rest of the page, so the file always describes
 * whichever fixture is next at the moment the button is clicked.
 */

/** 90 minutes plus half time and a little either side. */
const MATCH_MINUTES = 120;

/** "20261122T200000Z", the UTC form iCalendar wants. */
function stamp(date: Date): string {
  return `${date.toISOString().replace(/[-:]/g, "").slice(0, 15)}Z`;
}

/** Backslash, semicolon, comma and newline are the reserved characters. */
function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** RFC 5545 caps a content line at 75 octets, wrapped lines start with a space. */
function fold(line: string): string {
  if (line.length <= 75) return line;
  const parts = [line.slice(0, 75)];
  for (let i = 75; i < line.length; i += 74) parts.push(` ${line.slice(i, i + 74)}`);
  return parts.join("\r\n");
}

export const GET: APIRoute = () => {
  const match = nextMatch(fixturesData, new Date());

  if (!match) {
    return new Response("No fixture scheduled.", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const us = getClub(fixturesData, OUR_SLUG);
  const opponent = getClub(fixturesData, match.opponentSlug);
  const ourName = us?.name ?? "South Van FC";
  const theirName = opponent?.name ?? match.opponentSlug;

  const start = kickoffAt(match);
  const end = new Date(start.getTime() + MATCH_MINUTES * 60 * 1000);
  const summary = match.isHome
    ? `${ourName} vs ${theirName}`
    : `${theirName} vs ${ourName}`;

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//South Van FC//Fixtures//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:vmsl-${match.id}@southvanfc.com`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${escapeText(summary)}`,
    `LOCATION:${escapeText(match.venue)}`,
    `DESCRIPTION:${escapeText(`${match.competitionLabel}. Kickoff ${match.time} Vancouver time.`)}`,
    "URL:https://www.southvanfc.com/fixtures/",
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  const body = `${lines.map(fold).join("\r\n")}\r\n`;
  const filename = `south-van-fc-${match.date}.ics`;

  return new Response(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "public, max-age=300",
    },
  });
};
