import brandsJson from "../data/brands.json";
import certificatesJson from "../data/certificates.json";
import relationsJson from "../data/product-brands.json";
import type { Brand, Certificate } from "../data/types";

export const brandRelations = relationsJson as Record<string, Array<{ slug: string; name: string }>>;
const brands = brandsJson as Brand[];
const certificates = certificatesJson as Certificate[];
const normalize = (value: string) => value.toLocaleLowerCase("ru-RU").replace(/ё/g, "е").replace(/[^a-zа-я0-9]/g, "");
const key = (slug: string) => normalize(slug.replace(/^(?:sert-|tm-|tk-|ooo-|ao-|oao-|zao-)/, ""));
const certificateAliases: Record<string, string> = {
  "ao-prioskole": "sert-prioskolye", "tm-cherkizovo": "sert-cherkizovo", "tk-miratorg": "sert-miratorg-2",
  "tm-miratorg": "sert-miratorg-2", "damate": "sert-damate", "indilajt": "sert-damate",
  "ao-prodo-pticefabrika-kaluzhskaja": "sert-prodo-kaluzhskaya", "tm-petruha": "sert-petrukha",
  "tm-jasnye-zori": "sert-yasnie-zori", "ooo-mjasnoj-dom-borodina": "sert-borodina",
};

export const getBrandRelations = (brand: Brand) => {
  if (!brand.slug.startsWith("brand-")) return [brand.slug];
  const name = normalize(brand.name);
  return [...new Set(Object.values(brandRelations).flat().filter((item) => normalize(item.name) === name).map((item) => item.slug))];
};

export const getBrandCertificates = (brand: Brand): Certificate[] => {
  const slugs = [brand.slug, ...getBrandRelations(brand)];
  return certificates.filter((certificate) => slugs.some((slug) =>
    certificateAliases[slug] === certificate.slug || (!slug.startsWith("brand-") && key(slug) === key(certificate.slug)),
  ));
};

export const getProductBrandSearch = (id: string): string => (brandRelations[id] ?? []).map((item) => {
  const record = brands.find((brand) => brand.slug === item.slug);
  return `${item.name} ${item.slug.replace(/[-_]/g, " ")} ${record?.name ?? ""}`;
}).join(" ");
