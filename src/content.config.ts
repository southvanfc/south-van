import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

/*
 * Match report fields. All optional, so ordinary posts are untouched. A post
 * becomes a match report when `matchId` is set: score, opponent, venue and
 * kickoff are looked up from src/data/fixtures.json, and only what the fixtures
 * file cannot know (goals, man of the match, lineup) is written here.
 *
 * Names are free strings that must match src/data/roster.json. Nothing here can
 * check that, so `npm run validate:reports` does. Keep the shapes in step with
 * ReportFrontmatter in src/lib/matchReport.ts.
 */
const goal = z.object({
  /** Whose goal it is. Opponent scorers are usually a shirt number, not a name. */
  team: z.enum(['us', 'them']).default('us'),
  minute: z.number().int().min(1).max(130).optional(),
  scorer: z.string(),
  assist: z.string().optional(),
  /** Short qualifier shown beside the scorer, e.g. "Penalty" or "Own goal" */
  detail: z.string().optional(),
});

const blog = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    author: z.string().default('South Van FC'),
    category: z.string().optional(),
    tags: z.array(z.string()).optional(),
    image: z.string().optional(),
    imageAlt: z.string().optional(),
    coverImage: z.string().optional(),
    coverImageAlt: z.string().optional(),
    seoTitle: z.string(),

    // Match report
    matchId: z.coerce.string().optional(),
    goals: z.array(goal).optional(),
    motm: z
      .object({
        player: z.string(),
        reason: z.string().optional(),
      })
      .optional(),
    lineup: z
      .object({
        captain: z.string().optional(),
        starters: z.array(z.string()),
        bench: z.array(z.string()).default([]),
      })
      .optional(),
  }),
});

export const collections = { blog };
