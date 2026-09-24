import { englishCatalogIndex } from "../../lib/english-products";

export const prerender = true;

export function GET() {
  return new Response(JSON.stringify(englishCatalogIndex), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
