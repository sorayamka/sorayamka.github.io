import { products } from "../data/site";

export const prerender = true;

const catalogIndex = products.map((product, index) => ({
  id: product.id,
  index,
  name: product.name,
  path: product.path,
  image: product.image,
  thumbnail: product.thumbnail,
  category: product.category,
  categorySlug: product.categorySlug,
  subcategory: product.subcategory,
  subcategorySlug: product.subcategorySlug,
  inStock: product.inStock,
  search: `${product.name} ${product.subcategory} ${product.category}`.toLocaleLowerCase("ru-RU"),
}));

export function GET() {
  return new Response(JSON.stringify(catalogIndex), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
