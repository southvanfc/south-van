# SEO Audit: southvanfc.com

**Audit Date:** July 20, 2026
**Previous Audit:** May 25, 2026 (`seo-audit-southvanfc-may2026.md`)
**Audit Type:** Full site audit + fixes applied
**Stack:** Astro 6 (SSR, `output: "server"`), Vercel, `https://www.southvanfc.com`

---

## Executive Summary

Since the May audit, South Van FC has done the hard part: most of the prior recommendations shipped. The URL structure was rebuilt around the target keyword (`/academy/` to `/soccer-academy/`, with redirects preserving the old paths), a content-rich `/mens-team/` page and a `/south-vancouver/` local page were added, the blog roughly tripled from 7 to 20 posts, per-post CTA cards were added, and the coach-page typo was fixed. Google Search Console, a Google Business Profile, and GA4 are all live.

This pass had three jobs: re-audit the current state, fix the concrete defects still present, and add new content. The fixes and content in the "Applied in this pass" section below are already committed to the codebase. What remains is mostly off-site (indexation, local SEO, backlinks) and a short list of optional follow-ups.

The single most valuable fix this pass was **internal linking**. The blog posts already linked to each other and to the academy pages, but almost every link used the non-www domain (`https://southvanfc.com/...`). Because the canonical host is `www`, each link forced a redirect hop and, worse, the blog template's own script treated them as external and opened them in a new tab. Five links were outright broken (pointing at `/blog/` singular or at posts that were never written). All 81 internal links across the 20 posts are now clean, relative, and canonical.

**Overall assessment: strong and improving. The foundation was already good; this pass removed the friction that was quietly undercutting it. The remaining levers are off-site — keep earning indexation and local visibility on the tools already in place.**

---

## Progress Since May

| May recommendation | Status (July) |
|---|---|
| Fix indexation / submit sitemap in GSC | GSC now live (owner-confirmed). Ongoing monitoring task, not a setup task. |
| Rebuild URLs around "soccer academy" keyword | **Done.** `/soccer-academy/` structure with redirects from `/academy/*`. |
| Dedicated Men's Team page | **Done.** `/mens-team/` with content + BreadcrumbList schema. |
| South Vancouver local page | **Done.** `/south-vancouver/`. |
| Add `dateModified` to BlogPosting | **Done this pass.** |
| Fix "Skill Develoment" typo | **Done** (already fixed before this pass). |
| Remove `meta keywords` | **Done this pass.** |
| Grow the blog | **Done.** 7 to 22 posts (20 existing + 2 added this pass). |
| Homepage H1 lacks keywords | **Done.** Hero H1 now carries "Soccer Academy & Football Club in Vancouver". |
| Add in-body CTA links to blog posts | **Done.** Posts have CTA cards + contextual links (cleaned up this pass). |
| Google Business Profile | **Done** (owner-confirmed). Ongoing freshness task. |
| Age-specific academy landing pages | **Intentionally not built** — conflicts with the "One Program. Every Age." positioning. Addressed instead via a new age-by-age blog post. |
| Testimonials page | **Open** — needs real quotes (see Content Gaps). |
| "Best academies in Vancouver" round-up | **Open** — needs real competitor research (see Content Gaps). |

---

## Applied in This Pass (code changes committed)

**Technical / head**
- Removed the `meta keywords` tag (ignored by Google since 2009) from `BaseLayout.astro`.
- Removed the broken `apple-touch-icon.png` reference — the file did not exist, so it 404'd on every page. (See follow-ups: add a real 180×180 PNG + manifest.)
- Added `noindex,follow` and proper title/description to `/success/` (thin form-confirmation page that was indexable).
- Deleted dead code: `src/lib/seo.ts` (never imported, conflicting OG-image default) and the orphaned `src/components/MensEval/MensHero.astro` (duplicate H1).

**On-page**
- Fixed heading order on `/soccer-academy/`: the three hero step titles were `H3` appearing before the first `H2` (H1 to H3 jump). Promoted to `H2`.
- Demoted a stray markdown `#` in `how-to-choose-a-soccer-academy-vancouver.md` that was rendering as a second `H1`.
- Gave the two legal pages distinct meta descriptions (they previously shared the site default).
- Added a visible breadcrumb (Home to Blog to Post) on blog posts, matching the BreadcrumbList JSON-LD that already existed.

**Structured data**
- Added `dateModified` to the BlogPosting schema, backed by a new optional `updatedDate` field in the content schema. Set `updatedDate` on a post when you revise it to signal freshness.

**Internal linking (highest impact)**
- Normalized all 81 internal links across 20 blog posts from absolute non-www URLs to relative, trailing-slashed paths. Eliminates redirect hops and stops internal links being treated as external / opening in new tabs.
- Fixed 5 broken links: remapped `/blog/how-often-should-young-players-train` to the real `/blogs/training-frequency/`, fixed `/blog/the-long-game-player-development` (singular path) to `/blogs/the-long-game-player-development/`, and removed 3 links pointing at posts that were never written (see below).

**New content**
- `what-is-an-individual-development-plan-soccer.md` — explains the IDP, a real club differentiator; targets "individual development plan soccer".
- `soccer-training-for-kids-vancouver-by-age.md` — age-by-age (U8/U10/U12) guide; targets age-specific parent-intent and links into the academy and pricing pages.

---

## Current Technical SEO Checklist

| Check | Status | Notes |
|---|---|---|
| HTTPS | PASS | |
| Canonical tags | PASS | Set in `BaseLayout`, trailing-slash normalized. |
| Titles / descriptions | PASS | Unique per page; legal pages now distinct too. |
| Open Graph / Twitter | PASS | Centralized in `BaseLayout`; blog posts use `article` type. |
| Structured data | PASS | Organization, WebSite, SportsOrganization, SportsClub (geo), FAQPage, BlogPosting (+dateModified now), BreadcrumbList, Person per coach. |
| XML sitemap | PASS | Dynamic at `/sitemap.xml`; blog posts auto-included from the collection. New posts appear automatically. |
| robots.txt | PASS | Allows all, points to sitemap. |
| Heading structure | PASS | Fixed academy H1 to H3 jump and the duplicate blog H1. |
| Internal linking | PASS | Cleaned this pass — all relative, canonical, no broken links. |
| Indexation control | PASS | `/success/` and `/404` now correctly `noindex`. |
| Favicon | PARTIAL | SVG favicon present. No `apple-touch-icon.png` and no web manifest (see follow-ups). |
| OG image quality | WARN | Single default OG image is 500×500. For `summary_large_image` cards a 1200×630 version reads better (see follow-ups). |
| Image alt text | PASS | All images have alt; blog covers/avatars pull from frontmatter. |
| Mobile / speed | PASS (likely) | Astro on Vercel, WebP images, minimal JS. |

---

## Remaining On-Page / Technical Follow-Ups (optional)

| Item | Severity | Fix |
|---|---|---|
| No `apple-touch-icon.png` or web manifest | Low | Add a 180×180 PNG to `/public`, re-add the `<link rel="apple-touch-icon">`, and add a `site.webmanifest` for PWA/home-screen. |
| Default OG image is 500×500 | Low | Create a 1200×630 branded OG image so social shares render as full-width cards. |
| `@astrojs/sitemap` installed but unused | Low | The active sitemap is the hand-rolled route. Remove the unused dependency, or leave it. |
| Sitemap static routes are hand-maintained | Low | New *pages* (not blog posts) must be added to `staticRoutes` in `sitemap.xml.ts` manually. Blog posts are automatic. |
| Domain hardcoded in several files | Low (maintainability) | `https://www.southvanfc.com` is repeated in `BaseLayout`, `[slug].astro`, and `sitemap.xml.ts` rather than derived from `Astro.site`. |
| game-day-prep.md references "physical development" / "mental development" posts in prose | Low (content) | Those links were removed (they 404'd). The sentences still mention the posts as plain text. Either write those posts (a "Four Pillars" series) or revise the wording. |
| New blog posts reuse existing cover images | Low | The 2 new posts point at existing covers (`tactics.webp`, `training.webp`). Add dedicated 1200×630 covers when convenient. |

---

## Content Gap Recommendations (still open)

**1. Testimonials / player stories page** — Priority: Medium. Needs real parent/player quotes; will not be fabricated. Once you supply 4 to 6 quotes, the page + `Review` schema can be built. Add the route to `sitemap.xml.ts` when it ships.

**2. "Best Soccer Academies in Vancouver" round-up** — Priority: High. Needs accurate, real competitor facts. High-intent query; earns links. A content brief can be drafted; the post itself needs real research, not invented claims.

**3. "Four Pillars" development series** — Priority: Medium. The game-day-prep post already gestures at "physical development" and "mental development" posts that do not exist. Writing them would satisfy those references and build topical depth.

---

## Off-Site Action List (owner tasks — tools already live)

1. **GSC:** confirm `/sitemap.xml` is submitted and healthy; review Pages / Coverage for indexed vs. excluded counts. Use URL Inspection to Request Indexing on the two new blog posts and any page you change.
2. **GBP:** keep it fresh — posts, photos, correct categories ("Soccer Club" + "Sports School"), service area (South Vancouver). This is the fastest path into "soccer academy near me" map results.
3. **GA4:** watch organic landing pages to see which blog posts and academy pages actually pull traffic, and double down on what works.
4. **Backlinks:** pursue local links (community sports directories, South Vancouver neighbourhood sites, partner clubs). Domain authority is the main thing time will build.

---

## Prioritized Next Steps

**This week (owner)**
- Request indexing in GSC for the 2 new posts.
- Add a 1200×630 OG image and (optionally) an apple-touch-icon + manifest.

**This quarter**
- Gather testimonials and ship the stories page.
- Write the "Best Soccer Academies in Vancouver" round-up (real research).
- Consider the "Four Pillars" series to close the dangling in-content references.
