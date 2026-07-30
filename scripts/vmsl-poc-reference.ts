/**
 * VMSL scrape proof of concept - throwaway.
 *
 * Pulls SouthVan FC's fixture list from vmslsoccer.com and prints JSON.
 * Zero dependencies. Node 24 strips the types natively:
 *
 *   node /tmp/vmsl-poc.ts            # 2026-27 (current, expected empty)
 *   node /tmp/vmsl-poc.ts 2026       # 2025-26 (completed season, real data)
 *
 * Endpoint (server-rendered HTML, no JS, no POST, no auth):
 *   GET /webapps/spappz_live/team_page?reg_year=<Y>&id=<TEAM>&cmd=htmlsched
 *
 * reg_year is the season END year: 2027 = season 2026-27.
 */

const TEAM_ID = 827; // SouthVan FC
const UA = 'SouthVanFC-fixtures/0.1 (+https://www.southvanfc.com; southvanfc@gmail.com)';

const regYear = Number(process.argv[2] ?? 2027);

type Fixture = {
  matchId: string | null; // VMSL sched_seq_no - stable unique id per match
  date: string | null; // ISO-ish local, America/Vancouver
  rawDate: string;
  competition: string; // "Winter - League" / "Winter - Cup Group"
  division: string; // "Division 4" / "Div 4 Cup"
  status: string | null; // "Forfeited" / "Incomplete" / "Completion"
  homeTeam: string;
  homeTeamId: number | null;
  awayTeam: string;
  awayTeamId: number | null;
  homeScore: number | null;
  awayScore: number | null;
  venue: string | null;
  venueRef: number | null;
  note: string | null;
};

const decode = (s: string) =>
  s
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();

/** Split a row chunk into its <td> inner-HTML segments. Markup is malformed
 *  (unquoted attrs, nested <a>, unclosed <tr>) so we cannot rely on </td>. */
function cells(rowHtml: string): string[] {
  return rowHtml
    .split(/<td\b/i)
    .slice(1)
    .map((c) => c.slice(c.indexOf('>') + 1).split(/<\/td>/i)[0]);
}

/** "Sat 9/6/2025 6:00PM" -> "2025-09-06T18:00:00" (America/Vancouver, naive) */
function toIso(raw: string): string | null {
  const m = raw.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!m) return null;
  const [, mo, d, y, hhs, mm, ap] = m;
  let hh = Number(hhs) % 12;
  if (ap.toUpperCase() === 'PM') hh += 12;
  const p = (n: number | string) => String(n).padStart(2, '0');
  return `${y}-${p(mo)}-${p(d)}T${p(hh)}:${mm}:00`;
}

function parseTeam(td: string): { name: string; id: number | null } {
  const id = td.match(/team_page\?id=(\d+)/);
  // Drop the "(FF)" forfeit marker that sits in a nested <a>.
  const name = decode(td).replace(/\(FF\)/g, '').trim();
  return { name, id: id ? Number(id[1]) : null };
}

async function main() {
  const url = `https://vmslsoccer.com/webapps/spappz_live/team_page?reg_year=${regYear}&id=${TEAM_ID}&cmd=htmlsched`;
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
  const html = await res.text();

  // Narrow to the schedule table before parsing, so nav/footer cannot leak in.
  const tStart = html.search(/<table[^>]*class="[^"]*smart_table/i);
  const table = tStart === -1 ? '' : html.slice(tStart, html.indexOf('</table>', tStart));

  const fixtures: Fixture[] = [];
  let competition = '';
  let status: string | null = null;

  if (table) {
    for (const chunk of table.split(/<tr\b/i).slice(1)) {
      const tds = cells(chunk);
      const first = tds[0] ? decode(tds[0]) : '';

      // Full-width row: either a competition header or a trailing note.
      if (/colspan=6/i.test(chunk) && tds.length === 1) {
        if (/Records Listed/i.test(first) || !first) continue;
        if (/<i>/i.test(tds[0])) {
          if (fixtures.length) fixtures[fixtures.length - 1].note = first;
          continue;
        }
        const st = first.match(/\(([^)]+)\)\s*$/);
        status = st ? st[1] : null;
        competition = first.replace(/\s*\([^)]*\)\s*$/, '').trim();
        continue;
      }

      if (!/\d{1,2}\/\d{1,2}\/\d{4}/.test(first)) continue; // not a fixture row

      const home = parseTeam(tds[2] ?? '');
      const away = parseTeam(tds[4] ?? '');
      const score = decode(tds[3] ?? '').match(/(\d+)\s*-\s*(\d+)/);
      const venueRef = (tds[5] ?? '').match(/field_ref=(\d+)/);

      fixtures.push({
        matchId: (tds[3] ?? '').match(/sched_seq_no=(\d+)/)?.[1] ?? null,
        date: toIso(first),
        rawDate: first,
        competition,
        division: decode(tds[1] ?? ''),
        status,
        homeTeam: home.name,
        homeTeamId: home.id,
        awayTeam: away.name,
        awayTeamId: away.id,
        homeScore: score ? Number(score[1]) : null,
        awayScore: score ? Number(score[2]) : null,
        venue: decode(tds[5] ?? '') || null,
        venueRef: venueRef ? Number(venueRef[1]) : null,
        note: null,
      });
    }
  }

  // Sanity check against VMSL's own "N Records Listed" footer, when present.
  const claimed = table.match(/(\d+)\s+Records Listed/i);
  console.log(
    JSON.stringify(
      {
        source: url,
        season: `${regYear - 1}-${regYear}`,
        scrapedAt: new Date().toISOString(),
        countParsed: fixtures.length,
        countClaimedByVmsl: claimed ? Number(claimed[1]) : null,
        fixtures,
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error('FAILED:', e.message);
  process.exit(1);
});
