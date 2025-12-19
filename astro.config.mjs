import { defineConfig } from "astro/config";

import icon from "astro-icon";

import vercel from "@astrojs/vercel";

export default defineConfig({
  integrations: [icon()],
  adapter: vercel(),
  imageService: true,
});