import { describe, expect, it } from "vitest";
import { containsBlockedContent, findBlockedField } from "./profanity";

/*
 * The false-positive suite below is the important half of this file. A matcher
 * that blocks "Scunthorpe", "assessment" or "Nigeria" is a bug, not a strict
 * filter, and it fails a real applicant rather than a troll.
 *
 * Slurs are spelled out here because that is what the matcher has to be tested
 * against. Assertions are written as isBlocked()/expect(...).toBeNull() so the
 * intent of each case stays readable.
 */

const isBlocked = (text: string) => containsBlockedContent(text) !== null;

describe("containsBlockedContent", () => {
  describe("empty input", () => {
    it("returns null for an empty string", () => {
      expect(containsBlockedContent("")).toBeNull();
    });

    it("returns null for whitespace only", () => {
      expect(containsBlockedContent("   \n\t  ")).toBeNull();
    });

    it("returns null for punctuation with no words", () => {
      expect(containsBlockedContent("!!! ... ???")).toBeNull();
    });
  });

  describe("ordinary application answers pass", () => {
    const clean = [
      "I have played in VMSL Division 4 for six seasons and want to keep competing.",
      "Centre back, comfortable on both feet, strong in the air.",
      "Recovering from a hamstring strain, cleared to play in March.",
      "My son wants to develop his first touch and his weaker foot.",
      "Available Tuesday and Thursday evenings plus Sunday matches.",
    ];

    for (const text of clean) {
      it(`allows: ${text.slice(0, 45)}...`, () => {
        expect(containsBlockedContent(text)).toBeNull();
      });
    }
  });

  describe("mild profanity is allowed", () => {
    // The club chose to block slurs and strong profanity only. Football
    // language is full of these and a sincere applicant should not be rejected.
    const mild = [
      "damn",
      "hell",
      "crap",
      "We want promotion so damn bad this season.",
      "We beat the hell out of them in the second half.",
      "My finishing was crap last year and I want to fix it.",
    ];

    for (const text of mild) {
      it(`allows: ${text}`, () => {
        expect(containsBlockedContent(text)).toBeNull();
      });
    }
  });

  describe("false positives: place names and surnames", () => {
    // Every one of these contains a blocked term as a substring.
    const safe = [
      "Scunthorpe",
      "I played for Scunthorpe United reserves.",
      "Penistone",
      "Penistone Church FC",
      "Niger",
      "Nigeria",
      "Nigerian",
      "I played youth football in Nigeria before moving to Canada.",
      "Cummings",
      "Jack Cummings",
      "Dickinson",
      "Hancock",
      "Kuntz",
      "Essex",
      "Sussex",
      "Middlesex",
      "Matsushita",
      "Yamashita",
      "Takeshita",
      "Yoshitaka",
      "Our keeper last season was Kenji Yamashita.",
      "Slutsky",
      "Kikelomo",
      "Babcock",
      "Hitchcock",
    ];

    for (const text of safe) {
      it(`allows: ${text}`, () => {
        expect(containsBlockedContent(text)).toBeNull();
      });
    }
  });

  describe("false positives: ordinary English words", () => {
    const safe = [
      "assess",
      "assessment",
      "We ran a full assessment of every player.",
      "assassin",
      "assist",
      "assists",
      "I registered twelve assists last season.",
      "assistant",
      "assistant coach",
      "class",
      "classic",
      "classes",
      "pass",
      "passing",
      "my passing range",
      "bass",
      "grass",
      "brass",
      "massive",
      "embarrass",
      "harassment",
      "compass",
      "ambassador",
      "potassium",
      "casserole",
      "raccoon",
      "cocoon",
      "tycoon",
      "cartoon",
      "analysis",
      "analyst",
      "video analysis sessions",
      "shuttlecock",
      "peacock",
      "cockpit",
      "cocktail",
      "therapist",
      "specialist",
      "suspicious",
      "auspicious",
      "titan",
      "shiitake",
      "flame retardant",
    ];

    for (const text of safe) {
      it(`allows: ${text}`, () => {
        expect(containsBlockedContent(text)).toBeNull();
      });
    }
  });

  describe("slurs are blocked", () => {
    const blocked = [
      "nigger",
      "nigga",
      "faggot",
      "wetback",
      "beaner",
      "towelhead",
      "raghead",
      "kike",
      "jigaboo",
      "shemale",
      "retard",
      "mongoloid",
    ];

    for (const text of blocked) {
      it(`blocks: ${text}`, () => {
        expect(isBlocked(text)).toBe(true);
      });
    }
  });

  describe("whole-word slurs are blocked as words", () => {
    const blocked = ["spic", "coon", "chink", "gook", "paki", "jap", "fag", "dyke", "spaz"];

    for (const text of blocked) {
      it(`blocks: ${text}`, () => {
        expect(isBlocked(text)).toBe(true);
      });
      it(`blocks in a sentence: ${text}`, () => {
        expect(isBlocked(`you are a ${text} and I hate you`)).toBe(true);
      });
    }
  });

  describe("strong profanity is blocked", () => {
    const blocked = [
      "fuck",
      "shit",
      "bitch",
      "cunt",
      "whore",
      "bastard",
      "wanker",
      "twat",
      "slut",
      "ass",
      "arse",
      "This team is fucking terrible.",
      "What a load of bullshit.",
    ];

    for (const text of blocked) {
      it(`blocks: ${text}`, () => {
        expect(isBlocked(text)).toBe(true);
      });
    }
  });

  describe("compound and suffixed forms are blocked", () => {
    const blocked = [
      "motherfucker",
      "bullshit",
      "shithead",
      "bitches",
      "dickhead",
      "niggers",
      "faggots",
      "retarded",
    ];

    for (const text of blocked) {
      it(`blocks: ${text}`, () => {
        expect(isBlocked(text)).toBe(true);
      });
    }
  });

  describe("obfuscation is defeated", () => {
    const blocked = [
      // Leetspeak
      "n1gg3r",
      "f4ggot",
      "sh1t",
      "fu@k".replace("@", "c"), // keeps the literal list readable
      "b1tch",
      "@ss",
      "a55",
      // Repeated characters
      "fuuuuck",
      "niggerrr",
      "shiiiit",
      // Split into single characters
      "f u c k",
      "f.u.c.k",
      "n-i-g-g-e-r",
      "s h i t",
      // Accents
      "fúck",
      "nìgger",
      // Mixed case
      "FuCk",
      "NIGGER",
    ];

    for (const text of blocked) {
      it(`blocks: ${text}`, () => {
        expect(isBlocked(text)).toBe(true);
      });
    }

    it("blocks Cyrillic homoglyph spoofing", () => {
      // "с" and "а" here are Cyrillic, not Latin.
      expect(isBlocked("сunt")).toBe(true);
      expect(isBlocked("аss")).toBe(true);
    });
  });

  describe("abuse hidden inside a legitimate answer is blocked", () => {
    it("catches a slur buried in a long paragraph", () => {
      const text =
        "I have played for eight years at a competitive level and I am " +
        "looking for a club where I can keep improving. Also your keeper " +
        "is a faggot. I train four times a week.";
      expect(isBlocked(text)).toBe(true);
    });
  });

  describe("the real submission this filter was built for", () => {
    // Taken from an actual abusive application the club received on
    // 2026-09-16, which is what prompted adding this check. Keeping it here
    // means any future change to the term lists is measured against the real
    // thing rather than only against invented examples.

    it("blocks the name field", () => {
      expect(isBlocked("Nigga you lost nine goals")).toBe(true);
    });

    it("blocks the club field", () => {
      expect(isBlocked("Your ass")).toBe(true);
    });

    it("blocks the submission as a whole", () => {
      const hit = findBlockedField({
        full_name: "Nigga you lost nine goals",
        email: "youguyssuckass@southvanisshit.com",
        current_club: "Your ass",
      });
      expect(hit).not.toBeNull();
      expect(hit?.field).toBe("full_name");
    });

    it("does not catch the run-together email on its own", () => {
      // Documented gap. "ass" and "shit" are whole-word terms, so they do not
      // fire inside "youguyssuckass" or "southvanisshit". Making them substring
      // terms would catch this but would also reject the surnames Yamashita and
      // Takeshita, which is the worse failure. The submission is still blocked
      // on its other fields.
      expect(containsBlockedContent("youguyssuckass@southvanisshit.com")).toBeNull();
    });
  });

  describe("accepted trade-offs", () => {
    // Documented on purpose: these are collisions we chose to live with, so a
    // change in behaviour here should be a deliberate decision, not a surprise.

    it("blocks the 'chink in their armour' idiom", () => {
      // The slur reading is serious enough to outweigh a rare idiom, and the
      // applicant sees an error and can rephrase.
      expect(isBlocked("There was a chink in their defensive line.")).toBe(true);
    });

    it("does not catch partially split words", () => {
      // Closing this would mean matching across word boundaries, which starts
      // rejecting names like "Kim Chin Kwon". Left open deliberately.
      expect(containsBlockedContent("fu ck")).toBeNull();
    });
  });

  it("returns the matched term for logging", () => {
    expect(containsBlockedContent("this is bullshit")).toBe("bullshit");
  });
});

describe("findBlockedField", () => {
  it("returns null when every field is clean", () => {
    expect(
      findBlockedField({
        full_name: "Jordan Cummings",
        why_southvan: "I want to play competitive football in South Vancouver.",
      }),
    ).toBeNull();
  });

  it("identifies which field is offending", () => {
    const hit = findBlockedField({
      full_name: "Jordan Cummings",
      why_southvan: "because you are all bastards",
    });
    expect(hit).toEqual({ field: "why_southvan", term: "bastard" });
  });

  it("skips undefined and empty values", () => {
    expect(
      findBlockedField({
        current_club: undefined,
        other_sports: "",
        full_name: "Sam Lee",
      }),
    ).toBeNull();
  });

  it("checks every field, not just the first", () => {
    const hit = findBlockedField({
      full_name: "Sam Lee",
      current_club: "Vancouver United",
      goals: "to be a fucking pro",
    });
    expect(hit?.field).toBe("goals");
  });
});
