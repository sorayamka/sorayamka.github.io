export type Locale = "ru" | "en";

export const defaultLocale: Locale = "ru";
export const locales: Locale[] = ["ru", "en"];

export const getLocale = (pathname: string): Locale => (/^\/en(?:\/|$)/.test(pathname) ? "en" : "ru");

export const getOtherLocale = (locale: Locale): Locale => (locale === "ru" ? "en" : "ru");

export const stripLocale = (pathname: string): string => pathname.replace(/^\/en(?=\/|$)/, "") || "/";

const routeAliases: Record<string, string> = {
  "/vacancies-2/": "/vacancies/",
  "/price-list-2/": "/price/",
  "/vse-produkty/": "/shop/",
  "/brands/sertifikaty/": "/sertifikaty/",
  "/tag/sertifikat/": "/sertifikaty/",
};

export const localizedPath = (path: string, locale: Locale): string => {
  const match = path.match(/^([^?#]*)(.*)$/);
  const rawPathname = match?.[1] || "/";
  const suffix = match?.[2] || "";
  const pathname = rawPathname.startsWith("/") ? rawPathname : `/${rawPathname}`;
  const withoutLocale = routeAliases[stripLocale(pathname)] ?? stripLocale(pathname);
  if (locale === "ru") return `${withoutLocale}${suffix}`;
  if (withoutLocale === "/") return `/en/${suffix}`;
  return `/en${withoutLocale}${suffix}`;
};

export const formatCount = (value: number, locale: Locale = defaultLocale): string =>
  new Intl.NumberFormat(locale === "en" ? "en-US" : "ru-RU").format(value);

export const ui = {
  ru: {
    skip: "Перейти к содержимому",
    home: "Главная",
    catalog: "Каталог",
    brands: "Бренды",
    services: "Услуги",
    company: "Компания",
    contacts: "Контакты",
    storage: "Хранение",
    logistics: "Логистика",
    price: "Прайс-лист",
    about: "О компании",
    suppliers: "Поставщики",
    partner: "Стать партнёром",
    documents: "Документы",
    certificates: "Сертификаты",
    vacancies: "Вакансии",
    cart: "Корзина",
    language: "Язык",
    search: "Поиск",
    searchCatalog: "Поиск по каталогу",
    searchPlaceholder: "Название продукта…",
    find: "Найти",
    all: "Все",
    filters: "Фильтры",
    category: "Категория",
    allCategories: "Все категории",
    subcategory: "Подкатегория",
    stock: "Только в наличии",
    sort: "Сортировка",
    byName: "По названию",
    byCategory: "По категории",
    reset: "Сбросить",
    resetFilters: "Сбросить фильтры",
    found: "товаров найдено",
    shown: "Показано",
    of: "из",
    back: "Назад",
    next: "Вперёд",
    page: "Страница",
    inStock: "В наличии",
    onOrder: "Под заказ",
    priceOnRequest: "Цена по запросу",
    photoPending: "Фото уточняется",
    addToCart: "Добавить в корзину",
    openProduct: "Открыть",
    more: "Подробнее",
    contactSales: "Связаться с отделом продаж",
  },
  en: {
    skip: "Skip to content",
    home: "Home",
    catalog: "Catalog",
    brands: "Brands",
    services: "Services",
    company: "Company",
    contacts: "Contacts",
    storage: "Storage",
    logistics: "Logistics",
    price: "Price list",
    about: "About us",
    suppliers: "Suppliers",
    partner: "Become a partner",
    documents: "Documents",
    certificates: "Certificates",
    vacancies: "Careers",
    cart: "Cart",
    language: "Language",
    search: "Search",
    searchCatalog: "Search the catalog",
    searchPlaceholder: "Product name…",
    find: "Find",
    all: "All",
    filters: "Filters",
    category: "Category",
    allCategories: "All categories",
    subcategory: "Subcategory",
    stock: "In stock only",
    sort: "Sort",
    byName: "By name",
    byCategory: "By category",
    reset: "Reset",
    resetFilters: "Reset filters",
    found: "products found",
    shown: "Showing",
    of: "of",
    back: "Back",
    next: "Next",
    page: "Page",
    inStock: "In stock",
    onOrder: "On order",
    priceOnRequest: "Price on request",
    photoPending: "Photo coming soon",
    addToCart: "Add to cart",
    openProduct: "Open",
    more: "Learn more",
    contactSales: "Contact our sales team",
  },
} as const;

export interface EnglishPageCopy {
  eyebrow: string;
  title: string;
  lead: string;
  statLabel: string;
  statNote: string;
  body: string[];
}

export const englishPages: Record<string, EnglishPageCopy> = {
  "about-us": {
    eyebrow: "Wholesale meat supplier since 2003",
    title: "About Seventh Legion",
    lead: "A reliable partner for frozen meat supply, cold-chain logistics and wholesale shipments across Russia.",
    statLabel: "years in the market",
    statNote: "from receiving to delivery",
    body: [
      "Seventh Legion supplies pork, beef, poultry, offal and semi-finished products to distributors, HoReCa businesses, retailers and public procurement customers.",
      "Our team controls receiving, storage, handling and shipment under veterinary requirements and manufacturer specifications.",
    ],
  },
  brands: {
    eyebrow: "Our partners",
    title: "Brands",
    lead: "Manufacturers and suppliers represented in our wholesale assortment.",
    statLabel: "partner brands",
    statNote: "selected for reliable supply",
    body: ["Explore our producer and brand partners. Contact the sales team for current availability and commercial terms."],
  },
  "contact-us": {
    eyebrow: "Contact us",
    title: "Let’s discuss your supply",
    lead: "Tell us the products, volume and delivery destination. Our commercial team will prepare the next steps.",
    statLabel: "business hours",
    statNote: "Monday to Friday, 09:00–18:00",
    body: ["Phone: +7 495 232-36-52", "Sales: +7 919 777-79-63", "Email: info@myaso.msk.ru", "Warehouse: Moscow Region, Khimki, Lunyovo, 1B"],
  },
  dokumenty: {
    eyebrow: "Documents",
    title: "Documents",
    lead: "Commercial and company documents available for wholesale customers.",
    statLabel: "document files",
    statNote: "available on request",
    body: ["Request current price lists, company documents and supply terms from our commercial department."],
  },
  hranenie: {
    eyebrow: "Cold storage",
    title: "Storage that protects the cold chain",
    lead: "Receiving, storage and handling of frozen products under veterinary and manufacturer requirements.",
    statLabel: "storage temperature",
    statNote: "continuous cold-chain control",
    body: ["Our cold-storage infrastructure is designed to keep the product temperature stable from receiving to shipment.", "Equipment maintenance, staff training and process control are part of the daily operation."],
  },
  "logisticheskie-uslugi": {
    eyebrow: "Logistics",
    title: "From warehouse to loading point",
    lead: "Refrigerated transport and shipment organization for wholesale orders across Russia.",
    statLabel: "delivery formats",
    statNote: "by volume and destination",
    body: ["Refrigerated transport for Moscow and the region from 3 tonnes.", "Palletizing, recounting and weighing.", "Forwarding and documentation support, including Mercury procedures."],
  },
  postavshhiki: {
    eyebrow: "Suppliers",
    title: "Supplier partnerships",
    lead: "Long-term cooperation with producers and processors of frozen meat products.",
    statLabel: "supply categories",
    statNote: "from receiving to shipment",
    body: ["We work with manufacturers to maintain a stable assortment, clear specifications and predictable wholesale volumes."],
  },
  price: {
    eyebrow: "Price list",
    title: "Wholesale pricing",
    lead: "Prices depend on product, batch size, brand and delivery conditions. Our commercial team calculates the final offer.",
    statLabel: "pricing model",
    statNote: "volume and delivery conditions",
    body: ["Send the product list and required volume to receive a commercial proposal for your shipment."],
  },
  sertifikaty: {
    eyebrow: "Certificates",
    title: "Certificates and documents",
    lead: "Product and company documentation supporting wholesale shipments.",
    statLabel: "available files",
    statNote: "provided on request",
    body: ["Contact us for the current certificate and supporting document package for a selected product or batch."],
  },
  "stat-partnerom": {
    eyebrow: "Partnership",
    title: "Work with us",
    lead: "We welcome distributors, processors, HoReCa suppliers and public procurement partners.",
    statLabel: "business formats",
    statNote: "wholesale and supply",
    body: ["Tell us about your business, purchasing volume and delivery geography. We will propose a suitable cooperation format."],
  },
  vacancies: {
    eyebrow: "Careers",
    title: "Join Seventh Legion",
    lead: "We are looking for reliable colleagues in sales, operations, logistics and administration.",
    statLabel: "open roles",
    statNote: "send your CV to our team",
    body: ["Send your CV and a short introduction to info@myaso.msk.ru. We will contact you when a suitable position is available."],
  },
};
