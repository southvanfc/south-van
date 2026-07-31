# scripts

| File | What it is |
|---|---|
| `scrape-vmsl.ts` | Proposes updates to `src/data/fixtures.json` from vmslsoccer.com |
| `vmsl-parse.ts` | The HTML parse and normalise steps, kept separate so they can be tested offline |
| `scrape-vmsl.test.ts` | Offline tests for the above, run by `npm test` |
| `validate-fixtures.ts` | The rules `fixtures.json` has to pass, run at build time and by the scraper |
| `pr-body.ts` | Turns a scrape log into the body of the refresh pull request |
| `vmsl.config.json` | Season, division, team and User-Agent |
| `vmsl-poc-reference.ts` | The original throwaway spike. Kept for reference, not wired to anything |
| `__fixtures__/` | Real VMSL responses saved for the tests |

`fixtures.json` is hand maintained and is the source of truth. The scraper is a
convenience that suggests changes to it, never the system of record. Every
failure path leaves the existing file exactly as it was.

## Running the scraper

```sh
npm run scrape:vmsl -- --dry-run     # fetch, parse, check, print the diff, write nothing
npm run scrape:vmsl                  # the same, then write src/data/fixtures.json
npm run scrape:vmsl -- --verbose     # add the URLs fetched and every match parsed
```

Start with `--dry-run`. It does everything the real run does, including the
validator, and tells you what would change without touching the file. Then drop
the flag if the diff looks right.

Two other flags exist:

- `--allow-empty-season` turns "VMSL returned no fixtures" from a failure into a
  normal outcome. Correct before the schedule is published, usually mid to late
  August, and wrong at any other time. It never lets an empty file replace a
  populated one.
- `--config=<path>` points at a different config, which is mainly useful for
  trying a season or division without editing the real one.

The run takes about three seconds. Two requests, one second apart, no browser.

Nothing here happens automatically yet. `.github/workflows/scrape-vmsl.yml` can
run the scraper on a schedule and open a pull request with the result, but the
schedule is commented out on purpose. vmslsoccer.com's `robots.txt` is
`User-agent: * / Disallow: /webapps`, and `/webapps` is every endpoint the
scraper uses. A club member running it by hand is fine. An unattended bot on a
timer is not, until either VMSL send written permission, which belongs in this
directory next to the scraper, or they add `User-agent: SouthVanFC-fixtures`
with `Allow: /webapps`. Until then use `workflow_dispatch` in the Actions tab,
or just run it locally.

## Config, and what to change at season rollover

Everything seasonal lives in `vmsl.config.json`:

```json
{
  "season": "2026-27",
  "regYear": 2027,
  "division": "4",
  "divisionLabel": "VMSL Division 4A",
  "teamName": "SouthVan FC",
  "teamId": "827",
  "homeVenue": "Memorial South Park",
  "userAgent": "SouthVanFC-fixtures/1.0 (+https://www.southvanfc.com; southvanfc@gmail.com)"
}
```

At rollover, once VMSL publish the new season:

1. `season` and `regYear` together. **`regYear` is the season end year**, so
   2027-28 is `regYear` 2028. Getting this wrong scrapes last season and
   republishes it as this one, which is why the two are redundant: the scraper
   refuses to run if they disagree, and checks the match dates as well.
2. `division` and `divisionLabel` if the club went up or down. `division` is
   VMSL's own number in the URL, `divisionLabel` is what appears on the site.
   The pool inside the division is never configured, it is derived by finding
   `teamId` in the table, because pools get reshuffled every year.
3. `teamId` only if VMSL issue a new one. Check the team page URL.
4. `homeVenue` only if the club moves. It is used to flag home matches that VMSL
   has at a different ground, not to override VMSL.

The first run of a new season moves completed matches from the old one into
`history` and starts the current season from what VMSL has published. That is
one large diff by design. Read it before merging, since it is the one run a year
where a lot moves at once.

Also worth updating: `season` in `src/data/fixtures.json` is what the scraper
compares against to notice the rollover, and it will tell you it has happened in
the run output.

## When VMSL changes its markup

VMSL have no API and none of this is supported by them, so assume the parse
breaks eventually. It is built to break loudly rather than quietly, so a failing
run is the system working. Expect one of these:

- `VMSL's footer says N records but M were parsed`. Their own count and ours
  disagree, so the row layout moved.
- `Only N matches were parsed`. A partial parse, treated as breakage rather than
  a short season.
- `The standings table has N clubs`. The table did not parse.
- `South Van FC is not in the parsed standings`. Either the team id is wrong or
  the club changed division, so check the config before touching the parser.

To fix one:

1. Save the response that broke. The two URLs are in the run output with
   `--verbose`, and `__fixtures__/README.md` lists them.
2. Drop it into `scripts/__fixtures__/` and add a case to `scrape-vmsl.test.ts`
   that fails the way the real run failed. `npm test` never touches the network,
   so this is the fast loop.
3. Fix `vmsl-parse.ts` until it passes. Parsing is all in there. `scrape-vmsl.ts`
   handles fetching, reconciling and checking, and rarely needs to change.
4. Run `npm run scrape:vmsl -- --dry-run` against the live site before merging.

Do not weaken the checks in `runChecks` to get a run through. They are the only
reason it is safe to point a scraper at a hand maintained file.

## Scores are stored home team first

`homeScore` and `awayScore` are always the home team's goals and the away team's
goals, whichever side we were. A 2-1 away win is stored as `homeScore: 1`,
`awayScore: 2` with `isHome: false`. Use `ourScore` and `theirScore` from
`src/lib/fixtures.ts` rather than reading the fields directly, and read any
scoreline in a diff or a pull request body the same way.
