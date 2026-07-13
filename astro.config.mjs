import { defineConfig } from "astro/config";
import icon from "astro-icon";
import vercel from "@astrojs/vercel";

export default defineConfig({
  site: "https://www.southvanfc.com",
  trailingSlash: "always",
  integrations: [icon()],
  output: "server",
  adapter: vercel(),
  redirects: {
    "/academy/": "/soccer-academy/",
    "/academy/pricing/": "/soccer-academy/pricing/",
    "/academy/player-evaluation/": "/soccer-academy/player-evaluation/",
  },
  image: {
    service: {
      entrypoint: "astro/assets/services/sharp",
    },
  },
});