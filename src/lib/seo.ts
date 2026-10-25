import { products } from "../data/site";
import { englishProducts } from "./english-products";
import { englishPages } from "./i18n";

type LanguageRoutes = { ru?: string; en?: string };
const routes = new Map<string, LanguageRoutes>();
const register = (pair: LanguageRoutes) => {
  if (pair.ru) routes.set(pair.ru, pair);
  if (pair.en) routes.set(pair.en, pair);
};
register({ ru: "/", en: "/en/" });
register({ ru: "/shop/", en: "/en/shop/" });
register({ ru: "/cart/", en: "/en/cart/" });
for (const slug of Object.keys(englishPages)) register({ ru: `/${slug}/`, en: `/en/${slug}/` });
const englishById = new Map(englishProducts.map((product) => [product.id, product]));
for (const product of products) {
  const translated = englishById.get(product.id);
  if (!translated) continue;
  register({ ru: product.path, en: translated.path });
  const russianCategory = `/shop/${product.path.split("/")[2]}/`;
  const englishCategory = `/en/shop/${translated.path.split("/")[3]}/`;
  register({ ru: russianCategory, en: englishCategory });
}

export const getLanguageRoutes = (pathname: string): LanguageRoutes => {
  if (/^\/404(?:\/|\.html|$)/.test(pathname)) return {};
  const decoded = decodeURI(pathname);
  return routes.get(decoded) ?? (decoded.startsWith("/en/") ? { en: decoded } : { ru: decoded });
};

export const isPreviewSite = (site: URL | undefined): boolean =>
  Boolean(site && (site.hostname.endsWith(".github.io") || site.hostname === "localhost" || site.hostname === "127.0.0.1"));

export const productDescription = (name: string, description: string, locale: "ru" | "en"): string => {
  const generic = !description || /подробное описание|информация о продукте указана|photo|contact our sales/i.test(description);
  const fallback = locale === "ru"
    ? `${name} оптом. Уточните наличие, объём партии и условия поставки по России в коммерческом отделе «Седьмой Легион».`
    : `${name} wholesale. Contact Seventh Legion for availability, batch quantities and delivery terms across Russia.`;
  const text = generic ? fallback : `${name}. ${description.replace(/\s+/g, " ").trim()}`;
  return text.length > 180 ? `${text.slice(0, 177).trimEnd()}…` : text;
};
