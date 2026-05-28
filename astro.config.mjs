import { defineConfig } from "astro/config";
import icon from "astro-icon";
import vercel from "@astrojs/vercel";

export default defineConfig({
  site: "https://www.southvanfc.com",
  trailingSlash: "always",
  integrations: [icon()],
  output: "server",
  adapter: vercel(),
  image: {
    service: {
      entrypoint: "astro/assets/services/sharp",
    },
  },
});