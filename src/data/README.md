# Fixtures and results: how to keep this up to date

Everything on the fixtures and results page comes from **`fixtures.json`**. Edit that one
file, run one command, commit. You do not need to touch any other file.

```bash
npm run validate:fixtures
```

Run it every time before you commit. It checks the file and tells you in plain language what
is wrong and how to fix it. It also runs automatically as part of `npm run build`, so a broken
file cannot reach the live site.

> **Why is this file JSON when everything else here is TypeScript?**
> Two reasons: a scraper will eventually write it automatically, and JSON produces small clean
> diffs that are easy to review in a pull request. `fixtures.ts` sits next to it, imports it and
> adds the types, so the rest of the site imports `fixtures.ts` exactly like `coaches-data.ts`.
> You never need to edit `fixtures.ts`.

---

## The one rule that matters

**Scores are always the HOME team first. Never South Van's goals first. Ever.**

If we lose 3-2 away, you write:

```json
"isHome": false,
"homeScore": 3,
"awayScore": 2
```

`homeScore: 3` is the opposition. `awayScore: 2` is us. It feels backwards when you are typing
it, and it is still correct.

This is not a style preference. An earlier version of this page had three away results entered
the wrong way round. It silently turned two defeats into wins, and the league table still looked
completely plausible. The validator now catches it, which is exactly why you run it.

---

## Adding a result

Find the match in the `matches` list, fill in the two scores, update the standings, validate,
commit. Here are the two cases side by side. **The away one is where mistakes happen.**

### A home win, 4-1

We are at home, so our goals go in `homeScore`.

```json
{
  "id": "21809",
  "date": "2026-11-15",
  "opponentSlug": "joyous-fc",
  "isHome": true,
  "homeScore": 4,   // us
  "awayScore": 1    // them
}
```

### An away defeat, 3-2

We are away, so our goals go in `awayScore`. The bigger number belongs to the team that won,
and that is not us.

```json
{
  "id": "21808",
  "date": "2026-11-07",
  "opponentSlug": "vancouver-harps-fc-c",
  "isHome": false,
  "homeScore": 3,   // them
  "awayScore": 2    // us
}
```

Read it back once before you save. Ask yourself "did the home team really score that many?"

---

## Updating the standings after a result

The `standings` list is the league table. After a league result, find our row
(`"clubSlug": "south-van-fc"`) and move these fields:

| Field | What changes |
| --- | --- |
| `played` | always up by 1 |
| `won` / `drawn` / `lost` | exactly one of these goes up by 1 |
| `goalsFor` | up by the goals **we** scored |
| `goalsAgainst` | up by the goals **they** scored |
| `form` | add the new result to the **end**, drop the oldest if there are now more than 5 |

`form` runs oldest to newest, so `"DWWLW"` means the most recent match was a win.

Then do the same to the opponent's row, mirrored: their win is our loss, their goalsFor is our
goalsAgainst. If you only update one row, the validator will tell you, because total wins across
the division must equal total losses.

Cup ties do **not** go in the standings. Only league matches.

---

## The awkward results

Four of last season's 23 fixtures needed one of these, so they come up.

### Postponed or cancelled

Leave both scores as `null` and add a status. Do not delete the match.

```json
"homeScore": null,
"awayScore": null,
"status": "postponed",
"note": "Postponed, field closure. Rescheduled date to be confirmed by VMSL."
```

Postponed and cancelled matches are skipped by the "next match" panel, so a dead date will not
show up as our next fixture. When VMSL confirms the new date, change `date` and `time` and
remove the `status` and `note` lines.

### A forfeit

A forfeit **is** a result and gets a scoreline, normally 3-0 to the team that turned up.

```json
"homeScore": 3,
"awayScore": 0,
"status": "forfeited",
"note": "Awarded 3-0 to South Van FC. Joyous FC unable to field a team."
```

It counts in the standings like any other win. The validator will complain if you mark something
`forfeited` and leave the scores empty.

### A cup tie decided on penalties

**Leave the 90 minute scoreline as a draw.** Put the shootout in `note`.

```json
"competition": "cup",
"homeScore": 2,
"awayScore": 2,
"note": "Drawn 2-2 after 90 minutes. South Van FC won 5-4 on penalties."
```

The page will show it as a draw with the note underneath. This is deliberate. If you recorded
the shootout as a 3-2 win in the scoreline, the score shown on the page and the score VMSL
publishes would disagree, and so would our goal difference.

### Abandoned and finished later

Use `status: "completion"` with the final score, and explain in `note`:

```json
"homeScore": 2,
"awayScore": 2,
"status": "completion",
"note": "Abandoned at 1-1 on 18 October for a waterlogged pitch. Last 75 minutes completed on 24 January."
```

---

## Adding or changing a fixture

Copy an existing match, paste it in, and change every field. **Change the `id`.** Two matches
with the same id is an error.

- `id` is VMSL's own `sched_seq_no`, the number in their schedule page URL. If VMSL has not
  published the match yet, use the date and opponent instead, like `"2027-04-11-joyous-fc"`.
- `date` is `YYYY-MM-DD`, year first. **VMSL shows dates month first**, so their
  `Sat 9/6/2025 6:00PM` is our `"2025-09-06"` and `"18:00"`. That is a conversion, not a copy,
  and it is easy to get wrong in the first twelve days of a month.
- `time` is 24 hour. 6:00PM is `"18:00"`. 12:30PM is `"12:30"`.
- `opponentSlug` must exactly match a `slug` in the `clubs` list at the top of the file.
- `venue` is our home ground `"Empire Field"` when `isHome` is true.
- `competition` is `"league"`, `"cup"` or `"friendly"`.

**Venue change only:** just edit `venue`. Nothing else moves.

**New opponent:** add them to the `clubs` list first, with a `name`, a 2 to 4 letter `tag`, a
url safe `slug`, a hex `colour` for their badge, and a `vmslName`. Every club needs a
`vmslName`, even when it is identical to `name`, because half filled VMSL names make matching
fail silently. Ours is `"SouthVan FC"`, one word, because searching VMSL for "South Van" returns
nothing.

---

## Season rollover

Once a season finishes:

1. Move every played match from `matches` into `history`. Keep them exactly as they are, but add
   the season to `competitionLabel` so it still reads clearly, for example
   `"VMSL Division 4A, 2026-27"`.
2. Empty `matches` and add the new season's fixtures.
3. Reset every `standings` row to `played`, `won`, `drawn`, `lost`, `goalsFor` and `goalsAgainst`
   of `0`, and `form` to `""`. Remove clubs that are no longer in our division and add the new
   ones, in `clubs` as well as `standings`.
4. Update `season` and `division` at the top of the file.
5. Update `updatedAt`.

History is what the head to head panel reads, so it is worth keeping. It never affects the
league table.

---

## When validation fails

The message tells you the location, the problem and the fix. These three are the common ones.

**`homeScore is set to 3 but awayScore is null`**
You filled in one score and not the other. Add the missing one. If we were away, remember the
missing one is probably ours.

**`opponentSlug "hibernian-fc" does not match any club. Did you mean "hibernians-fc"?`**
A typo in the slug, or a club you have not added to the `clubs` list yet. Slugs must match
character for character.

**`The table says won is 6, but adding up our league results gives 5`**
The standings row and the match results disagree. Usually one of two things: you added a result
but forgot to update the table, or **you entered an away score the wrong way round** and turned a
defeat into a win. Check the most recent away result first.

You may also see a warning rather than an error:

**`Kicked off on 2026-11-22, more than three days ago, and still has no score`**
Not a failure, and it will not block a deploy. It just means a match has been and gone and
nobody has entered the result yet.
