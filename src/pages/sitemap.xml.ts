import type { APIRoute } from "astro";
import { getCollection } from "astro:content";

const SITE = "https://www.southvanfc.com";

const staticRoutes = [
  { url: "/", priority: "1.0", changefreq: "weekly" },
  { url: "/soccer-academy/", priority: "0.9", changefreq: "weekly" },
  { url: "/soccer-academy/pricing/", priority: "0.8", changefreq: "monthly" },
  { url: "/soccer-academy/player-evaluation/", priority: "0.8", changefreq: "monthly" },
  { url: "/blogs/", priority: "0.8", changefreq: "weekly" },
  { url: "/our-coaches/", priority: "0.7", changefreq: "monthly" },
  { url: "/mens-team/", priority: "0.8", changefreq: "monthly" },
{ url: "/south-vancouver/", priority: "0.7", changefreq: "monthly" },
  { url: "/privacy-policy/", priority: "0.3", changefreq: "yearly" },
  { url: "/terms-and-conditions/", priority: "0.3", changefreq: "yearly" },
];

export const GET: APIRoute = async () => {
  const posts = await getCollection("blog");

  const blogEntries = posts.map((post) => ({
    url: `/blogs/${post.id}/`,
    lastmod: post.data.pubDate.toISOString().split("T")[0],
    priority: "0.7",
    changefreq: "monthly",
  }));

  const allRoutes = [
    ...staticRoutes.map((r) => ({ ...r, lastmod: undefined })),
    ...blogEntries,
  ];

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
