/*
 * Blocklist for the public application forms.
 *
 * This file necessarily contains slurs and profanity. It exists so that
 * src/lib/profanity.ts can keep this content OUT of the club's database and
 * away from whoever reviews applications. Nothing here is displayed anywhere.
 *
 * Two lists, because matching strictness has to differ:
 *
 *   SUBSTRING_TERMS  matched anywhere inside a word, so compounds and suffixed
 *                    forms ("motherfucker", "sandn-word", "bitches") are caught
 *                    without listing every variant. Only put a term here when no
 *                    ordinary English word contains it, or add the exceptions to
 *                    ALLOWED_WORDS below.
 *
 *   WORD_TERMS       matched only as a complete word, because these strings turn
 *                    up inside perfectly innocent words ("ass" in "assessment",
 *                    "coon" in "raccoon", "spic" in "suspicious"). Plural forms
 *                    have to be listed explicitly here.
 *
 * Mild profanity (damn, hell, crap) is deliberately absent. Players write things
 * like "we want promotion so damn bad" and that is not what this filter is for.
 */

/** Matched anywhere inside a word. See ALLOWED_WORDS for the exceptions. */
export const SUBSTRING_TERMS: readonly string[] = [
  // Racial, ethnic and religious slurs
  "nigger",
  "nigga",
  "jigaboo",
  "wetback",
  "beaner",
  "towelhead",
  "raghead",
  "zipperhead",
  "chinaman",
  // Homophobic and transphobic slurs
  "faggot",
  "fagget",
  "shemale",
  "ladyboy",
  // Ableist slurs
  "retard",
  "mongoloid",
  // Strong profanity
  "fuck",
  "bitch",
  "cunt",
  "whore",
  "bastard",
  "wanker",
  "twat",
  "dickhead",
];

/** Matched only as a whole word. Plurals and variants must be listed. */
export const WORD_TERMS: readonly string[] = [
  // Racial and ethnic slurs that collide with ordinary words
  "spic",
  "spics",
  "coon",
  "coons",
  "chink",
  "chinks",
  "gook",
  "gooks",
  "wog",
  "wogs",
  "paki",
  "pakis",
  "dago",
  "dagos",
  "wop",
  "wops",
  "kraut",
  "krauts",
  "jap",
  "japs",
  "darkie",
  "darky",
  "darkies",
  // Whole-word only because it sits inside the Yoruba given name "Kikelomo".
  // The bare name "Kike" is an unavoidable collision; ALLOWED_WORDS is the
  // escape hatch if a real applicant ever hits it.
  "kike",
  "kikes",
  // Homophobic, transphobic and ableist slurs that collide with ordinary words
  "fag",
  "fags",
  "dyke",
  "dykes",
  "homo",
  "homos",
  "tranny",
  "trannies",
  "spastic",
  "spastics",
  "spaz",
  // Strong profanity that collides with ordinary words
  "ass",
  "asses",
  "arse",
  "arses",
  "cock",
  "cocks",
  "pussy",
  "pussies",
  "hoe",
  "hoes",
  "wank",
  "wanks",
  // Whole-word only, with compounds listed, because substring matching on
  // "shit" rejects the Japanese surnames Matsushita, Yamashita, Takeshita and
  // Yoshitaka. Vancouver has a large Japanese-Canadian community, so that is a
  // live false positive rather than a theoretical one.
  "shit",
  "shits",
  "shite",
  "shitty",
  "shithead",
  "shitheads",
  "shitbag",
  "shitshow",
  "shitfaced",
  "bullshit",
  "dogshit",
  "horseshit",
  // Whole-word only because substring matching rejects the surname Slutsky.
  "slut",
  "sluts",
  "slutty",
];

/*
 * Words that legitimately contain a SUBSTRING_TERMS entry and must never be
 * blocked. Matching is done per word, so a word listed here is skipped whole.
 *
 * Wrongly rejecting a real applicant's surname or hometown is a worse failure
 * than letting one slur through to a human reviewer, so err towards adding
 * entries here. WORD_TERMS entries need no exceptions, since "assessment" is
 * already not the word "ass".
 */
export const ALLOWED_WORDS: readonly string[] = [
  // Place names
  "scunthorpe",
  "penistone",
  // "asses"
  "assess",
  // "retard"
  "retardant",
  "retardants",
];
