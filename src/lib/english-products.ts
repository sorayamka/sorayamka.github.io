import archiveProductsJson from "../../7legion-archive/data/products.json";
import { categories as russianCategories, products as russianProducts } from "../data/site";
import type { Category, Product } from "../data/types";

interface ArchiveProduct {
  name?: string;
  description?: string;
  source_url?: string;
  image?: string;
  page_title?: string;
}

const archiveProducts = archiveProductsJson as ArchiveProduct[];
const cyrillicPattern = /[\u0400-\u04ff]/;

const categoryNames: Record<string, string> = {
  pork: "Pork",
  beef: "Beef",
  poultry: "Poultry",
  "semi-finished": "Semi-finished products",
  offal: "Offal",
  lamb: "Lamb",
  rabbit: "Rabbit",
};

const subcategoryNames: Record<string, string> = {
  chicken: "Chicken",
  turkey: "Turkey",
  duck: "Duck",
  beef: "Beef offal",
  poultry: "Poultry offal",
  pork: "Pork offal",
};

const categoryPaths: Record<string, string> = {
  pork: "pork",
  beef: "beef",
  poultry: "poultry",
  "semi-finished": "semi-finished",
  offal: "offal",
  lamb: "lamb",
  rabbit: "rabbit",
};

const normalizePath = (value: string): string => {
  try {
    return new URL(value).pathname.replace(/\/$/, "");
  } catch {
    return value.replace(/\/$/, "");
  }
};

const normalizeText = (value: string): string => value.replace(/\s+/g, " ").replace(/\s*[–—-]\s*Седьмой Легион.*$/i, "").trim();

const isEnglishText = (value: string): boolean => Boolean(value) && !cyrillicPattern.test(value);

const archiveBySource = new Map<string, ArchiveProduct>();
const englishByImage = new Map<string, ArchiveProduct[]>();
const englishBySlug = new Map<string, ArchiveProduct[]>();

for (const item of archiveProducts) {
  const sourcePath = item.source_url ? normalizePath(item.source_url) : "";
  if (!sourcePath) continue;
  if (sourcePath.startsWith("/en/")) {
    if (item.image) englishByImage.set(item.image, [...(englishByImage.get(item.image) ?? []), item]);
    const slug = sourcePath.split("/").filter(Boolean).at(-1) ?? "";
    if (slug) englishBySlug.set(slug, [...(englishBySlug.get(slug) ?? []), item]);
  } else {
    archiveBySource.set(sourcePath, item);
  }
}

const findEnglishRecord = (product: Product): ArchiveProduct | undefined => {
  const source = archiveBySource.get(normalizePath(product.sourceUrl));
  const candidates = [
    ...(source?.image ? englishByImage.get(source.image) ?? [] : []),
    ...(englishBySlug.get(product.slug) ?? []),
  ];
  return [...new Set(candidates)].sort((left, right) => {
    const leftScore = Number(isEnglishText(left.name ?? "")) * 2 + Number(isEnglishText(left.description ?? ""));
    const rightScore = Number(isEnglishText(right.name ?? "")) * 2 + Number(isEnglishText(right.description ?? ""));
    return rightScore - leftScore;
  })[0];
};

const fallbackTerms: Record<string, string> = {
  a: "a",
  assorti: "assorted",
  azu: "meat cut",
  bedra: "thigh",
  bedro: "thigh",
  bez: "without",
  bkh: "skinless bone-in",
  brojlera: "broiler",
  broiler: "broiler",
  cb: "broiler chicken",
  chahohbili: "chahohbili",
  chicken: "chicken",
  cyp: "chicken",
  cyplenka: "chicken",
  diafragma: "diaphragm",
  dorabotannye: "processed",
  dzherki: "jerky",
  ek: "export",
  fail: "fillet",
  file: "fillet",
  farsh: "minced meat",
  firmennyj: "signature",
  frikadelki: "meatballs",
  golen: "drumstick",
  goljashka: "shank",
  golovy: "heads",
  govjazhij: "beef",
  govjazhja: "beef",
  govjazhe: "beef",
  govjadina: "beef",
  gulg: "drumette",
  guzka: "hock",
  haljal: "halal",
  in: "in",
  ind: "turkey",
  indejki: "turkey",
  jeko: "eco",
  jepifiza: "epiphysis",
  k: "of",
  kategorii: "category",
  kategorija: "category",
  kosti: "bone",
  kostnyj: "bone",
  kostrec: "chuck",
  kozha: "skin",
  kozhej: "skin",
  kr: "wing",
  krylya: "wings",
  krylo: "wing",
  krylyshki: "wingettes",
  krylov: "wings",
  kur: "chicken",
  kurinye: "chicken",
  kurinyj: "chicken",
  kurinoe: "chicken",
  lapy: "feet",
  lopatka: "shoulder",
  lopatochnyj: "shoulder",
  lokot: "elbow",
  lotok: "tray",
  miks: "mix",
  mjaso: "meat",
  monolit: "monoblock",
  muskul: "muscle",
  nabor: "set",
  nogi: "legs",
  nozhki: "legs",
  okorok: "ham",
  okorochka: "drumette",
  okorochok: "drumette",
  otrub: "cut",
  pak: "pack",
  paket: "pack",
  pechen: "liver",
  perednie: "front",
  poliblok: "polyblock",
  pon: "on",
  pp: "retail",
  prozrachnyj: "transparent",
  prud: "chest",
  ptica: "poultry",
  r: "brand",
  rulka: "shank",
  s: "with",
  send: "set",
  shajba: "shank",
  shashlyk: "kebab",
  shei: "necks",
  sheja: "neck",
  shejnyj: "neck",
  shnicel: "schnitzel",
  sosiski: "sausages",
  sorta: "grade",
  sort: "grade",
  sup: "soup",
  supovaja: "soup",
  sv: "pork",
  svinnaja: "pork",
  svinoe: "pork",
  svinoj: "pork",
  svinaja: "pork",
  svinina: "pork",
  svinye: "pork",
  tabaka: "stuffed",
  tefteli: "meatballs",
  tonkij: "thin",
  tushenija: "stewing",
  tushka: "carcass",
  tushki: "carcass",
  ty: "for",
  uta: "duck",
  utenka: "duckling",
  utenok: "duckling",
  utina: "duck",
  utki: "duck",
  utk: "duck",
  v: "in",
  ves: "weight",
  vyrezka: "cut",
  zadnie: "rear",
  zadnjaja: "rear",
  zheludki: "gizzards",
  zhilovannaja: "boneless",
  zhalovannaja: "deboned",
};

const fallbackDescription = "Product information is provided on the consumer packaging. Contact our sales team for specifications, weight and batch details.";

const fallbackEnglishName = (slug: string, categoryName: string): string => {
  const words = slug
    .split("-")
    .filter(Boolean)
    .map((token) => {
      if (/^\d+kg$/.test(token)) return token.replace("kg", " kg");
      if (/^\d+gr$/.test(token)) return token.replace("gr", " g");
      return fallbackTerms[token] ?? token;
    });
  const readableName = words.join(" ").replace(/\s+/g, " ").trim();
  return `${categoryName}: ${readableName || "frozen product"}`.replace(/^./, (letter) => letter.toUpperCase());
};

const usedEnglishSlugs = new Set<string>();

export const englishProducts: Product[] = russianProducts.map((product) => {
  const record = findEnglishRecord(product);
  const recordSlug = record?.source_url ? normalizePath(record.source_url).split("/").filter(Boolean).at(-1) ?? "" : "";
  let englishSlug = /^[a-z0-9-]+$/i.test(recordSlug) ? recordSlug : product.slug;
  if (cyrillicPattern.test(englishSlug) || usedEnglishSlugs.has(englishSlug)) englishSlug = `${product.id.slice(0, 8)}`;
  usedEnglishSlugs.add(englishSlug);
  const categorySlug = product.categorySlug;
  const name = record && isEnglishText(normalizeText(record.name ?? "")) ? normalizeText(record.name ?? "") : fallbackEnglishName(englishSlug, categoryNames[categorySlug] ?? "Frozen product");
  const description = record && isEnglishText(normalizeText(record.description ?? "")) ? normalizeText(record.description ?? "") : fallbackDescription;
  const categoryPath = categoryPaths[categorySlug] ?? categorySlug;
  return {
    ...product,
    name,
    description,
    category: categoryNames[categorySlug] ?? product.category,
    subcategory: subcategoryNames[product.subcategorySlug] ?? product.subcategory,
    path: `/en/shop/${categoryPath}/${englishSlug}/`,
    sourceUrl: record?.source_url ?? product.sourceUrl,
  };
});

export const englishCategories: Category[] = russianCategories.map((category) => ({
  ...category,
  name: categoryNames[category.slug] ?? category.name,
  subcategories: category.subcategories.map((subcategory) => ({
    ...subcategory,
    name: subcategoryNames[subcategory.slug] ?? subcategory.name,
  })),
}));

export const englishCatalogIndex = englishProducts.map((product, index) => ({
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
  search: `${product.name} ${product.subcategory} ${product.category}`.toLocaleLowerCase("en-US"),
}));
