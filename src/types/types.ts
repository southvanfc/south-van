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
  icon: string;
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
  age_group:            "u6-u8" | "u8-u11" | "u11-u15" | "u15-u18" | string;
  current_club?:        string;
  years_playing:        "less-than-1" | "1-2" | "3-5" | "6-9" | "10+" | string;
  school_grade?:        string;
  positions:            string;
  dominant_foot:        "Left" | "Right" | "Both" | string;
  training_hours:       "less-than-2" | "2-4" | "4-6" | "6-8" | "8+" | string;
  competition_level:    "bcspl" | "metro" | "gold" | "silver" | "bronze" | "recreational" | "school-only" | "no-team" | string;
  other_sports?:        string;
  parent_name:          string;
  parent_relationship:  string;
  parent_email:         string;
  parent_phone:         string;
  previous_coaching:    string;
  injuries?:            string;
  player_strengths?:    string;
  areas_to_improve?:    string;
  long_term_goal:       string;
  goals?:               string;
  referral?:            string;
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