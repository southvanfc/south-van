# Academy App screenshots

Drop files in this folder and they appear on `/academy-app/` on the next
build. Nothing else in here is read.

| File                | Where it shows                    | What it needs                      |
| ------------------- | ---------------------------------- | ----------------------------------- |
| `hero.*`             | Beside the hero headline           | Landscape/desktop, min 1400px wide  |
| `admin-desktop.*`    | "A Look Inside", Admin Dashboard    | Landscape/desktop screenshot        |
| `admin-mobile.*`     | "A Look Inside", Admin Dashboard    | Portrait/phone screenshot           |
| `coach-desktop.*`    | "A Look Inside", Coach Session View | Landscape/desktop screenshot        |
| `coach-mobile.*`     | "A Look Inside", Coach Session View | Portrait/phone screenshot           |
| `player-desktop.*`   | "A Look Inside", Player & Parent    | Landscape/desktop screenshot        |
| `player-mobile.*`    | "A Look Inside", Player & Parent    | Portrait/phone screenshot           |

Any slot can be left out. Desktop and mobile are independent, so a role can
ship with just one of the two if that's all you have.

All slots crop with `object-fit: cover`, so keep the important content away
from the edges. `.jpg`, `.jpeg`, `.png` and `.webp` all work. The lookup in
`src/lib/academy-app-images.ts` matches on the basename, so the extension
can change without touching any code.

Every slot has a designed empty state (a placeholder device frame), so the
page looks finished before screenshots land.
