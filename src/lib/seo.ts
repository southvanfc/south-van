export type SEOProps = {
  title: string;
  description?: string;
  canonical?: string;
  ogImage?: string;
  ogType?: "website" | "article";
  twitterCard?: "summary" | "summary_large_image";
  robots?: string;
  keywords?: string;
  author?: string;
};

/**
 * Site-wide defaults
 * Change these once and you're done.
 */
export const SITE_SEO = {
  siteName: "South Van FC",
  defaultDescription:
    "South Van FC Academy in Vancouver — technical-first player development, game intelligence, and high-performance training.",
  defaultOgImage: "/og-default.jpg",
  defaultOgType: "website" as const,
  defaultTwitterCard: "summary_large_image" as const,
  defaultRobots: "index,follow",
};

/**
 * Merge page-level SEO with site defaults
 * Keeps BaseLayout dead simple.
 */
export function createSEO(seo: SEOProps) {
  return {
    pageTitle: seo.title,
    description: seo.description ?? SITE_SEO.defaultDescription,
    canonical: seo.canonical,
    ogImage: seo.ogImage ?? SITE_SEO.defaultOgImage,
    ogType: seo.ogType ?? SITE_SEO.defaultOgType,
    twitterCard: seo.twitterCard ?? SITE_SEO.defaultTwitterCard,
    robots: seo.robots ?? SITE_SEO.defaultRobots,
    keywords: seo.keywords,
    author: seo.author,
  };
}
