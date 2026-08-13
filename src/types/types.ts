export interface Coach {
  imageUrl: ImageMetadata;
  name: string;
  coachingCert: string;
  mentality: string[];
  years: string;
  ageGroup: string;
  bioPreview: string;
  completeBio: string[];
}

export interface Stat {
  value: string;
  label: string;
}

export interface Value {
  num: string;
  name: string;
  description: string;
}

export interface FAQItem {
  question: string;
  answer: string;
  isList?: boolean;
  listItems?: string[];
  defaultOpen?: boolean;
}

export interface ContactDetails {
  icon: string;
    label: string;
    value: string;
    href: string | null;
}

export interface Principals {
  title: string;
  body: string
}

export interface CTALink {
  href: string;
  label: string;
  style: "navy" | "outline-navy";
}
export interface Programs {
    index: string;
    badge: string;
    name: string;
    bestFor: string;
    ages: string;
    price: string;
    overview: string;
}

export interface SEO {
  title: string;
  description?: string;
  canonical?: string;
  robots?: string; // "index,follow" | "noindex,nofollow" etc.

  /** Social */
  ogImage?: string; // "/og/home.jpg" or absolute
  ogType?: "website" | "article";
  twitterCard?: "summary" | "summary_large_image";

  /** Optional extras */
  keywords?: string;
  author?: string;
}

export interface PlayerEvaluationInsert {
  full_name:            string;
  dob:                  string;
  age_group:            "u8-u11" | "u12-u15" | "u15-u18" | "adult-18-plus" | string;
  current_club?:        string;
  years_playing:        "less-than-1" | "1-2" | "3-5" | "6-9" | "10+" | string;
  school_grade?:        string;
  positions:            string;
  dominant_foot:        "Left" | "Right" | "Both" | string;
  training_hours:       "less-than-2" | "2-4" | "4-6" | "6-8" | "8+" | string;
  competition_level:    "bcspl" | "metro" | "gold" | "silver" | "bronze" | "recreational" | "school-only" | "no-team" | string;
  other_sports?:        string;
  parent_name?:         string;
  parent_relationship?: string;
  parent_email?:        string;
  parent_phone?:        string;
  player_email?:        string;
  player_phone?:        string;
  previous_coaching:    string;
  injuries?:            string;
  player_strengths?:    string;
  areas_to_improve?:    string;
  long_term_goal:       string;
  goals?:               string;
  referral?:            string;
}

export type Competition = "league" | "cup" | "friendly";

export interface Club {
  /** Display name as shown on our site, e.g. "South Van FC" */
  name: string;
  /**
   * Exact string VMSL uses, when it differs from the display name.
   * Ours is "SouthVan FC", one word, no space. Searching VMSL for
   * "South Van" returns nothing. Any matching against VMSL data must
   * use this field, never `name`.
   */
  vmslName?: string;
  /** 2 to 4 letter code for compact views, e.g. "KOV" */
  tag: string;
  /** Stable url-safe key, e.g. "fc-kova" */
  slug: string;
  /** Hex colour for the monogram crest badge */
  colour: string;
  /** Optional crest asset path, relative to /public */
  crest?: string;
}

export interface Match {
  /**
   * VMSL's own `sched_seq_no`, e.g. "21810". Stable across scrapes and
   * across reschedules, so it is the reconciliation key. Fall back to
   * `${date}-${opponentSlug}` only for matches entered by hand before
   * VMSL publishes them.
   */
  id: string;
  /** ISO date, YYYY-MM-DD */
  date: string;
  /** 24 hour local kickoff, HH:MM */
  time: string;
  opponentSlug: string;
  /** true when South Van FC is the home team */
  isHome: boolean;
  venue: string;
  competition: Competition;
  /** Full competition label, e.g. "VMSL Division 4A" or "Division 4 Cup, Round 1" */
  competitionLabel: string;

  /*
   * WARNING, READ BEFORE EDITING A SCORE.
   *
   * `homeScore` and `awayScore` are ALWAYS the home team's goals first,
   * never South Van's goals first. An away defeat where we lost 3-2 is
   * stored `homeScore: 3, awayScore: 2, isHome: false`.
   *
   * This is not a theoretical concern. An earlier prototype of this page
   * had three away results entered the wrong way round. It silently turned
   * two defeats into wins and the league table still looked plausible.
   * Use `ourScore()` and `theirScore()` from `src/lib/fixtures.ts` to read
   * a score from South Van's perspective, and never reorder these fields.
   */

  /** HOME team goals. null when not yet played. See the warning above. */
  homeScore: number | null;
  /** AWAY team goals. null when not yet played. See the warning above. */
  awayScore: number | null;

  /**
   * Anything other than a normally completed or scheduled match.
   * These are not hypothetical: of 23 fixtures last season, four needed
   * one of these, including a forfeit and a match abandoned at 1-1 and
   * completed months later.
   */
  status?: "postponed" | "cancelled" | "forfeited" | "incomplete" | "completion";
  /**
   * Free text from VMSL shown beneath the match, e.g.
   * "Group B. PK win (4-5)" or "Last 75 minutes completed from a score of 1-1".
   * A cup tie decided on penalties has a drawn scoreline, so without this
   * the result is misleading.
   */
  note?: string;
}

export interface StandingsRow {
  clubSlug: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  /** Most recent last, e.g. "DWWLW". Up to 5 characters. */
  form: string;
}

/**
 * A band of league positions that means something, e.g. the champions spot or
 * the promotion places. The standings table draws these as a coloured bar on
 * the position cell and explains them in a legend, so which zones exist is a
 * property of the division we are in rather than of the component.
 */
export interface LeagueZone {
  /** First position in the band, 1 based and inclusive */
  from: number;
  /** Last position in the band, inclusive */
  to: number;
  /** Any CSS colour, including a `var()` reference to a design token */
  colour: string;
  /** Legend text, e.g. "Promotion to Division 3" */
  label: string;
}

export interface FixturesData {
  /** e.g. "2026-27" */
  season: string;
  /** e.g. "VMSL Division 4A" */
  division: string;
  /** ISO timestamp of the last successful scrape */
  updatedAt: string;
  clubs: Club[];
  matches: Match[];
  standings: StandingsRow[];
  /** Meetings from previous seasons, for head to head. Same shape as Match. */
  history: Match[];
}

export interface MensApplicationInsert {
  full_name:          string;
  email:              string;
  phone:              string;
  dob:                string;
  positions:          string;
  preferred_foot?:    string;
  current_club?:      string;
  league_experience:  string;
  availability:       string;
  season_commitment:  string;
  why_south_van:      string;
  referral?:          string;
}