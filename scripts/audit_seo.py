import argparse
import json
from collections import Counter
from pathlib import Path
from urllib.parse import unquote, urlsplit
from xml.etree import ElementTree

from bs4 import BeautifulSoup

parser = argparse.ArgumentParser()
parser.add_argument("directory", type=Path)
parser.add_argument("--site", default="https://7legion.com")
parser.add_argument("--preview", action="store_true")
args = parser.parse_args()
root = args.directory
pages = {}
for file in root.rglob("*.html"):
    relative = file.relative_to(root).as_posix()
    route = "/" + relative.removesuffix("index.html")
    pages[route] = (file, BeautifulSoup(file.read_text(encoding="utf-8"), "html.parser"))

errors = []
alternates = {}
titles = Counter()
descriptions = Counter()
redirects = 0
internal_links = 0
for route, (file, soup) in pages.items():
    refresh = soup.find("meta", attrs={"http-equiv": "refresh"})
    if refresh:
        redirects += 1
        target = refresh.get("content", "").partition("url=")[2].strip(" '\"")
        if target and urlsplit(target).path not in pages:
            errors.append(f"Broken redirect {route}: {target}")
        continue
    title = soup.title.get_text(strip=True) if soup.title else ""
    titles[title] += 1
    description = soup.find("meta", attrs={"name": "description"})
    descriptions[description.get("content", "") if description else ""] += 1
    if not title or not description:
        errors.append(f"Missing metadata {route}")
    if len(soup.find_all("h1")) != 1:
        errors.append(f"H1 count {route}")
    canonical = soup.find("link", rel="canonical")
    if not canonical or unquote(canonical.get("href", "")) != args.site.rstrip("/") + route:
        errors.append(f"Canonical mismatch {route}")
    if args.preview:
        robots = soup.find("meta", attrs={"name": "robots"})
        if not robots or "noindex" not in robots.get("content", ""):
            errors.append(f"Preview indexable {route}")
    alternates[route] = []
    for link in soup.select('link[rel="alternate"][hreflang]'):
        target = unquote(urlsplit(link.get("href", "")).path)
        alternates[route].append(target)
        if target not in pages:
            errors.append(f"Broken alternate {route}: {target}")
    for anchor in soup.find_all("a", href=True):
        href = anchor["href"]
        if not href.startswith("/") or href.startswith("//"):
            continue
        target = unquote(urlsplit(href).path)
        internal_links += 1
        if target not in pages and not (root / target.lstrip("/")).is_file():
            errors.append(f"Broken link {route}: {target}")
    for script in soup.select('script[type="application/ld+json"]'):
        try:
            data = json.loads(script.get_text())
            records = data if isinstance(data, list) else [data]
            for record in records:
                if record.get("@type") == "Product" and record.get("offers") and not record["offers"].get("price"):
                    errors.append(f"Unpriced Offer {route}")
        except (ValueError, TypeError):
            errors.append(f"Invalid JSON-LD {route}")

for route, targets in alternates.items():
    for target in targets:
        if route not in alternates.get(target, []):
            errors.append(f"Nonreciprocal alternate {route}: {target}")

sitemap_urls = []
for file in root.glob("sitemap-*.xml"):
    document = ElementTree.parse(file)
    if document.getroot().tag.endswith("urlset"):
        sitemap_urls.extend(element.text for element in document.findall("{*}url/{*}loc"))
for url in sitemap_urls:
    route = unquote(urlsplit(url).path)
    if route not in pages or pages[route][1].find("meta", attrs={"http-equiv": "refresh"}):
        errors.append(f"Invalid sitemap URL {url}")

print(json.dumps({
    "pages": len(pages), "redirects": redirects, "internal_links": internal_links,
    "sitemap_urls": len(sitemap_urls),
    "duplicate_title_groups": sum(count > 1 for count in titles.values()),
    "duplicate_description_groups": sum(count > 1 for count in descriptions.values()),
    "error_count": len(errors), "errors": errors[:60],
}, ensure_ascii=True, indent=2))
raise SystemExit(bool(errors))
