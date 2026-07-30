# SEO Audit: /soccer-academy/player-evaluation/

**Audit Date:** July 28, 2026
**Page:** `https://www.southvanfc.com/soccer-academy/player-evaluation/`
**Audit Type:** Single-page deep audit + fixes applied
**Previous Audits:** `seo-audit-southvanfc-july2026.md` (Jul 20), `seo-audit-southvanfc-may2026.md` (May 25)
**Stack:** Astro 6 (SSR, `output: "server"`), Vercel

> **Status: 12 of 14 findings are fixed and committed to the codebase.** The audit was written first as recommendations only, then the fixes were applied in the same session. See "Applied in This Pass" below for what changed and "Still Open" for the two items that need assets or owner input.

---

## Executive Summary

This is the first time the player evaluation page has been audited on its own. The two prior passes were site-wide and only touched it in aggregate, which is how a page this important ended up with the problems below.

It is the most link-equity-rich page on the site after the homepage. Roughly 30 internal links point at it: every navigation menu, the announcement banner, the footer, the mobile drawer CTA, every academy and pricing CTA, and 11 separate blog posts. That is a large amount of accumulated authority pointing at a single URL.

The page does very little with it. Three findings account for most of the gap:

**The H1 does not contain either keyword the page is trying to rank for.** The title tag targets "Soccer Player Evaluation in Vancouver". The H1 reads "Request Your Free Player Evaluation", which contains neither "soccer" nor "Vancouver". The single strongest on-page relevance signal is pointed somewhere else.

**The page is a link sink.** It absorbs ~30 internal links and passes none onward. The only links in the body are the two breadcrumb items and a `mailto:`. There is no link to the academy page, the pricing page, the coaches page, or the one blog post that is directly on-topic. Authority flows in and stops.

**There is very little for a crawler to read.** Roughly 250 to 300 words of actual prose. The 36 KB form is almost entirely input controls, which contribute essentially nothing to relevance. For a commercial-intent local query, that is thin.

None of these are hard to fix and none require redesigning the page. The H1 is one line. The internal links and the prose block are a single new section. The remaining findings are smaller.

**Overall assessment: a high-value page that is underperforming its own link profile.** The technical foundation is sound (canonical correct, breadcrumb schema present, indexable, mobile-clean). What is missing is on-page relevance and outbound linking.

---

## Applied in This Pass

All changes below are committed. Build passes (`astro check`: 0 errors; `astro build`: complete) and the rendered output was verified against a local preview server, not just the build log.

**Head and metadata**
- Title now leads with the offer: "Free Soccer Player Evaluation in Vancouver | South Van FC" (57 chars).
- Meta description rewritten to 137 characters, so the U8-to-adult range no longer truncates.
- Dead `keywords` property removed from the page.

**H1 (finding 1)**
- Rewritten to "Free Soccer Player Evaluation in Vancouver". The visual treatment is preserved: "Free Soccer" on line one, "Player Evaluation" in gold on line two, and a new smaller `.hero-title-sub` line for "in Vancouver". Verified the rendered text extracts cleanly as one sentence rather than running words together.

**Content and internal links (findings 2, 3)**
- New component `src/components/PlayerEval/EvalAbout.astro`, rendered last so the form stays immediately reachable from the hero. Roughly 600 words in four blocks: how the private session works, what coaches watch, what the report contains, and what happens afterwards.
- "What we watch" documents the assessment in the club's own terms: on the ball, off the ball, body mechanics, and temperament. Body mechanics in particular (deceleration, balance through contact, asymmetries) is a real differentiator that was not described anywhere on the site.
- It carries four contextual internal links: `/our-coaches/`, `/soccer-academy/`, `/soccer-academy/pricing/`, and `/blogs/what-coaches-look-for-at-tryouts/`. The page is no longer a link sink.
- **Correction applied after review:** the first draft of this copy described the evaluation as "our version of a tryout" and mentioned small-sided games. Both were wrong. Evaluations are private one-to-one sessions, and the club does not run them as trials. The copy was rewritten to lead with "One player, one session" and to state plainly that nobody is competing for a place. See finding 4.

**Structured data (findings 5, 6)**
- `provider` now references the canonical club entity `https://www.southvanfc.com/#sportsclub` while staying self-describing with `@type`, `name` and `url`.
- Added `serviceType`, an `audience` covering U8 through adult, and an `offers` block with `price: "0"`, `priceCurrency: "CAD"` and `availability`. The free first session is now machine-readable.
- JSON-LD validated as parseable; three blocks render (Organization, BreadcrumbList, Service).

**Heading structure (finding 8)**
- The page outline went from 3 headings to 22, correctly nested with no skipped levels.
- `EvalMeta`: the three column labels are now `h2`, the four pillar labels `h3`.
- `EvalProcess`: the four step titles are now `h3`.
- `EvalRequestForm`: the six sections are now `<fieldset>` elements with `aria-labelledby` pointing at their `h3` label, which gives correct form grouping for screen readers without duplicating text in a hidden `<legend>`. Fieldset UA defaults (groove border, padding, margin, `min-inline-size`) are reset so the field grids are unaffected.
- Every tag swap pins `line-height: 1` in its class, because the global reset sets `body` to `1` while `h2`/`h3` introduce `1.2`/`1.25`. Rendering is unchanged.

**Cannibalization (finding 9)**
- The academy page's four-pillar descriptions were cut to short labels, and the intro now links through to this page for the full breakdown. The evaluation page owns the depth; the academy page summarises and passes a link.

**Other**
- `fall-season-prep.md` link normalized to the relative trailing-slashed form, removing the double redirect hop (finding 12).
- Static sitemap routes now carry `lastmod`. This required removing a `.map()` that was overwriting every static route's `lastmod` with `undefined` (finding 13).
- Dead `.eval-body` CSS block deleted from the page (finding 14).

### Still Open

| # | Item | Why it was not applied |
|---|---|---|
| 11 | 1200x630 OG image | Needs a designed image asset, which cannot be generated here. The site-wide 500x500 default remains. |
| n/a | Verify GSC re-indexing | Owner task. Use URL Inspection on `/soccer-academy/player-evaluation/` and `/soccer-academy/` to request re-crawl now that the H1, description and content have changed. |

---

## Constraint Noted

The form must stay quickly accessible. An earlier version of this audit recommended moving the eligibility and process sections above the form so the crawlable prose came first. **That recommendation has been withdrawn.** All content recommendations below are positioned to leave the form exactly where it is, immediately under the hero.

---

## Findings

### High Severity

| # | Issue | Evidence | Fix |
|---|---|---|---|
| 1 | **H1 carries neither target keyword.** H1 is "Request Your Free Player Evaluation". Neither "soccer" nor "Vancouver" appears, though the title tag targets both. This is the highest-leverage single-line change on the page. | `src/components/PlayerEval/EvalHero.astro:33-35` | Rewrite to "Free Soccer Player Evaluation in Vancouver". The existing two-line split with the gold `<em>` accent can be preserved by breaking after "Soccer". |
| 2 | **Page emits no internal links.** Receives ~30 inbound internal links, passes none onward except two breadcrumb items and a `mailto:`. | Whole page; verified across `EvalHero`, `EvalRequestForm`, `EvalMeta`, `EvalProcess` | Add 3 to 4 contextual links in the new prose block (finding 3): `/soccer-academy/`, `/soccer-academy/pricing/`, `/our-coaches/`, and `/blogs/what-coaches-look-for-at-tryouts/`. |
| 3 | **Thin crawlable copy.** Roughly 250 to 300 words total: one 40-word hero paragraph, six eligibility bullets, four pillar fragments, four step blurbs. Everything else is form controls. | `EvalHero.astro:38-42`, `EvalMeta.astro:4-34`, `EvalProcess.astro:4-25` | Add a 200 to 300 word section **below the form**: what actually happens in a session, which coach runs it, where it takes place, what the written report contains, what happens after. This is also where the internal links from finding 2 belong. |
| 4 | ~~**"Tryout" intent is completely unserved.**~~ **Withdrawn on positioning grounds.** The original recommendation was to frame the evaluation as the club's version of a tryout in order to capture `soccer tryouts Vancouver`. That is wrong: a tryout is competitive selection against other players, an evaluation is an individual assessment. Chasing the query would have misdescribed the service and undercut the actual differentiator. | `player-evaluation.astro:12` vs. all rendered copy | No change to this page. The tryout query is legitimately served by `/blogs/what-coaches-look-for-at-tryouts/`, which is about that setting. Link to it as a related but distinct topic, not as a synonym. |

### Medium Severity

| # | Issue | Evidence | Fix |
|---|---|---|---|
| 5 | **Service schema fragments the entity graph.** `provider` declares a brand new anonymous `Organization` node rather than referencing the club entity already published on the homepage as `#sportsclub`. Search engines see a loose duplicate instead of a connection to the established entity. | `player-evaluation.astro:45-49` | Replace the inline object with `provider: { "@id": "https://www.southvanfc.com/#sportsclub" }`. |
| 6 | **Schema omits the free price, which is the page's main hook.** "First session free" is the strongest thing about this offer and it is stated in the hero pill, the eligibility list, and the meta description, but not in the structured data. | `player-evaluation.astro:41-56` | Add `offers` with `price: "0"` and `priceCurrency: "CAD"`, plus `serviceType: "Soccer player evaluation"` and an `audience` covering U8 through adult. |
| 7 | **Meta description truncates.** 175 characters against a truncation point around 155 to 160. The clipped tail is "for players from U8 through adult", which is the most useful qualifier in the sentence and the one that answers the parent's actual question. | `player-evaluation.astro:8-10` | Tighten to roughly 150 characters, keeping "free", "Vancouver", and the U8-to-adult range. Something like: "Book a free soccer player evaluation in Vancouver. South Van FC coaches assess technical, tactical and physical ability, U8 through adult." (139 chars) |
| 8 | **Section headings are `div`s, so the document outline is flat.** The page's entire machine-readable outline is one H1 and two H2s. Every other section title is a styled `div`. `EvalRequestForm.astro` contains **zero** heading elements across all 6 of its form sections. | `EvalMeta.astro:41,69,94`; `EvalProcess.astro:45`; `EvalRequestForm.astro` (6 × `fsec-label`, 0 × `<h*>`) | Promote to semantic H2/H3. Because the styling is driven by the existing class names (`col-eyebrow`, `step-title`, `fsec-label`), swapping the tag changes nothing visually as long as the class is kept. Grouping the form's 6 sections in `fieldset`s fixes the same problem and is the correct accessibility structure for a form this large. |
| 9 | **Cannibalization with the academy page.** `/soccer-academy/` renders its own near-duplicate four-pillar block ("What We Evaluate": Technical Skills, Physical Attributes, Tactical Understanding, Mental Fortitude) covering the same ground as this page's pillars. Two URLs compete for the same evaluation queries. | `src/components/SoccerAcademy/Evaluation.astro:4-28` vs. `EvalMeta.astro:13-34` | Shorten the academy-page section to a brief summary that links through, and let the evaluation page own the depth. Consolidates the signal on the page that should rank. |

### Low Severity

| # | Issue | Evidence | Fix |
|---|---|---|---|
| 10 | **Dead `keywords` property.** The page sets a `keywords` string, but `BaseLayout` stopped rendering `meta keywords` in the July pass. The data is inert. It is still authored on this page and five others. | `player-evaluation.astro:12`; `BaseLayout.astro` (no keywords tag) | Delete the property here, and optionally from the `SEO` interface in `src/types/types.ts` plus the five other pages, so nobody maintains dead data. |
| 11 | **No page-specific `ogImage`.** Falls back to `og-default.png`, which is 500x500 and therefore renders cropped and small under `summary_large_image`. The site's top conversion page is the one paying for this. | `player-evaluation.astro:6-14`; `public/og/og-default.png` (500x500) | The site-wide 1200x630 default was already logged as an open item in the July audit. A dedicated evaluation-page OG image would do better still, since this is the URL most often shared into parent group chats. |
| 12 | **Missed link normalization from the July pass.** One blog link still uses an absolute non-www URL with no trailing slash. Under `trailingSlash: "always"` that is a double redirect hop (non-www to www, then slash-append), and the blog template's external-link script opens it in a new tab. The July audit reported all 81 internal links as normalized; this one was missed. | `src/content/blog/fall-season-prep.md:87` | Change to the relative form `/soccer-academy/player-evaluation/`, matching the other 10 blog posts. |
| 13 | **No `lastmod` for static routes in the sitemap.** All ten static routes are emitted with `lastmod: undefined`, including this page. Blog posts get one from `pubDate`. | `src/pages/sitemap.xml.ts:32` | Add a manual `lastmod` per static route, updated when the page changes. Minor freshness signal. |
| 14 | **Dead CSS in the page component.** The page's `<style>` block defines only `.eval-body`, which matches no element on the page. The classes actually used (`.form-wrap`, `.form-panel`, `.panel-title`, `.panel-sub`) live in the global stylesheet. | `player-evaluation.astro` style block; `src/styles/global.css:376-414` | Delete the block. Housekeeping, no SEO effect. |

---

## State Checklist (before and after)

| Check | Before | After | Notes |
|---|---|---|---|
| Indexable | PASS | PASS | No `robots` override, inherits `index,follow`. Correct for this page. |
| Canonical | PASS | PASS | Auto-derived from pathname by `BaseLayout`, trailing-slash normalized. Resolves to the www host. |
| Title tag | PASS | PASS | Now 57 chars and leads with "Free", matching the offer. |
| Meta description | WARN | PASS | 175 chars to 137. No longer truncates. |
| H1 | FAIL | PASS | Now "Free Soccer Player Evaluation in Vancouver". |
| Heading hierarchy | WARN | PASS | 3 headings to 22, correctly nested, no skipped levels. |
| Open Graph / Twitter | WARN | WARN | Tags all present via `BaseLayout`. Image is still 500x500 against a `summary_large_image` card. Needs a designed asset. |
| Structured data | WARN | PASS | `Service` now links to `#sportsclub`, declares the free price, `serviceType` and `audience`. Three JSON-LD blocks validated as parseable. |
| Visible breadcrumb | PASS | PASS | Present in `EvalHero`, `aria-label="Breadcrumb"`, mirrors the JSON-LD exactly. |
| Internal links inbound | PASS | PASS | ~30, from nav, banner, footer, academy CTAs and 11 blog posts. Strong. |
| Internal links outbound | FAIL | PASS | 4 contextual links added: coaches, academy, pricing, tryouts post. |
| Content depth | FAIL | PASS | ~250 to 300 words to ~600 of prose, plus the form. |
| Images / alt text | N/A | N/A | The page contains no content images. All graphics are inline SVG icons or CSS, correctly marked `aria-hidden`. |
| In sitemap | PASS | PASS | Priority 0.8, changefreq monthly, and now carries `lastmod`. |
| Mobile | PASS | PASS | Breakpoints at 960px and 480px across all five components. |
| Form accessibility | WARN | PASS | Inputs already had real `<label for>` and `aria-live` error slots. Sections are now `fieldset`s named by their `h3` via `aria-labelledby`. |
| Post-submit handling | PASS | PASS | Redirects to `/success/`, which is correctly `noindex,follow`. |

---

## Not Recommended, and Why

Three things that would normally appear in an audit like this are deliberately excluded.

**`HowTo` schema on the four-step process.** The "Four Steps to Your Evaluation" section looks like an obvious `HowTo` candidate. Google removed HowTo rich results entirely in 2023. Adding the markup would produce no rich result and no ranking benefit, just more JSON-LD to maintain.

**`FAQPage` schema as a rich-result play.** Since August 2023, FAQ rich results have been restricted to authoritative government and health sites. A club site will not get the snippet. An FAQ *section* is still worth writing, for long-tail coverage and because AI answer engines lean on question-shaped content, but it should be justified on those grounds and not sold as a rich snippet.

**Reordering the page so context precedes the form.** Ruled out by the constraint that the form stays quickly accessible. Finding 3's prose block is therefore positioned below the form rather than above it.

---

## Prioritized Actions

**Highest return, smallest effort**

1. ~~Rewrite the H1 to carry "Soccer" and "Vancouver"~~ (finding 1). **Done.**
2. ~~Tighten the meta description below 160 characters~~ (finding 7). **Done.**
3. ~~Fix the `fall-season-prep.md` link~~ (finding 12). **Done.**

**On-page**

4. ~~Add the prose section below the form, carrying the internal links and the "tryout" mention~~ (findings 2, 3, 4). **Done** via `EvalAbout.astro`.
5. ~~Promote the `div` headings to semantic H2/H3 and group the form's 6 sections in `fieldset`s~~ (finding 8). **Done.**
6. ~~Point `provider` at `#sportsclub` and add the free-price `offers` block~~ (findings 5, 6). **Done.**

**Cleanup**

7. ~~Remove the dead `keywords` property and the dead `.eval-body` CSS~~ (findings 10, 14). **Done.**
8. ~~Resolve the academy-page pillar duplication~~ (finding 9). **Done.**
9. Add a 1200x630 OG image, ideally one specific to this page (finding 11). **Open, needs a design asset.**
10. ~~Add `lastmod` to static sitemap routes~~ (finding 13). **Done.**

**Owner follow-up**

11. Request re-indexing in GSC for `/soccer-academy/player-evaluation/` and `/soccer-academy/`, since the H1, description, structured data and body content all changed.
12. Watch GA4 organic landing-page data for this URL over the next few weeks to see whether the H1 and content changes move impressions on evaluation and tryout queries.

---

## Note on the July Audit

While verifying against source for this pass, one inaccuracy surfaced in `seo-audit-southvanfc-july2026.md`. It reports adding a blog post named `soccer-training-for-kids-vancouver-by-age.md`. That file does not exist in `src/content/blog/`. The other post it claims, `what-is-an-individual-development-plan-soccer.md`, is present. Worth confirming whether the age-by-age post was written and lost, or never written.

Separately, that audit's project rule files (`claude/rules/*.md`) still describe a `createSEO()` helper in `src/lib/seo.ts` and `@astrojs/sitemap` as the sitemap mechanism. Both are wrong: the helper was deleted in the July pass and the sitemap integration is not registered in `astro.config.mjs`. Anyone following those rules will write code that does not work.

Every claim in this document was read from source on July 28, 2026, not carried forward from the earlier audits.
