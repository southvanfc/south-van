import type { APIRoute } from "astro";
import { getCollection } from "astro:content";

const SITE = "https://www.southvanfc.com";

// `lastmod` is maintained by hand for static pages. Update the date on a route
// when you meaningfully change that page's content.
const staticRoutes = [
  { url: "/", priority: "1.0", changefreq: "weekly", lastmod: "2026-07-20" },
  {
    url: "/soccer-academy/",
    priority: "0.9",
    changefreq: "weekly",
    lastmod: "2026-07-28",
  },
  {
    url: "/soccer-academy/pricing/",
    priority: "0.8",
    changefreq: "monthly",
    lastmod: "2026-07-14",
  },
  {
    url: "/soccer-academy/player-evaluation/",
    priority: "0.8",
    changefreq: "monthly",
    lastmod: "2026-07-28",
  },
  { url: "/blogs/", priority: "0.8", changefreq: "weekly", lastmod: "2026-07-28" },
  {
    url: "/our-coaches/",
    priority: "0.7",
    changefreq: "monthly",
    lastmod: "2026-07-20",
  },
  {
    url: "/mens-team/",
    priority: "0.8",
    changefreq: "monthly",
    lastmod: "2026-08-02",
  },
  {
    url: "/mens-team/apply/",
    priority: "0.8",
    changefreq: "monthly",
    lastmod: "2026-08-02",
  },
  {
    url: "/fixtures/",
    priority: "0.8",
    changefreq: "daily",
    lastmod: "2026-07-30",
  },
  {
    url: "/south-vancouver/",
    priority: "0.7",
    changefreq: "monthly",
    lastmod: "2026-07-20",
  },
  {
    url: "/privacy-policy/",
    priority: "0.3",
    changefreq: "yearly",
    lastmod: "2026-07-20",
  },
  {
    url: "/terms-and-conditions/",
    priority: "0.3",
    changefreq: "yearly",
    lastmod: "2026-07-20",
  },
];

export const GET: APIRoute = async () => {
  const posts = await getCollection("blog");

  const blogEntries = posts.map((post) => ({
    url: `/blogs/${post.id}/`,
    lastmod: post.data.pubDate.toISOString().split("T")[0],
    priority: "0.7",
    changefreq: "monthly",
  }));

  const allRoutes = [...staticRoutes, ...blogEntries];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allRoutes
  .map(
    (route) => `  <url>
    <loc>${SITE}${route.url}</loc>${route.lastmod ? `\n    <lastmod>${route.lastmod}</lastmod>` : ""}
    <changefreq>${route.changefreq}</changefreq>
    <priority>${route.priority}</priority>
  </url>`
  )
  .join("\n")}
</urlset>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "public, max-age=86400",
    },
  });
};
