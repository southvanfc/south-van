import { defineConfig } from "astro/config";
import icon from "astro-icon";
import vercel from "@astrojs/vercel";
import sitemap from "@astrojs/sitemap";

export default defineConfig({
  site: "https://www.southvanfc.com",
  integrations: [icon(), sitemap()],
  output: "server",
  adapter: vercel(),
  image: {
    service: {
      entrypoint: "astro/assets/services/sharp",
    },
  },
});