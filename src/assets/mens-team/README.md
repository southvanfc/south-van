# Men's team photos

Drop two files in this folder and they appear on `/mens-team/` on the next
build. Nothing else in here is read.

| File       | Where it shows            | What it needs                                       |
| ---------- | ------------------------- | --------------------------------------------------- |
| `hero.*`   | Beside the hero headline  | Landscape, min 1400px wide, safe to crop to 3:2      |
| `band.*`   | Full-bleed statement band | Min 2000px wide, safe to crop to 21:9, action or huddle |

Both slots crop with `object-fit: cover` and centre the crop, so keep the
subject away from the edges. A 3:2 source fills the hero slot with no crop at
all.

`.jpg`, `.jpeg`, `.png` and `.webp` all work. The lookup in
`src/lib/team-images.ts` matches on the basename, so the extension can change
without touching any code.

Both slots have a designed empty state, so the page looks finished before the
photos land. The hero collapses to a single column and the band renders as a
navy gradient with the same statement line.
