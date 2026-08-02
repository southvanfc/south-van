import type { ImageMetadata } from "astro";

/*
 * Photo slots for the men's team page.
 *
 * A static `import` of a file that has not been added yet fails the whole
 * build, and a `/public` path cannot be checked at build time at all, so a
 * missing photo would ship as a broken-image glyph. `import.meta.glob` over an
 * empty or absent directory returns `{}` instead, which lets each slot fall
 * back to a designed no-image state and lets the photos land whenever they are
 * ready without a code change.
 */
const files = import.meta.glob<{ default: ImageMetadata }>(
  "/src/assets/mens-team/*.{jpg,jpeg,png,webp}",
  { eager: true },
);

/**
 * Looks a slot up by basename, so swapping `hero.jpg` for `hero.webp` needs no
 * code change. Returns undefined when the file is not there yet.
 */
export function teamImage(name: string): ImageMetadata | undefined {
  const entry = Object.entries(files).find(([path]) => {
    const file = path.split("/").pop() ?? "";
    const dot = file.lastIndexOf(".");
    return (dot === -1 ? file : file.slice(0, dot)) === name;
  });
  return entry?.[1].default;
}

/** Portrait-ish squad shot beside the hero copy. */
export const heroImage = teamImage("hero");

/** Wide action or huddle shot behind the mid-page statement band. */
export const bandImage = teamImage("band");
