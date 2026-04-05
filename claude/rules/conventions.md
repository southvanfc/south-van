# Conventions

- **Components are feature-organised**, not type-organised. Add new components inside the relevant feature folder (`NewHome/`, `NewAcademy/`, etc.).
- **Static data lives in `src/data/`**. Do not hardcode content inside components — add it to the relevant data file and import it.
- **All pages use `BaseLayout.astro`** and pass SEO props via `createSEO()` from `src/lib/seo.ts`.
- **Mobile menu** is handled by `public/scripts/menu.js` (vanilla JS). Do not move this to a framework component.
- **No external UI component libraries.** Use the existing CSS utility classes and global styles.
- **TypeScript is strict.** All new code must be typed; use or extend interfaces in `src/types/types.ts`.
- **Images** should use Astro's `<Image />` component for optimisation wherever possible.
- **Styles:** Edit `src/styles/global.css` for reusable styles. Avoid page-scoped `<style>` blocks for anything shared.
