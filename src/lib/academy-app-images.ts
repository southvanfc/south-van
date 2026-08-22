import type { ImageMetadata } from "astro";

/*
 * Screenshot slots for the Academy App showcase page. Same approach as
 * team-images.ts: a static import of a file that has not been added yet
 * fails the whole build, so import.meta.glob over the folder is used
 * instead, and a missing screenshot falls back to the DeviceFrame's
 * designed placeholder rather than a broken image.
 */
const files = import.meta.glob<{ default: ImageMetadata }>(
  "/src/assets/academy-app/*.{jpg,jpeg,png,webp}",
  { eager: true },
);

/**
 * Looks a slot up by basename, so swapping `hero.png` for `hero.webp` needs
 * no code change. Returns undefined when the file is not there yet.
 */
export function academyAppImage(name: string): ImageMetadata | undefined {
  const entry = Object.entries(files).find(([path]) => {
    const file = path.split("/").pop() ?? "";
    const dot = file.lastIndexOf(".");
    return (dot === -1 ? file : file.slice(0, dot)) === name;
  });
  return entry?.[1].default;
}

/** Wide dashboard shot beside the hero copy. */
export const heroImage = academyAppImage("hero");
