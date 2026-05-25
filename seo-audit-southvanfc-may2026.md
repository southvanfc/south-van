# SEO Audit: southvanfc.com
**Audit Date:** May 25, 2026  
**GSC Data Window:** Feb 24 – May 25, 2026 (90 days)  
**Audit Type:** Full Site Audit

---

## Executive Summary

South Van FC's website has strong on-page fundamentals for a club of its age — clean metadata on core pages, solid content on the Academy and Blog sections, and well-structured copy. However, the site is effectively invisible in Google Search. In 90 days, GSC recorded a single impression and zero clicks. A `site:southvanfc.com` search operator query returns no indexed pages for the domain, which confirms a critical indexation problem that must be resolved before any other SEO work matters.

The technical SEO foundation is genuinely strong for a club of this age: proper schema markup throughout (Organization, SportsOrganization, SportsClub with geo, FAQPage, BlogPosting, BreadcrumbList, Person schemas per coach), a dynamic sitemap, canonical tags, and clean metadata on all pages. The priority is not fixing broken infrastructure — it's getting Google to actually see what's already been built.

Two things will move the needle most: (1) confirm the sitemap is submitted in GSC and use URL Inspection to request indexing on key pages, and (2) start building topical authority through the content gaps identified below, especially a men's team page and age-specific academy pages.

The blog is a genuine asset — seven posts published since April 2026, several targeting high-value parent-intent queries. That content investment will pay off once Google indexes the site.

**Overall Assessment: Technically sound, but effectively invisible. The infrastructure is there — the domain just hasn't earned Google's trust yet. Indexation and content depth are the levers.**

---

## Keyword Opportunity Table

| Keyword | Est. Difficulty | Opportunity | Current Ranking | Intent | Recommended Content Type |
|---|---|---|---|---|---|
| soccer academy Vancouver | High | High | Not ranking | Commercial | Academy landing page (optimize existing) |
| youth soccer academy Vancouver | Moderate | High | Not ranking | Commercial | Academy landing page (optimize existing) |
| youth soccer training Vancouver | Moderate | High | Not ranking | Commercial | Academy landing page / blog |
| kids soccer training Vancouver | Moderate | High | Not ranking | Commercial | Academy landing page |
| soccer player development Vancouver | Moderate | High | Not ranking | Commercial | Academy page / philosophy blog |
| technical soccer training Vancouver | Low | High | Not ranking | Commercial | Academy page (add section) |
| soccer coaching for kids Vancouver | Low | High | Not ranking | Commercial | Blog post / Academy page |
| best soccer academy Vancouver | Moderate | High | Not ranking | Commercial | Comparison blog post |
| soccer academy south Vancouver | Low | High | Not ranking | Local | Homepage / local landing page |
| how to choose a soccer academy Vancouver | Low | High | Not ranking | Informational | Existing blog post (strong asset) |
| youth soccer player development Vancouver | Low | High | Not ranking | Informational | Blog / Academy page |
| soccer development program Vancouver | Moderate | Medium | Not ranking | Commercial | Academy page |
| adult soccer Vancouver | Moderate | Medium | Not ranking | Commercial | Men's team page (new) |
| VMSL soccer Vancouver | Low | Medium | Not ranking | Navigational | Men's team page (new) |
| soccer tryouts Vancouver | Moderate | Medium | Not ranking | Transactional | Men's team page |
| soccer academy U12 Vancouver | Low | Medium | Not ranking | Commercial | Age-specific landing page |
| individual soccer training Vancouver | Low | Medium | Not ranking | Commercial | Blog / Academy page |
| soccer academy pricing Vancouver | Low | Medium | Not ranking | Commercial | Pricing page (optimize) |
| video analysis soccer Vancouver | Low | Medium | Not ranking | Commercial | Academy program section |
| soccer camps Vancouver kids | Moderate | Medium | Not ranking | Commercial | Future program page |
| soccer academy for beginners Vancouver | Low | Low | Not ranking | Commercial | Blog post |
| soccer training near me South Vancouver | Low | Low | Not ranking | Local | Google Business Profile + homepage |
| VMSL registration Vancouver | Low | Low | Position 28 | Navigational | Men's team page |
| youth soccer parent guide Vancouver | Low | Low | Not ranking | Informational | Blog |
| game day prep soccer Vancouver | Low | Low | Not ranking | Informational | Existing blog post |

---

## On-Page Issues Table

| Page | Issue | Severity | Recommended Fix |
|---|---|---|---|
| All pages | Site appears unindexed — `site:southvanfc.com` returns 0 results | **Critical** | Confirm the sitemap at `/sitemap.xml` is submitted in GSC (Settings → Sitemaps). Then use URL Inspection → "Request Indexing" on the homepage, /academy, /blogs, and /mens-team-application. Also check `/robots.txt` to ensure Googlebot is not blocked. |
| Homepage | H1 is "South Van FC" only — no service or location keywords | **High** | The eyebrow "Vancouver Football Club" helps contextually but H1 carries more weight. Consider expanding: "South Van FC — Youth Soccer Academy & Football Club, Vancouver" or add a keyword-carrying visible subtitle directly beneath. |
| Homepage | Title tag is 65 characters — slightly over ideal 55–60 char threshold | **Low** | Trim to: "South Van FC \| Youth Soccer Academy Vancouver" (48 chars). Shorter titles are less likely to be rewritten by Google. |
| /blogs/blog-* | Blog post URLs have redundant "blog-" prefix inside /blogs/ path — e.g., /blogs/blog-how-to-choose-a-soccer-academy-vancouver | **Medium** | Since the site isn't indexed yet, this is a clean-slate opportunity: rename slugs by dropping the "blog-" prefix now with no 301s needed. Going forward, name files without it. |
| Blog posts | `articleSchema` missing `dateModified` field | **Low** | Add `dateModified` to the schema in `[slug].astro`. Use `post.data.updatedDate ?? post.data.pubDate` (call `.toISOString()`). This signals freshness when posts are updated. |
| /academy/pricing | H1 is "One Program. Every Age." — no keywords | **Medium** | Treat that as a visual sub-heading. Add a keyword-carrying H1: "Youth Soccer Academy Pricing — Vancouver" styled to match, so Google sees the location-intent term in the page heading. |
| Blog posts | No in-body links to /academy/player-evaluation within post body | **Medium** | The "How to Choose a Soccer Academy" post links to /our-coaches and /academy but not to the evaluation page — the most natural conversion path from that content. |
| /our-coaches | Coach card has typo: "Skill Develoment" | **Low** | Fix to "Skill Development" in coaches-data.ts or the CoachCard component. |
| All pages | `meta keywords` tag populated on all pages | **Low** | Google has ignored this tag since 2009. No active harm but no value either — can be removed when convenient. |
---

## Content Gap Recommendations

### 1. Dedicated Men's Team Page
**Keyword:** adult soccer Vancouver, VMSL men's team Vancouver, soccer tryouts Vancouver  
**Why it matters:** The men's team is one of two core offerings but the /mens-team-application page is primarily a form — it doesn't have enough content to rank for men's team keywords. VMSL is a real search term with demand (the only GSC impression in 90 days is for "vmsl registration"). A content-rich page with team overview, training schedule, VMSL context, and eligibility would compete for these terms where most competitors aren't focused.  
**Recommended format:** Landing page with team overview, training schedule, VMSL league context, eligibility requirements, and embedded application form  
**Priority:** High  
**Effort:** Moderate (half day)

### 2. Age-Specific Academy Landing Pages
**Keywords:** U8 soccer academy Vancouver, U12 soccer training Vancouver, U14 soccer development  
**Why it matters:** Parents searching for their child's age group represent high-intent, bottom-of-funnel traffic. No competitor consistently owns these queries. Each page also adds indexed content and internal linking depth.  
**Recommended format:** Individual landing pages for U8–U10, U11–U13, U14–U18 pulling from existing program descriptions on /academy  
**Priority:** High  
**Effort:** Moderate (1 page per age group, ~2 hours each)

### 3. "South Vancouver Soccer Academy" Local Page
**Keyword:** soccer academy south Vancouver, soccer training south Vancouver  
**Why it matters:** The club is explicitly positioned as South Vancouver's club. No competitor owns this specific local modifier. A page (or strong homepage section) targeting South Van as a neighbourhood establishes topical authority for local searches.  
**Recommended format:** Landing page or homepage section with neighbourhood references, training locations, and local community framing  
**Priority:** High  
**Effort:** Quick win (1–2 hours)

### 4. Comparison / How We're Different Page
**Keyword:** best soccer academy Vancouver, South Van FC vs VanCity Pro  
**Why it matters:** Parents comparison-shop heavily. A page that honestly articulates your differentiators (small groups, IDP, video analysis, pathway to men's team) captures searchers further along in the decision process. This type of page also earns backlinks from local community blogs.  
**Recommended format:** Blog post or standalone page with a structured comparison of your approach vs. the typical large-club model  
**Priority:** Medium  
**Effort:** Moderate (3–4 hours)

### 5. Testimonials / Player Stories Page
**Keyword:** South Van FC reviews, youth soccer academy reviews Vancouver  
**Why it matters:** Zero social proof currently exists on the site. Competitors who show parent or player testimonials convert better and tend to earn more trust signals. Testimonials also provide natural keyword variation through real language parents use.  
**Recommended format:** Dedicated /stories or /testimonials page with 4–6 parent and player quotes, ideally with photos  
**Priority:** Medium  
**Effort:** Moderate (requires gathering testimonials, then quick build)

### 6. Blog: "Best Soccer Academies in Vancouver" Round-Up
**Keyword:** best soccer academy Vancouver  
**Why it matters:** This is a high-intent parent query. Writing an honest, researched comparison of Vancouver academies (including your own) positions South Van FC as a trusted authority and captures traffic from parents evaluating multiple options. This type of post earns backlinks and ranks well for competitive terms.  
**Recommended format:** Long-form blog post (~1500–2000 words), published before the summer registration season  
**Priority:** High  
**Effort:** Substantial (half day research + writing)

### 7. Blog: "Soccer Training for Kids in Vancouver: What to Expect at U8, U10, U12"
**Keyword:** soccer training for kids Vancouver, youth soccer U10 Vancouver  
**Why it matters:** This fills an age-specific informational gap that feeds into your commercial pages. Parents of young children search age-specific terms. Internal links to age-group pages would drive conversion.  
**Recommended format:** Blog post with age-by-age breakdown, linking to relevant academy program pages  
**Priority:** Medium  
**Effort:** Moderate (half day)

### 8. Blog: "What Is an Individual Development Plan in Youth Soccer?"
**Keyword:** individual development plan soccer, IDP soccer youth  
**Why it matters:** IDP is a key differentiator for South Van FC but the acronym is used without explanation. A blog post explaining the concept (and South Van FC's approach) ranks for a low-competition informational query and reinforces the club's positioning.  
**Recommended format:** Blog post (~800–1000 words), linking to /academy  
**Priority:** Medium  
**Effort:** Quick win (1–2 hours)

---

## Technical SEO Checklist

| Check | Status | Details |
|---|---|---|
| Google Indexation | **FAIL** | `site:southvanfc.com` returns 0 results. The site is effectively invisible to Google — this is the most urgent issue regardless of how well everything else is built. |
| XML Sitemap | **PASS (verify submitted)** | `/sitemap.xml` exists and is well-built: dynamic, covers all static routes and auto-generates blog post entries with `lastmod` dates. Confirm it's registered in GSC under Settings → Sitemaps. |
| Schema Markup | **PASS** | Strong structured data throughout: `Organization` (BaseLayout, every page), `WebSite` + `SportsOrganization` + `SportsClub` with geo coordinates (homepage), `FAQPage` (homepage FAQ), `BlogPosting` + author linked via `@id` (all blog posts), `BreadcrumbList` + 3 `Person` schemas (coaches page), `BreadcrumbList` (men's team page). Well above average for a club site. |
| HTTPS | **PASS** | Site serves over HTTPS correctly. |
| Canonical Tags | **PASS** | All pages have canonicals set via `BaseLayout`. Trailing slash is consistently enforced via `normalizeCanonicalPath()`. |
| Meta Descriptions | **PASS** | All pages have well-written, within-length meta descriptions set through the `seo` prop on `BaseLayout`. |
| Title Tags — Core Pages | **PASS** | /academy, /our-coaches, /mens-team-application, /blogs, /pricing all have keyword-optimised titles. Homepage title is 65 chars (slightly long — see On-Page issues). |
| Open Graph / Twitter Cards | **PASS** | Fully implemented in `BaseLayout` for all pages. Blog posts use `ogType: "article"` correctly. |
| Mobile Friendliness | **PASS** | Astro SSR on Vercel, responsive viewport meta tag, CSS media queries in place. |
| Page Speed | **PASS (likely)** | Static-first Astro on Vercel edge network with WebP images and minimal JS. Architecture is fast by default. |
| Internal Linking | **PASS** | Good internal linking between core pages. Blog posts link to coaches and academy pages. Minor gap: posts don't link directly to /academy/player-evaluation in body copy. |
| robots.txt | **Verify** | Not checked in this audit. Confirm `/robots.txt` has no `Disallow: /` or `Disallow: /blogs/` rules that could explain why Google hasn't crawled. |
| Article Schema — dateModified | **WARNING** | `articleSchema` in `[slug].astro` includes `datePublished` but not `dateModified`. Add it for better freshness signalling when posts are updated. |
| Blog URL slugs | **WARNING** | Files named `blog-*.md` generate URLs like `/blogs/blog-how-to-choose...` — the `blog-` prefix is redundant inside `/blogs/`. Since the site isn't indexed yet, renaming now requires no redirects. |
| Google Business Profile | **Unknown** | No GBP embed or `telephone` in LocalBusiness schema. A verified GBP is likely the fastest path to appearing in "soccer academy near me" map results. Worth setting up if not already done. |
---

## Competitor Comparison Summary

| Dimension | South Van FC | VanCity Pro | Orix Soccer Academy | Vancouver Rangers FC |
|---|---|---|---|---|
| Domain age / authority | New (est. 2023, site rebuilt ~2026) | Established | Established | Established |
| Indexed pages (approx.) | Near zero | Many | Many | Many |
| Core keyword rankings | Not ranking | Ranking | Ranking | Ranking |
| Blog / content volume | 7 posts (strong start) | Limited | Limited | Limited |
| Age groups served | U8–U18 + Men's | U8–U18 | U8–U18 | U5–U9 (academy) |
| Men's adult program | Yes (VMSL) | No | No | No |
| Structured data | None | Unknown | Unknown | Unknown |
| Local SEO (GBP) | Unknown | Likely present | Likely present | Likely present |
| Content differentiation | IDP, video analysis, small groups | High performance focus | University/pro pathway | Player-first, skill-focused |
| Pricing transparency | Yes (strong) | No | No | No |
| **Winner** | Content transparency | Established authority | Track record | Brand recognition |

South Van FC's genuine competitive advantages — pricing transparency, IDP, video analysis, and the youth-to-men's-team pathway — are clearly communicated on the site. Once indexation is fixed, these differentiators give the site real ranking potential for bottom-of-funnel queries where parents are actively choosing a program.

---

## Prioritized Action Plan

### Quick Wins — Do This Week

**1. Confirm and fix indexation — start here (Critical, 1 hour)**
- Open Google Search Console → Settings → Sitemaps → confirm `https://www.southvanfc.com/sitemap.xml` is submitted and showing green
- Go to URL Inspection → test the homepage → if "URL is not on Google," click "Request Indexing"
- Repeat for /academy, /blogs, /mens-team-application, /our-coaches, and the 7 blog posts
- Check `https://www.southvanfc.com/robots.txt` to confirm there's no unintentional Disallow rule
- Impact: Critical | Effort: 1 hour

**2. Rename blog post slugs — clean slate opportunity (Medium, 30 mins)**
- Since the site isn't indexed yet, you can rename `blog-*.md` files in `/src/content/blog/` to drop the `blog-` prefix now, with no 301 redirects needed
- e.g., `blog-how-to-choose-a-soccer-academy-vancouver.md` → `how-to-choose-a-soccer-academy-vancouver.md`
- Cleaner URLs, better for click-through from SERPs
- Impact: Medium | Effort: 30 mins + redeploy

**3. Add `dateModified` to articleSchema in `[slug].astro` (Low, 15 mins)**
- In the `articleSchema` object, add: `dateModified: (post.data.updatedDate ?? post.data.pubDate).toISOString()`
- Add an optional `updatedDate` field to the blog content schema in `config.ts` so you can set it explicitly when you update older posts
- Impact: Low | Effort: 15 minutes

**4. Add in-body CTA links to blog posts (Medium, 1 hour)**
- Each blog post should have at least one contextual link to `/academy/player-evaluation` or `/academy/pricing` in the body
- The "How to Choose a Soccer Academy" post is the highest-priority candidate — it drives comparison intent and the natural CTA is the evaluation
- Impact: Medium | Effort: 1 hour across all existing posts

**5. Set up or optimize Google Business Profile (High, 1 hour)**
- Create or claim a GBP listing with: category "Soccer Club" + "Sports School," service area (South Vancouver), photos, and a description pulling from your meta description
- This is the fastest path to appearing in "soccer academy near me" map pack results
- Impact: High | Effort: 1 hour

**6. Fix the "Skill Develoment" typo on the coaches page (Low, 5 mins)**
- Find it in `coaches-data.ts` or the `CoachCard` component and correct to "Skill Development"
- Impact: Low | Effort: 5 minutes
---

### Strategic Investments — Plan for This Quarter

**8. Create a dedicated Men's Team page (High impact)**
- Replace the bare application form with a full page: team overview, VMSL context, training schedule, eligibility, what players can expect, and the embedded form
- Target keywords: adult soccer Vancouver, VMSL men's team, soccer tryouts Vancouver
- Impact: High | Effort: Half day

**9. Build age-specific academy landing pages (High impact)**
- Create /academy/u8-u10, /academy/u11-u13, /academy/u14-u18
- Each page addresses parent concerns for that age group, describes the specific program focus, and links to pricing
- Target: U8 soccer training Vancouver, U12 soccer academy Vancouver, teen soccer development Vancouver
- Impact: High | Effort: 1–2 days total

**10. Publish "Best Soccer Academies in Vancouver" blog post (High impact)**
- Write an honest, well-researched comparison of the Vancouver academy landscape
- South Van FC appears in it as an option, not as the obvious winner — this builds trust and earns links
- Target keyword: best soccer academy Vancouver, soccer academies Vancouver
- Impact: High | Effort: Half day

**11. Add a South Vancouver local landing page or homepage section (Medium impact)**
- Lean into the South Van identity with neighbourhood-specific language, references to training locations, and local community framing
- Target: soccer academy south Vancouver, South Vancouver soccer club
- Impact: Medium | Effort: 2–3 hours

**12. Add testimonials page (Medium impact)**
- Collect 4–6 parent or player quotes with first name, age group, and (optional) photo
- Publish as /testimonials or integrate into the homepage as a section
- Impact: Medium | Effort: Moderate (mostly time gathering testimonials)

**13. Add internal CTAs to all blog posts (Medium impact)**
- Each blog post should end with (or contain) a contextual link to /academy/player-evaluation or /academy/pricing
- The "How to Choose a Soccer Academy in Vancouver" post in particular has no in-body links to the evaluation form
- Impact: Medium | Effort: 1 hour across all existing posts

---

## Next Steps

Would you like me to:
- Draft optimized title tags and meta descriptions for every page?
- Write a complete Men's Team page (content only, ready to drop into Astro)?
- Create a content brief for "Best Soccer Academies in Vancouver"?
- Build the JSON-LD schema blocks for homepage, blog posts, and academy page?
- Put together a 3-month content calendar based on these keyword opportunities?
