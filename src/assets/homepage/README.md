# Homepage photos

Drop a file in this folder and it appears on `/` on the next build. Nothing
else in here is read.

| File     | Where it shows             | What it needs                                           |
| -------- | --------------------------- | -------------------------------------------------------- |
| `band.*` | Full-bleed statement band   | Min 2000px wide, safe to crop to 21:9, action or club shot |

The slot crops with `object-fit: cover` and centres the crop, so keep the
subject away from the edges.

`.jpg`, `.jpeg`, `.png` and `.webp` all work. The lookup in
`src/lib/home-images.ts` matches on the basename, so the extension can
change without touching any code.

The slot has a designed empty state, so the page looks finished before the
photo lands: the band renders as a navy gradient with the same statement
line.
