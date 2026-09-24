import catalogJson from "./catalog.json";
import categoriesJson from "./categories.json";
import brandsJson from "./brands.json";
import certificatesJson from "./certificates.json";
import teamJson from "./team.json";
import documentsJson from "./documents.json";
import siteImagesJson from "./site-images.json";
import type { Brand, Category, Certificate, DocumentFile, Product, TeamMember } from "./types";

export const products = catalogJson as Product[];
export const categories = categoriesJson as Category[];
export const brands = brandsJson as Brand[];
export const certificates = certificatesJson as Certificate[];
export const team = teamJson as TeamMember[];
export const documents = documentsJson as DocumentFile[];
export const siteImages = siteImagesJson as Record<string, string>;

export const company = {
  name: "Седьмой Легион",
  legalName: "ООО «Седьмой Легион»",
  phone: "+7 495 232-36-52",
  salesPhone: "+7 919 777-79-63",
  warehousePhone: "+7 495 225-06-36",
  email: "info@myaso.msk.ru",
  telegram: "https://t.me/sedmoylegyon7",
  office: "Москва, Ленинградское ш., д. 64, корп. 3, офис 3-2",
  warehouse: "Московская область, Химки, посёлок Лунёво, дом 1Б",
  inn: "7743098197",
  ogrn: "1157746369330",
  hours: "Пн–Пт, 9:00–18:00",
  founded: 2003,
};

export const formatCount = (value: number) => new Intl.NumberFormat("ru-RU").format(value);
