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
    overview: string;
}