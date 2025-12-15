import { defineConfig, fontProviders } from "astro/config";

export default defineConfig({
    experimental: {
        fonts: [{
            provider: fontProviders.google(),
            name: "Roboto",
            cssVariable: "--font-roboto"
        }]
    }
});