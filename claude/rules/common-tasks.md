# Common Tasks

## Add a new coach
Edit `src/data/coaches-data.ts` — add a new `Coach` object following the existing interface. The grid renders automatically.

## Add a new academy program
Edit `src/data/programs-data.ts` — add a new entry. The program cards render from this data.

## Add a new page
1. Create `src/pages/your-page.astro`
2. Wrap content in `<BaseLayout>` with `createSEO()` props
3. Add navigation link to `src/components/Navigation.astro` if needed

## Update global styles
Edit `src/styles/global.css`. Avoid page-scoped `<style>` blocks for anything that should be reusable.

## API / form endpoints
Server endpoints live in `src/pages/api/`. They handle POST requests from the evaluation and application forms.
