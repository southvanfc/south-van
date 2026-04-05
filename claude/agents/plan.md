# Agent: Plan

Software architect agent for designing implementation plans before writing code.

## When to use

- Adding a new page (need to consider BaseLayout, SEO, navigation)
- Restructuring or moving components between feature folders
- Any non-trivial feature that touches multiple files

## Why it matters for this project

The project has a clear architecture — feature-organised components, data files in `src/data/`, and `BaseLayout.astro` as the single layout wrapper. Planning before touching this prevents structural drift.
