export interface Product {
  id: string;
  slug: string;
  name: string;
  description: string;
  sku: string;
  category: string;
  categorySlug: string;
  subcategory: string;
  subcategorySlug: string;
  inStock: boolean;
  image: string;
  thumbnail: string;
  sourceUrl: string;
  path: string;
}

export interface Category {
  slug: string;
  name: string;
  subcategories: Array<{ slug: string; name: string }>;
  count: number;
}

export interface Brand {
  name: string;
  slug: string;
  logo: string;
  sourceUrl: string;
}

export interface Certificate {
  name: string;
  slug: string;
  image: string;
  description: string;
  path: string;
  sourceUrl: string;
}

export interface TeamMember {
  name: string;
  role: string;
  phone: string;
  email: string;
  image: string;
}

export interface DocumentFile {
  name: string;
  path: string;
  sourceUrl: string;
}
