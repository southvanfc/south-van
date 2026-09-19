import type { ProfanityHit } from "../types/types";
import {
  ALLOWED_WORDS,
  SUBSTRING_TERMS,
  WORD_TERMS,
} from "../data/blocked-terms";

/*
 * Content filter for the two public application forms.
 *
 * The hard part here is not catching slurs, it is NOT catching innocent words.
 * A plain `text.includes(term)` filter rejects Scunthorpe, assessment, raccoon,
 * assassin and real surnames like Cummings and Hancock. For a club taking names
 * from a diverse membership, wrongly rejecting someone's surname is a worse
 * outcome than letting one slur reach a human reviewer, so the matcher is built
 * to be precise rather than merely aggressive.
 *
 * Three things combine to get there:
 *
 *   1. Normalisation folds away accents, Cyrillic/Greek lookalikes and leetspeak,
 *      so "nÍgger", "nigger" spelled with a Cyrillic е, and "n1gg3r" all reduce to
 *      the same text before matching.
 *   2. Matching happens per word, never across the whole string, and each word is
 *      checked against ALLOWED_WORDS first.
 *   3. Every term is compiled to a pattern where each character may repeat, so
 *      "fuuuuck" and "niggerrr" match without listing the variants.
 *
 * Worth preserving deliberately: patterns are compiled from the literal term and
 * repeated letters are never collapsed. The n-word has a doubled g, so its pattern
 * demands two g groups and therefore cannot match "Niger" or "Nigeria". Collapsing
 * the term would break that and start rejecting a country.
 *
 * Known limitation: separators are only defeated when a word is split into single
 * characters ("f.u.c.k"). A partial split like "fu ck" is not caught. Closing that
 * would mean matching across word boundaries, which starts rejecting names such as
 * "Kim Chin Kwon", so it is left open on purpose.
 */

/** Cyrillic and Greek characters that render almost identically to Latin ones. */
const HOMOGLYPHS: Readonly<Record<string, string>> = {
  а: "a", в: "b", е: "e", к: "k", м: "m", н: "h", о: "o", р: "p",
  с: "c", т: "t", у: "y", х: "x", і: "i", ѕ: "s", ј: "j", ԁ: "d",
  α: "a", ε: "e", ο: "o", ρ: "p", τ: "t", υ: "u", χ: "x", ι: "i",
  κ: "k", ν: "v",
};

/** Common character substitutions used to slip text past filters. */
const LEET: Readonly<Record<string, string>> = {
  "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t",
  "@": "a", $: "s", "!": "i", "|": "i", "+": "t",
};

interface CompiledTerm {
  readonly term: string;
  readonly pattern: RegExp;
}

/**
 * Builds a pattern that tolerates repeated characters, so one entry covers
 * "fuck", "fuuuck" and "ffuck". Anchored when the term may only match a whole
 * word. Terms are plain ASCII, but the escape keeps this safe if that changes.
 */
function compile(term: string, wholeWord: boolean): CompiledTerm {
  const body = [...term]
    .map((char) => `${char.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}+`)
    .join("");
  return {
    term,
    pattern: new RegExp(wholeWord ? `^${body}$` : body),
  };
}

/** Compiled once at module scope. Re-compiling per request would be wasteful. */
const COMPILED: readonly CompiledTerm[] = [
  ...SUBSTRING_TERMS.map((term) => compile(term, false)),
  ...WORD_TERMS.map((term) => compile(term, true)),
];

const ALLOWED = new Set(ALLOWED_WORDS);

/** Lowercases and strips accents, homoglyphs and leetspeak. */
function normalise(text: string): string {
  const stripped = text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "");

  return [...stripped]
    .map((char) => HOMOGLYPHS[char] ?? LEET[char] ?? char)
    .join("");
}

/**
 * Rejoins runs of three or more single-character words, so "f.u.c.k" and
 * "n i g g e r" are testable. Shorter runs are ignored because initials in a
 * name ("Alexa S. Smith") would otherwise start forming words.
 */
function joinSplitRuns(words: readonly string[]): string[] {
  const joined: string[] = [];
  let run: string[] = [];

  for (const word of words) {
    if (word.length === 1) {
      run.push(word);
      continue;
    }
    if (run.length >= 3) joined.push(run.join(""));
    run = [];
  }
  if (run.length >= 3) joined.push(run.join(""));

  return joined;
}

/**
 * Returns the blocked term found in `text`, or null if it is clean.
 * The returned term is for logging only and must never be shown to the user.
 */
export function containsBlockedContent(text: string): string | null {
  if (!text.trim()) return null;

  const words = normalise(text).split(/[^a-z0-9]+/).filter(Boolean);
  if (words.length === 0) return null;

  for (const word of [...words, ...joinSplitRuns(words)]) {
    if (ALLOWED.has(word)) continue;
    for (const { term, pattern } of COMPILED) {
      if (pattern.test(word)) return term;
    }
  }

  return null;
}

/**
 * Checks a map of field name to value and returns the first offending field.
 * Pass only free-text fields; selects, radios and dates are not user typed.
 */
export function findBlockedField(
  fields: Record<string, string | undefined>,
): ProfanityHit | null {
  for (const [field, value] of Object.entries(fields)) {
    if (!value) continue;
    const term = containsBlockedContent(value);
    if (term) return { field, term };
  }
  return null;
}

/** Shown to the applicant when a submission is rejected. */
export const BLOCKED_CONTENT_MESSAGE =
  "Please remove offensive or inappropriate language before submitting.";
