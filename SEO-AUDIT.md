# SEO audit — Seventh Legion

## Scope and evidence

This pass covers the generated Astro HTML, internal links, language alternates,
canonical URLs, XML sitemaps, JSON-LD and browser regression tests. It follows
the technical, ecommerce, international and image audit topics in
AgriciDaniel/claude-seo; its Claude Code runtime was not installed or invoked.
No Search Console, CrUX, keyword-volume or backlink account data was available.
No ranking, organic-traffic or field Core Web Vitals scores are inferred.

## Implemented

- GitHub Pages preview pages emit `noindex, follow`. Building with the default
  production domain restores normal indexing except pages explicitly marked noindex.
- Canonical, social-image and site-owned JSON-LD URLs use the build domain.
- Product language alternates and the language switch use matching product IDs,
  not a guessed `/en/` prefix. Pages without translated counterparts do not
  advertise nonexistent alternates. Cyrillic routes are resolved consistently.
- Product and category pages include BreadcrumbList structured data. Category
  links use actual generated routes, including the English `semi-finished`
  category and Russian poultry subcategories.
- Removed unpriced Offer objects and the unsupported assertion that the
  distributor is every product's manufacturer/brand. Existing verified product
  names, categories, images and SKUs remain. Products without confirmed prices
  are not claimed to qualify for Google merchant rich results.
- Product descriptions in metadata include the product name and commercial
  context rather than packaging-only boilerplate, with a maximum of 180 characters.
- Sitemaps omit cart, redirect and non-HTML endpoint URLs. Legacy category
  redirects are generated only for real category/subcategory paths.
- robots.txt uses the build domain for its sitemap and excludes both carts.
  Preview noindex is in HTML, so robots.txt still permits crawling it.
- Fixed locale loss when changing category from an English category page.
- Non-versioned catalog JSON now revalidates in the Nginx example instead of
  being cached immutable for a year. Hashed Astro assets keep immutable caching.
- Added responsive 800/1600/3840 px AVIF hero variants and retained WebP fallback.
  The 3840x2560 AVIF is 1,009,130 bytes; WebP fallback is 2,525,314 bytes.
  Small screens select smaller assets rather than always downloading 4K.

## Generated-site verification

Run:

```
python scripts/audit_seo.py D:/site-dist --site https://sorayamka.github.io --preview
```

Verified output:

- 2,349 generated HTML files, including 18 redirects.
- 126,716 internal anchor references examined.
- 2,328 sitemap URLs.
- Zero broken internal links, broken redirect targets, missing titles/descriptions,
  invalid H1 counts, canonical mismatches, broken/nonreciprocal declared alternates,
  unpriced Offer objects or invalid JSON-LD found by the automated checker.
- 227 duplicate-title groups and 57 duplicate-description groups remain and are
  reported separately; they are not silently treated as resolved.

The former 2,678-page output included unnecessary product-category redirect
pages. Removing these does not remove the 1,120 catalog products.

## Remaining work, ordered by dependency

### High: verified product identity and English copy

Several different product records share the same display name. Obtain producer,
packaging, weight and SKU information to distinguish them in titles and copy.
Do not append random identifiers merely to make a title unique. Replace English
fallback transliterations with reviewed translations before promoting English
organic landing pages. Success: distinct product records have meaningful names
and descriptions; bilingual reviewers confirm accuracy.

### High: crawlable catalog pagination

Current pagination/search works in JavaScript; only the first 48 products per
category are server-rendered. All products are in the sitemap, but static
paginated category pages and normal anchor links would improve crawl discovery.
Implement this as a separate route/UI change with pagination and history tests.
Success: all products can be discovered from category HTML without JavaScript.

### High: final-domain migration

Deploy on the confirmed production domain, configure actual HTTP 301 redirects
on that server and verify status codes. GitHub Pages meta-refresh redirects are
not equivalent to server HTTP redirects. Connect Google Search Console and
Yandex Webmaster and submit the production sitemap. Do not remove preview
noindex to make the demo compete with the existing company site.

### Medium: commercial and local data

Match the seven supplied wholesale prices to exact catalog records, including
producer and packaging, and establish who updates them and when. Only then add
priced offers to those products. Verify company/warehouse addresses, hours,
producer relationships and current certificate dates with the client. Do not
fabricate reviews, ratings, GTINs, shipping fees or stock guarantees.

### Medium: measured performance and content strategy

Collect PageSpeed/CrUX or real-user data on the final domain, targeting LCP <=2.5s,
INP <=200ms and CLS <=0.1 at the 75th percentile. Local browser tests and image
byte sizes are not substitutes for those field measurements. Research Russian
B2B queries and competitors with observable sources before proposing search
volumes, traffic targets or new location/category pages.

## Boundaries

No fabricated SEO health score, ranking guarantee, keyword volume, AI-citation
claim or rich-result guarantee is included. No paid API, external analytics tag
or installation was enabled. Product data and the supplied price values were
preserved.
