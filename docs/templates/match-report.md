---
# Match report template. Normally filled in for you by:
#
#   npm run new:report -- <matchId>
#
# The match id is the "id" on the match in src/data/fixtures.json.
# Result: {{summary}}
#
# Everything marked TODO has to be replaced before this will build.
# Run `npm run validate:reports` at any point to see what is left.
#
# Score, opponent, crest, venue, kickoff and form are looked up from
# fixtures.json by matchId, so they are not written here.
#
# Every report has a match photo, so there is no logo fallback. Put the photo in
# public/assets/blog/ as a .webp, about 1600px wide and landscape (16:9 works
# best), and keep the players near the middle: the article page crops it to a
# wider 2:1 frame, and the blog index shows it at 16:9.
title: "TODO headline for the report"
seoTitle: "TODO headline | {{opponent}} | South Van FC"
description: "TODO one sentence that says how it went"
pubDate: {{pubDate}}
author: "{{author}}"
category: "Match Report"
image: "/assets/gold.png"
coverImage: "/assets/blog/TODO-match-photo.webp"
coverImageAlt: "TODO describe the photo in one sentence for screen readers"
tags: ["VMSL", "Match Report", "Men's Soccer", "{{opponent}}"]

matchId: "{{matchId}}"
{{goals}}

# One line on why. Shown on a card with the player's shirt number.
motm: { player: "TODO", reason: "TODO" }

# Names must match src/data/roster.json exactly (case does not matter).
# Everyone who scored, assisted, is captain or is man of the match must be here.
lineup:
  captain: "TODO"
  starters: ["TODO"]
  bench: []
---

<!--
  Everything below the line is the match story. Delete this note.

  Goals, man of the match and the lineup are laid out for you under the story,
  so there is no need to repeat who scored. Say what happened and why.
  Short paragraphs, plain words. For a loss, be straight about what went
  wrong and what the group is working on.
-->

TODO: Open with the result and the one thing that decided it, in two sentences.

## How it unfolded

TODO: The shape of the game, in the order it happened.

## The turning point

TODO: The moment or decision that changed it.

## What we take from it

TODO: What worked, what did not, and what is next.
