# Project Structure

```
src/
├── components/
│   ├── NewHome/        # Homepage sections (Hero, StatsBand, Squads, Values, FAQ, Signup)
│   ├── NewAcademy/     # Academy pages (Programs, Evaluation, Philosophy)
│   ├── MensEval/       # Men's team application form
│   ├── PlayerEval/     # Player evaluation form & process steps
│   ├── CoachesPage/    # Coach card grid and individual cards
│   ├── Header.astro
│   ├── Navigation.astro
│   ├── Footer.astro
│   └── Cta.astro
├── pages/
│   ├── index.astro
│   ├── academy/
│   │   ├── index.astro
│   │   └── player-evaluation.astro
│   ├── mens-team-application.astro
│   ├── our-coaches.astro
│   ├── success.astro
│   └── api/
│       ├── submit-application.ts
│       └── submit-evaluation.ts
├── layouts/
│   └── BaseLayout.astro   # Master layout: SEO, Header, Footer, Analytics
├── data/
│   ├── coaches-data.ts    # 3 coaches (Harjit, Dipinder, Shanil)
│   └── programs-data.ts   # 5 academy programs
├── styles/
│   └── global.css         # Full design system — colours, typography, utilities
├── lib/
│   └── seo.ts             # createSEO() helper and site defaults
└── types/
    ├── types.ts            # Interfaces: Coach, Programs, SEO, FAQItem, etc.
    └── global.d.ts
```
