# Tech Stack

- **Framework:** Astro 5 (server-side rendering via `@astrojs/vercel`)
- **Language:** TypeScript (strict mode)
- **Styling:** Plain CSS with a global design system (`src/styles/global.css`)
- **Icons:** `astro-icon` with custom SVGs in `src/icons/`
- **Fonts:** Inter Variable (body), Oswald Variable, Bebas Neue (accent headings) via Fontsource
- **Images:** Sharp for optimization; static assets in `public/assets/` and `src/images/`
- **Analytics:** `@vercel/analytics` + `@vercel/speed-insights` (injected in `BaseLayout.astro`)
- **SEO:** `@astrojs/sitemap` + custom helpers in `src/lib/seo.ts`
