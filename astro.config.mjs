import sitemap from "@astrojs/sitemap";
import { defineConfig } from "astro/config";

export default defineConfig({
  site: process.env.SITE_URL ?? "https://7legion.com",
  output: "static",
  trailingSlash: "always",
  build: {
    format: "directory",
    inlineStylesheets: "auto",
  },
  compressHTML: true,
  i18n: {
    defaultLocale: "ru",
    locales: ["ru", "en"],
    routing: "manual",
  },
  redirects: {
    "/vacancies-2": "/vacancies/",
    "/price-list-2": "/price/",
    "/vse-produkty": "/shop/",
    "/brands/sertifikaty": "/sertifikaty/",
    "/tag/sertifikat": "/sertifikaty/",
  },
  integrations: [
    sitemap({
      filter: (page) => {
        const path = new URL(page).pathname;
        return !path.includes("/cart/") && !path.startsWith("/product-category/") && !/\.(?:json|html)$/.test(path)
          && !["/demo/", "/vacancies-2/", "/price-list-2/", "/vse-produkty/", "/brands/sertifikaty/", "/tag/sertifikat/"].includes(path);
      },
    }),
  ],
});
