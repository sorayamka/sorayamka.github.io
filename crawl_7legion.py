from __future__ import annotations

import csv
import hashlib
import json
import mimetypes
import re
import sys
import threading
import time
from collections import deque
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import unquote, urljoin, urlsplit, urlunsplit
from xml.etree import ElementTree

import requests
from bs4 import BeautifulSoup

BASE_URL = "https://7legion.com/"
HOSTS = {"7legion.com", "www.7legion.com"}
SITEMAP_NAMES = [
    "posts-post",
    "posts-page",
    "posts-product",
    "taxonomies-category",
    "taxonomies-post_tag",
    "taxonomies-product_cat",
    "taxonomies-product_tag",
    "taxonomies-product_brand",
]
SITEMAP_ROOT = f"{BASE_URL}wp-sitemap-{{}}-1.xml"
ARCHIVE = Path("7legion-archive")
HTML_DIR = ARCHIVE / "html"
CONTENT_DIR = ARCHIVE / "content"
SITEMAP_DIR = ARCHIVE / "sitemaps"
DATA_DIR = ARCHIVE / "data"
ASSET_DIR = ARCHIVE / "assets"
USER_AGENT = "Mozilla/5.0 (compatible; SiteContentArchiver/1.0)"
HTML_SUFFIXES = {".html", ".htm", ".xhtml"}
SKIP_PARTS = {
    "cart",
    "checkout",
    "my-account",
    "wishlist",
    "compare",
    "wp-admin",
    "wp-json",
    "wp-includes",
    "wc-api",
    "wc-auth",
    "wc-logs",
}
ASSET_SUFFIXES = {
    ".jpg",
    ".jpeg",
    ".png",
    ".gif",
    ".webp",
    ".svg",
    ".avif",
    ".bmp",
    ".ico",
    ".pdf",
    ".doc",
    ".docx",
    ".xls",
    ".xlsx",
    ".ppt",
    ".pptx",
    ".rtf",
    ".csv",
    ".zip",
    ".rar",
    ".7z",
    ".mp3",
    ".mp4",
    ".webm",
    ".mov",
}
DOWNLOADABLE_PREFIXES = ("/wp-content/uploads/", "/wp-content/elementor/")
LOCK = threading.Lock()


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def normalize_url(value: str, base: str = BASE_URL) -> str | None:
    try:
        parsed = urlsplit(urljoin(base, value.strip()))
    except (TypeError, ValueError):
        return None
    host = (parsed.hostname or "").lower()
    if parsed.scheme not in {"http", "https"} or host not in HOSTS:
        return None
    path = re.sub(r"/{2,}", "/", parsed.path or "/")
    if not path.startswith("/"):
        path = f"/{path}"
    return urlunsplit(("https", "7legion.com", path, "", ""))


def request_bytes(url: str, attempts: int = 4) -> tuple[bytes, str, int, str]:
    headers = {"User-Agent": USER_AGENT, "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"}
    last_error = ""
    for attempt in range(attempts):
        try:
            response = requests.get(url, headers=headers, timeout=(15, 75), allow_redirects=True)
            if response.status_code == 429 or response.status_code >= 500:
                retry_after = response.headers.get("Retry-After")
                delay = float(retry_after) if retry_after and retry_after.isdigit() else 2**attempt
                time.sleep(min(delay, 20))
                continue
            response.raise_for_status()
            return response.content, response.url, response.status_code, response.headers.get("Content-Type", "")
        except requests.RequestException as error:
            last_error = str(error)
            time.sleep(2**attempt)
    raise RuntimeError(last_error or "request failed")


def safe_parts(url: str) -> list[str]:
    path = unquote(urlsplit(url).path).strip("/")
    values = path.split("/") if path else ["home"]
    cleaned = []
    for value in values:
        value = re.sub(r'[<>:"/\\|?*\x00-\x1f]', "-", value).strip(" .")
        cleaned.append(value or "index")
    return cleaned


def clean_text(value: str) -> str:
    value = value.replace("\xa0", " ")
    return re.sub(r"\n{3,}", "\n\n", re.sub(r"[ \t]+", " ", value)).strip()


def absolute(value: str, source_url: str) -> str | None:
    try:
        return normalize_url(urljoin(source_url, value))
    except (TypeError, ValueError):
        return None


def meta_value(soup: BeautifulSoup, key: str) -> str:
    tag = soup.find("meta", attrs={"property": key}) or soup.find("meta", attrs={"name": key})
    return clean_text(str(tag.get("content", ""))) if tag else ""


def srcset_urls(value: str, source_url: str) -> set[str]:
    candidates = []
    for item in value.split(","):
        parts = item.strip().split()
        if not parts:
            continue
        descriptor = parts[1] if len(parts) > 1 else ""
        match = re.fullmatch(r"(\d+)(w|x)", descriptor)
        score = int(match.group(1)) * (1 if match and match.group(2) == "w" else 1000) if match else 0
        normalized = absolute(parts[0], source_url)
        if normalized:
            candidates.append((score, normalized))
    if not candidates:
        return set()
    return {max(candidates)[1]}


def collect_assets(soup: BeautifulSoup, source_url: str) -> set[str]:
    urls: set[str] = set()
    for tag in soup.find_all(True):
        for attribute in ("src", "data-src", "data-lazy-src", "data-original", "poster"):
            value = tag.get(attribute)
            if isinstance(value, str):
                normalized = absolute(value, source_url)
                if normalized:
                    urls.add(normalized)
        srcset = tag.get("srcset") or tag.get("data-srcset")
        if isinstance(srcset, str):
            urls.update(srcset_urls(srcset, source_url))
    for style in soup.find_all(style=True):
        for match in re.findall(r"url\(['\"]?([^'\")]+)", str(style.get("style", ""))):
            normalized = absolute(match, source_url)
            if normalized:
                urls.add(normalized)
    return urls


def internal_page_links(soup: BeautifulSoup, source_url: str) -> set[str]:
    links = set()
    for tag in soup.find_all("a", href=True):
        normalized = absolute(str(tag["href"]), source_url)
        if not normalized:
            continue
        parsed = urlsplit(normalized)
        parts = [part.lower() for part in parsed.path.split("/") if part]
        if any(part in SKIP_PARTS for part in parts):
            continue
        suffix = Path(parsed.path).suffix.lower()
        if suffix in ASSET_SUFFIXES:
            continue
        if suffix and suffix not in HTML_SUFFIXES:
            continue
        links.add(normalized)
    return links


def parse_json_ld(value: str) -> Any:
    try:
        return json.loads(value)
    except (json.JSONDecodeError, TypeError):
        return None


def find_json_type(value: Any, wanted: str) -> list[dict[str, Any]]:
    found = []
    if isinstance(value, dict):
        item_type = value.get("@type")
        types = item_type if isinstance(item_type, list) else [item_type]
        if wanted in types or (wanted == "Product" and any(str(item).startswith("Product") for item in types if item)):
            found.append(value)
        for child in value.values():
            found.extend(find_json_type(child, wanted))
    elif isinstance(value, list):
        for child in value:
            found.extend(find_json_type(child, wanted))
    return found


def extract_product(soup: BeautifulSoup, structured_data: Any) -> dict[str, Any]:
    products = find_json_type(structured_data, "Product")
    if not products:
        return {}
    product = products[0]
    offers = product.get("offers", {})
    if isinstance(offers, list):
        offers = offers[0] if offers else {}
    if not isinstance(offers, dict):
        offers = {}
    brand = product.get("brand", "")
    if isinstance(brand, dict):
        brand = brand.get("name", "")
    image = product.get("image", "")
    if isinstance(image, list):
        image = image[0] if image else ""
    if isinstance(image, dict):
        image = image.get("url", "")
    product_title = soup.select_one(".product_title, .product-title, h1")
    fallback_title = clean_text(product_title.get_text(" ", strip=True)) if product_title else ""
    return {
        "name": clean_text(str(product.get("name", fallback_title))),
        "sku": clean_text(str(product.get("sku", ""))),
        "mpn": clean_text(str(product.get("mpn", ""))),
        "description": clean_text(str(product.get("description", ""))),
        "brand": clean_text(str(brand)),
        "price": offers.get("price", product.get("offers", {}).get("price", "") if isinstance(product.get("offers"), dict) else ""),
        "currency": clean_text(str(offers.get("priceCurrency", ""))),
        "availability": clean_text(str(offers.get("availability", ""))),
        "url": normalize_url(str(product.get("url", "")), BASE_URL) or "",
        "image": absolute(str(image), BASE_URL) if image else "",
    }


def page_route_dir(base: Path, url: str) -> Path:
    return base.joinpath(*safe_parts(url))


def extract_page(url: str, content: bytes, final_url: str, content_type: str, status: int) -> tuple[dict[str, Any], set[str], set[str]]:
    decoded = content.decode("utf-8", errors="replace")
    soup = BeautifulSoup(decoded, "html.parser")
    title = clean_text(soup.title.get_text(" ", strip=True)) if soup.title else ""
    description = meta_value(soup, "description") or meta_value(soup, "og:description")
    canonical_tag = soup.find("link", rel=lambda value: value and "canonical" in value)
    canonical = absolute(str(canonical_tag.get("href", "")), final_url) if canonical_tag else ""
    headings = []
    for level in ("h1", "h2", "h3", "h4"):
        headings.extend(clean_text(tag.get_text(" ", strip=True)) for tag in soup.find_all(level))
    structured_values = [parse_json_ld(tag.get_text()) for tag in soup.find_all("script", type="application/ld+json")]
    structured_data = [value for value in structured_values if value is not None]
    for node in soup.find_all(["script", "style", "noscript", "svg"]):
        node.decompose()
    full_text = clean_text(soup.get_text("\n", strip=True))
    main_node = soup.find("main") or soup.find("article") or soup.body
    main_text = clean_text(main_node.get_text("\n", strip=True)) if main_node else full_text
    assets = collect_assets(soup, final_url)
    links = internal_page_links(soup, final_url)
    all_links = []
    for tag in soup.find_all("a", href=True):
        value = str(tag["href"]).strip()
        normalized = absolute(value, final_url)
        all_links.append({"text": clean_text(tag.get_text(" ", strip=True)), "href": normalized or value})
        if normalized:
            parsed = urlsplit(normalized)
            suffix = Path(parsed.path).suffix.lower()
            if parsed.path.startswith(DOWNLOADABLE_PREFIXES) and suffix in ASSET_SUFFIXES:
                assets.add(normalized)
    product = extract_product(soup, structured_data)
    record = {
        "url": url,
        "final_url": normalize_url(final_url) or final_url,
        "status": status,
        "content_type": content_type,
        "title": title,
        "description": description,
        "language": str((soup.find("html") or {}).get("lang", "")),
        "canonical": canonical,
        "headings": headings,
        "text": full_text,
        "main_text": main_text,
        "structured_data": structured_data,
        "links": all_links,
        "internal_page_links": sorted(links),
        "assets": sorted(assets),
        "product": product,
        "fetched_at": now_iso(),
        "sha256": hashlib.sha256(content).hexdigest(),
    }
    return record, links, assets


def load_sitemaps() -> tuple[set[str], list[dict[str, Any]]]:
    urls = set()
    manifest = []
    namespace = "{http://www.sitemaps.org/schemas/sitemap/0.9}"
    SITEMAP_DIR.mkdir(parents=True, exist_ok=True)
    for name in SITEMAP_NAMES:
        url = SITEMAP_ROOT.format(name)
        try:
            content, _, status, content_type = request_bytes(url)
            path = SITEMAP_DIR / f"{name}.xml"
            path.write_bytes(content)
            root = ElementTree.fromstring(content)
            found = [str(node.text) for node in root.findall(f"{namespace}url/{namespace}loc") if node.text]
            normalized = {value for value in (normalize_url(item) for item in found) if value}
            urls.update(normalized)
            manifest.append({"name": name, "url": url, "status": status, "content_type": content_type, "urls": len(normalized)})
            print(f"Sitemap {name}: {len(normalized)}", flush=True)
        except Exception as error:
            manifest.append({"name": name, "url": url, "status": "error", "error": str(error), "urls": 0})
            print(f"Sitemap {name}: ERROR {error}", flush=True)
    return urls, manifest


def save_page(record: dict[str, Any], content: bytes) -> None:
    route = page_route_dir(HTML_DIR, record["url"])
    route.mkdir(parents=True, exist_ok=True)
    (route / "index.html").write_bytes(content)
    output = page_route_dir(CONTENT_DIR, record["url"])
    output.mkdir(parents=True, exist_ok=True)
    headings = "\n".join(f"{level + 1}# {value}" for level, value in enumerate(record["headings"][:30]) if value)
    front = {
        "title": record["title"],
        "description": record["description"],
        "source": record["url"],
        "canonical": record["canonical"],
        "fetched_at": record["fetched_at"],
    }
    front_text = "\n".join(f"{key}: {json.dumps(value, ensure_ascii=False)}" for key, value in front.items())
    (output / "index.md").write_text(f"{front_text}\n\n{headings}\n\n{record['main_text'] or record['text']}\n", encoding="utf-8")


def crawl_pages(initial_urls: set[str]) -> tuple[list[dict[str, Any]], set[str], list[dict[str, Any]]]:
    known = set(initial_urls)
    processed = set()
    records = []
    failures = []
    all_assets = set()
    with ThreadPoolExecutor(max_workers=8) as executor:
        while processed < known:
            pending = sorted(known - processed)
            futures = {}
            for url in pending:
                futures[executor.submit(fetch_page, url)] = url
            processed.update(pending)
            for index, future in enumerate(as_completed(futures), 1):
                url = futures[future]
                try:
                    record, links, assets = future.result()
                    save_page(record, record.pop("_content"))
                    records.append(record)
                    known.update(links)
                    all_assets.update(assets)
                except Exception as error:
                    failures.append({"url": url, "error": str(error), "fetched_at": now_iso()})
                if index % 25 == 0 or index == len(pending):
                    print(f"Pages: {len(records)} saved, {len(failures)} failed, {len(known)} discovered", flush=True)
    return records, all_assets, failures


def fetch_page(url: str) -> tuple[dict[str, Any], set[str], set[str]]:
    route = page_route_dir(HTML_DIR, url)
    cached = route / "index.html"
    if cached.exists():
        content = cached.read_bytes()
        fetched_at = datetime.fromtimestamp(cached.stat().st_mtime, timezone.utc).isoformat()
        record, links, assets = extract_page(url, content, url, "text/html", 200)
        record["fetched_at"] = fetched_at
        record["_content"] = content
        return record, links, assets
    content, final_url, status, content_type = request_bytes(url)
    record, links, assets = extract_page(url, content, final_url, content_type, status)
    record["_content"] = content
    return record, links, assets


def safe_filename(url: str, content_type: str) -> str:
    parsed = urlsplit(url)
    base = unquote(Path(parsed.path).name) or "asset"
    base = re.sub(r'[<>:"/\\|?*\x00-\x1f]', "-", base).strip(" .")
    suffix = Path(base).suffix.lower()
    if not suffix or len(suffix) > 8:
        suffix = mimetypes.guess_extension(content_type.split(";")[0].strip()) or ""
    stem = Path(base).stem if Path(base).suffix else base
    stem = re.sub(r"[^A-Za-z0-9._-]+", "-", stem).strip("-._")[:80] or "asset"
    return f"{stem}{suffix.lower()}"


def save_asset(url: str) -> dict[str, Any]:
    digest = hashlib.sha256(url.encode("utf-8")).hexdigest()
    folder = ASSET_DIR / digest[:2]
    folder.mkdir(parents=True, exist_ok=True)
    cached = sorted(folder.glob(f"{digest[:12]}-*"))
    if cached:
        path = cached[0]
        content = path.read_bytes()
        return {
            "url": url,
            "final_url": url,
            "path": path.as_posix(),
            "status": 200,
            "content_type": mimetypes.guess_type(path.name)[0] or "application/octet-stream",
            "bytes": len(content),
            "sha256": hashlib.sha256(content).hexdigest(),
            "downloaded_at": datetime.fromtimestamp(path.stat().st_mtime, timezone.utc).isoformat(),
        }
    try:
        content, final_url, status, content_type = request_bytes(url)
        filename = safe_filename(final_url or url, content_type)
        folder = ASSET_DIR / digest[:2]
        folder.mkdir(parents=True, exist_ok=True)
        path = folder / f"{digest[:12]}-{filename}"
        path.write_bytes(content)
        return {
            "url": url,
            "final_url": final_url,
            "path": path.as_posix(),
            "status": status,
            "content_type": content_type,
            "bytes": len(content),
            "sha256": hashlib.sha256(content).hexdigest(),
            "downloaded_at": now_iso(),
        }
    except Exception as error:
        return {"url": url, "status": "error", "error": str(error), "downloaded_at": now_iso()}


def download_assets(asset_urls: set[str]) -> list[dict[str, Any]]:
    records = []
    urls = sorted(
        url
        for url in asset_urls
        if urlsplit(url).path.startswith(DOWNLOADABLE_PREFIXES)
        and Path(urlsplit(url).path).suffix.lower() in ASSET_SUFFIXES
    )
    with ThreadPoolExecutor(max_workers=8) as executor:
        futures = {executor.submit(save_asset, url): url for url in urls}
        for index, future in enumerate(as_completed(futures), 1):
            records.append(future.result())
            if index % 50 == 0 or index == len(urls):
                errors = sum(record["status"] == "error" for record in records)
                print(f"Assets: {index}/{len(urls)}, {errors} failed", flush=True)
    return records


def write_outputs(records: list[dict[str, Any]], assets: list[dict[str, Any]], failures: list[dict[str, Any]], sitemaps: list[dict[str, Any]], initial_count: int) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    records.sort(key=lambda item: item["url"])
    (DATA_DIR / "pages.json").write_text(json.dumps(records, ensure_ascii=False, indent=2), encoding="utf-8")
    (DATA_DIR / "assets.json").write_text(json.dumps(assets, ensure_ascii=False, indent=2), encoding="utf-8")
    (DATA_DIR / "failures.json").write_text(json.dumps(failures, ensure_ascii=False, indent=2), encoding="utf-8")
    products = [record["product"] | {"source_url": record["url"], "page_title": record["title"]} for record in records if record.get("product")]
    (DATA_DIR / "products.json").write_text(json.dumps(products, ensure_ascii=False, indent=2), encoding="utf-8")
    fields = ["source_url", "page_title", "name", "sku", "mpn", "brand", "price", "currency", "availability", "url", "image", "description"]
    with (DATA_DIR / "products.csv").open("w", encoding="utf-8-sig", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=fields, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(products)
    total_bytes = sum(record.get("bytes", 0) for record in assets)
    manifest = {
        "source": BASE_URL,
        "created_at": now_iso(),
        "sitemap_urls": initial_count,
        "pages_saved": len(records),
        "pages_failed": len(failures),
        "assets_discovered": len(assets),
        "assets_saved": sum(record["status"] != "error" for record in assets),
        "assets_failed": sum(record["status"] == "error" for record in assets),
        "asset_bytes": total_bytes,
        "products": len(products),
        "directories": {
            "html": HTML_DIR.as_posix(),
            "content": CONTENT_DIR.as_posix(),
            "sitemaps": SITEMAP_DIR.as_posix(),
            "assets": ASSET_DIR.as_posix(),
            "data": DATA_DIR.as_posix(),
        },
        "sitemaps": sitemaps,
    }
    (ARCHIVE / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")


def finalize_existing() -> None:
    started = time.monotonic()
    records = []
    asset_urls = set()
    pages = sorted(HTML_DIR.rglob("index.html"))
    for index, path in enumerate(pages, 1):
        relative = path.parent.relative_to(HTML_DIR)
        url = BASE_URL if relative.parts == ("home",) else f"{BASE_URL}{'/'.join(relative.parts)}/"
        content = path.read_bytes()
        fetched_at = datetime.fromtimestamp(path.stat().st_mtime, timezone.utc).isoformat()
        record, _, assets = extract_page(url, content, url, "text/html", 200)
        record["fetched_at"] = fetched_at
        records.append(record)
        asset_urls.update(assets)
        if index % 250 == 0 or index == len(pages):
            print(f"Indexed: {index}/{len(pages)} pages, {len(asset_urls)} assets", flush=True)
    assets = download_assets(asset_urls)
    sitemaps = [{"name": path.stem, "path": path.as_posix()} for path in sorted(SITEMAP_DIR.glob("*.xml"))]
    write_outputs(records, assets, [], sitemaps, 1368)
    elapsed = round(time.monotonic() - started, 1)
    print(f"Archive ready: {ARCHIVE.resolve()} in {elapsed}s", flush=True)


def main() -> None:
    started = time.monotonic()
    for directory in (HTML_DIR, CONTENT_DIR, SITEMAP_DIR, DATA_DIR, ASSET_DIR):
        directory.mkdir(parents=True, exist_ok=True)
    initial_urls, sitemaps = load_sitemaps()
    print(f"Downloading {len(initial_urls)} sitemap pages", flush=True)
    pages, asset_urls, failures = crawl_pages(initial_urls)
    assets = download_assets(asset_urls)
    write_outputs(pages, assets, failures, sitemaps, len(initial_urls))
    elapsed = round(time.monotonic() - started, 1)
    print(f"Archive ready: {ARCHIVE.resolve()} in {elapsed}s", flush=True)


if __name__ == "__main__":
    if "--finalize" in sys.argv:
        finalize_existing()
    else:
        main()
