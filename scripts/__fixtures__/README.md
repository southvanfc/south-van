# Saved VMSL responses

Real responses from `vmslsoccer.com`, saved so `scrape-vmsl.test.ts` can test the
parse offline. Nothing in the test suite touches the network.

| File | Request |
|---|---|
| `schedule-2025-26.html` | `team_page?reg_year=2026&id=827&cmd=htmlsched` |
| `schedule-2026-27.html` | `team_page?reg_year=2027&id=827&cmd=htmlsched` |
| `standings-2025-26-all.html` | `div_stats?reg_year=2026&division=4&sched_pool=&sched_type=reg&firsttime=1` |
| `standings-2026-27.html` | `div_stats?reg_year=2027&division=4&sched_type=reg&firsttime=1` |

Captured 30 July 2026.

Two things make 2025-26 the season worth testing against. It is complete, so the
published standings can be checked against arithmetic over the results. And it
contains every awkward case the parser has to survive: two forfeits, a match
abandoned in November and completed the following February, and a cup group tie
drawn in normal time and settled on penalties.

`sched_pool` is deliberately empty on the 2025-26 standings request, so both
pools come back at once and the scraper can derive which one we are in. South
Van were in Pool B that season and are in Pool A for 2026-27, which is why the
pool is never hardcoded.

To refresh one of these, re-run the request with the User-Agent from
`scripts/vmsl.config.json` and expect the test expectations to need updating
alongside it.
