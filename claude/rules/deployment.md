# Deployment

- Pushes to `main` deploy automatically to Vercel.
- The site uses SSR — do not switch `output` to `static` in `astro.config.mjs` without testing form/API routes first.

## Running Locally

```bash
npm install
npm run dev       # Start dev server (localhost:4321)
npm run build     # Production build
npm run preview   # Preview production build
```
