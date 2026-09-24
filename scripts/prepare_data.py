from __future__ import annotations

import hashlib
import html
import json
import re
import shutil
import tempfile
import unicodedata
from pathlib import Path
from urllib.parse import unquote, urlsplit
from urllib.request import Request, urlopen

from bs4 import BeautifulSoup
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
ARCHIVE = ROOT / "7legion-archive"
DATA = ARCHIVE / "data"
SOURCE_DATA = ROOT / "src" / "data"
PUBLIC = ROOT / "public"
PRODUCT_IMAGES = PUBLIC / "images" / "products"
SITE_IMAGE_DIR = PUBLIC / "images" / "site"
SITE_IMAGE_CACHE = Path(tempfile.gettempdir()) / "seventh-legion-site-images"
BRAND_IMAGES = PUBLIC / "images" / "brands"
CERTIFICATE_IMAGES = PUBLIC / "images" / "certificates"
DOCUMENTS = PUBLIC / "documents"

CATEGORY_MAP = {
    "svinina-svinina": ("pork", "Свинина"),
    "govyadina": ("beef", "Говядина"),
    "poultry": ("poultry", "Птица"),
    "ptica": ("poultry", "Птица"),
    "polufabrikaty": ("semi-finished", "Полуфабрикаты"),
    "subprodukty": ("offal", "Субпродукты"),
    "baranina": ("lamb", "Баранина"),
    "krolchatina": ("rabbit", "Крольчатина"),
}

CANONICAL_CATEGORY_KEYS = {
    "svinina-svinina",
    "govyadina",
    "ptica",
    "polufabrikaty",
    "subprodukty",
    "baranina",
    "krolchatina",
}

SUBCATEGORY_MAP = {
    "kurica": ("chicken", "Курица"),
    "indejka": ("turkey", "Индейка"),
    "utka": ("duck", "Утка"),
    "chicken": ("chicken", "Курица"),
    "turkey": ("turkey", "Индейка"),
    "duck": ("duck", "Утка"),
    "subprodukty-pticy": ("poultry", "Субпродукты птицы"),
    "subprodukty-svinye": ("pork", "Субпродукты свинины"),
    "subprodukty-govjazhi": ("beef", "Субпродукты говядины"),
}

SITE_IMAGE_SOURCES = {
    "logo": "https://7legion.com/wp-content/uploads/2021/1122/10:56/logo-png.png",
    "favicon": "https://7legion.com/wp-content/uploads/2021/1122/10:56/favicon-300x300.png",
    "hero": "https://images.unsplash.com/photo-1735020886196-bed638cc1809?fm=jpg&q=90&w=2400&auto=format&fit=max",
    "storage": "https://images.pexels.com/photos/29834274/pexels-photo-29834274.jpeg?auto=compress&cs=tinysrgb&w=2400",
    "logistics": "https://images.unsplash.com/photo-1720811559371-7b0ebd219127?fm=jpg&q=90&w=2400&auto=format&fit=max",
    "cold-chain": "https://images.unsplash.com/photo-1762049213265-675d3e57fe5a?fm=jpg&q=90&w=2400&auto=format&fit=max",
}

RESPONSIVE_SITE_IMAGE_NAMES = {"hero", "storage", "logistics", "cold-chain"}



def normalize_text(value: str) -> str:
    value = html.unescape(value or "")
    value = value.replace("\xa0", " ")
    return re.sub(r"\s+", " ", value).strip()


def normalized_name(value: str) -> str:
    return re.sub(r"[^a-zа-яё0-9]+", "", unicodedata.normalize("NFKC", value).lower().replace("ё", "е"))


def clean_description(value: str) -> str:
    value = normalize_text(value)
    value = value.replace("Cрок", "Срок").replace("нформация", "Информация")
    value = re.sub(r"(?<=\d)\s+(?=(?:кг|г|мл|л)\b)", "\u00a0", value)
    value = re.sub(r"(?<=\d)(?=(?:кг|г|мл|л)\b)", "\u00a0", value)
    value = re.sub(
        r"(\d+)\.\s*(\d+)\s*(кг|г|мл|л)\b",
        lambda match: f"{match.group(1)},{match.group(2)}\u00a0{match.group(3)}",
        value,
    )
    return value


def safe_name(value: str) -> str:
    value = normalize_text(value)
    value = re.sub(r'[<>:"/\\|?*\x00-\x1f]', "-", value)
    return re.sub(r"-+", "-", value).strip(" .-")[:90] or "file"


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def build_asset_index(assets: list[dict]) -> tuple[dict[str, Path], dict[str, Path]]:
    exact = {}
    by_name = {}
    for asset in assets:
        if asset.get("status") == "error" or not asset.get("path"):
            continue
        path = ROOT / asset["path"]
        if not path.exists():
            continue
        exact[asset["url"]] = path
        by_name.setdefault(Path(urlsplit(asset["url"]).path).name.lower(), path)
    return exact, by_name


def resolve_asset(url: str, exact: dict[str, Path], by_name: dict[str, Path]) -> Path | None:
    if not url:
        return None
    if url in exact:
        return exact[url]
    path = urlsplit(url).path
    name = Path(unquote(path)).name.lower()
    return by_name.get(name)


def download_image(url: str) -> Path | None:
    digest = hashlib.sha256(url.encode("utf-8")).hexdigest()[:16]
    SITE_IMAGE_CACHE.mkdir(parents=True, exist_ok=True)
    destination = SITE_IMAGE_CACHE / f"source-{digest}.jpg"
    if destination.exists():
        return destination
    try:
        request = Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urlopen(request, timeout=90) as response, destination.open("wb") as output:
            shutil.copyfileobj(response, output)
        return destination
    except OSError:
        destination.unlink(missing_ok=True)
        return None


def image_size(path: Path) -> tuple[int, int] | None:
    try:
        with Image.open(path) as image:
            return image.size
    except (OSError, ValueError):
        return None


def optimize_image(source: Path, destination: Path, max_size: tuple[int, int], quality: int = 82) -> bool:
    try:
        destination.parent.mkdir(parents=True, exist_ok=True)
        with Image.open(source) as opened:
            image = ImageOps.exif_transpose(opened)
            if getattr(image, "is_animated", False):
                image.seek(0)
            image = image.convert("RGB")
            image.thumbnail(max_size, Image.Resampling.LANCZOS)
            image.save(destination, "WEBP", quality=quality, method=6)
        return True
    except (OSError, ValueError):
        return False


def copy_file(source: Path, destination: Path) -> bool:
    try:
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, destination)
        return True
    except OSError:
        return False


def create_favicon(source: Path, destination: Path) -> bool:
    try:
        destination.parent.mkdir(parents=True, exist_ok=True)
        with Image.open(source) as opened:
            logo = ImageOps.exif_transpose(opened).convert("RGBA")
            logo.thumbnail((440, 250), Image.Resampling.LANCZOS)
            canvas = Image.new("RGBA", (512, 512), (11, 17, 22, 255))
            position = ((512 - logo.width) // 2, (512 - logo.height) // 2)
            canvas.alpha_composite(logo, position)
            canvas.save(destination, "PNG", optimize=True)
        return True
    except OSError:
        return False


def product_category(path_parts: list[str]) -> dict[str, str]:
    category_parts = [part for part in path_parts[1:-1] if part]
    primary = category_parts[0] if category_parts else "other"
    primary_slug, primary_name = CATEGORY_MAP.get(primary, (primary, primary.replace("-", " ").title()))
    subcategory_slug = ""
    subcategory_name = ""
    if len(category_parts) > 1:
        subcategory_slug, subcategory_name = SUBCATEGORY_MAP.get(category_parts[1], (category_parts[1], category_parts[1].replace("-", " ").title()))
    return {
        "slug": primary_slug,
        "name": primary_name,
        "subcategorySlug": subcategory_slug,
        "subcategoryName": subcategory_name,
    }


def prepare_products(products: list[dict], exact: dict[str, Path], by_name: dict[str, Path]) -> tuple[list[dict], list[dict]]:
    output = []
    categories = {}
    image_cache = {}
    for index, item in enumerate(products):
        source_url = item.get("source_url", "")
        if "/en/" in source_url or "/shop/" not in source_url:
            continue
        parsed = urlsplit(source_url)
        source_parts = [part for part in parsed.path.strip("/").split("/") if part]
        if len(source_parts) < 3 or source_parts[1] not in CANONICAL_CATEGORY_KEYS:
            continue
        path_parts = [part for part in parsed.path.strip("/").split("/") if part]
        if len(path_parts) < 3:
            continue
        category = product_category(path_parts)
        name = normalize_text(item.get("name") or item.get("page_title", "Мясной продукт"))
        source_image = item.get("image", "")
        image_key = source_image or source_url
        if image_key in image_cache:
            image_path, thumbnail_path = image_cache[image_key]
        else:
            source_path = resolve_asset(source_image, exact, by_name)
            if source_path and source_path.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp"}:
                digest = hashlib.sha256(image_key.encode("utf-8")).hexdigest()[:14]
                image_path = PRODUCT_IMAGES / f"{digest}.webp"
                thumbnail_path = PRODUCT_IMAGES / f"{digest}-480.webp"
                if not image_path.exists():
                    optimize_image(source_path, image_path, (1200, 1200), 74)
                if image_path.exists() and not thumbnail_path.exists():
                    optimize_image(source_path, thumbnail_path, (480, 480), 72)
                if not image_path.exists() or not thumbnail_path.exists():
                    image_path = None
                    thumbnail_path = None
            else:
                image_path = None
                thumbnail_path = None
            image_cache[image_key] = (image_path, thumbnail_path)
        product_path = parsed.path if parsed.path.endswith("/") else f"{parsed.path}/"
        product = {
            "id": hashlib.sha256(product_path.encode("utf-8")).hexdigest()[:16],
            "slug": path_parts[-1],
            "name": name,
            "description": clean_description(item.get("description", "")),
            "sku": normalize_text(item.get("sku")),
            "category": category["name"],
            "categorySlug": category["slug"],
            "subcategory": category["subcategoryName"],
            "subcategorySlug": category["subcategorySlug"],
            "inStock": not item.get("availability") or str(item.get("availability", "")).endswith("InStock"),
            "image": f"/images/products/{image_path.name}" if image_path else "",
            "thumbnail": f"/images/products/{thumbnail_path.name}" if thumbnail_path else "",
            "sourceUrl": source_url,
            "path": product_path,
        }
        output.append(product)
        category_key = category["slug"]
        category_record = categories.setdefault(
            category_key,
            {
                "slug": category["slug"],
                "name": category["name"],
                "subcategories": {},
                "count": 0,
            },
        )
        category_record["count"] += 1
        if category["subcategorySlug"]:
            category_record["subcategories"][category["subcategorySlug"]] = category["subcategoryName"]
    output.sort(key=lambda item: (item["categorySlug"], item["name"].lower(), item["slug"]))
    category_list = sorted(categories.values(), key=lambda item: item["name"])
    for category in category_list:
        category["subcategories"] = [
            {"slug": slug, "name": name}
            for slug, name in sorted(category["subcategories"].items(), key=lambda pair: pair[1])
        ]
    return output, category_list


def prepare_brands(pages: list[dict], exact: dict[str, Path], by_name: dict[str, Path]) -> list[dict]:
    output = []
    seen = set()

    def add_brand(name: str, slug: str, image_source: str, source_url: str) -> None:
        name = normalize_text(name).replace('"', "").replace("“", "").replace("”", "").strip("«» ")
        key = normalized_name(name)
        blocked = {"английский", "русский", "яндексметрика", "яндексметрика"}
        if not name or key in seen or key in blocked or re.fullmatch(r"птица\d+", key):
            return
        source_path = resolve_asset(image_source, exact, by_name)
        logo = ""
        if source_path and source_path.suffix.lower() != ".svg":
            digest = hashlib.sha256((image_source or slug).encode("utf-8")).hexdigest()[:14]
            destination = BRAND_IMAGES / f"{digest}.webp"
            if not destination.exists():
                optimize_image(source_path, destination, (520, 520), 88)
            if destination.exists():
                logo = f"/images/brands/{destination.name}"
        elif source_path and source_path.suffix.lower() == ".svg":
            destination = BRAND_IMAGES / f"{safe_name(slug)}.svg"
            if copy_file(source_path, destination):
                logo = f"/images/brands/{destination.name}"
        seen.add(key)
        output.append({"name": name, "slug": slug, "logo": logo, "sourceUrl": source_url})

    brands_page = ARCHIVE / "html" / "brands" / "index.html"
    if brands_page.exists():
        soup = BeautifulSoup(brands_page.read_text(encoding="utf-8", errors="replace"), "html.parser")
        for link in soup.select('a[href*="/product_brand/"]'):
            image = link.find("img")
            if image is None:
                continue
            source_url = str(link.get("href", ""))
            slug = urlsplit(source_url).path.rstrip("/").split("/")[-1]
            image_source = str(image.get("data-src") or image.get("data-lazy-src") or image.get("src") or "")
            add_brand(
                str(image.get("alt", "")),
                slug,
                image_source,
                source_url if source_url.startswith("http") else f"https://7legion.com{source_url}",
            )
        for image in soup.find_all("img"):
            name = str(image.get("alt", ""))
            image_source = str(image.get("data-src") or image.get("data-lazy-src") or image.get("src") or "")
            if not name or not image_source or "logo-png" in image_source:
                continue
            slug = f"brand-{hashlib.sha256(normalized_name(name).encode('utf-8')).hexdigest()[:12]}"
            add_brand(name, slug, image_source, "https://7legion.com/brands/")

    brand_text = ARCHIVE / "content" / "brands" / "index.md"
    if brand_text.exists():
        collecting = False
        for line in brand_text.read_text(encoding="utf-8").splitlines():
            name = normalize_text(line)
            if name.startswith('"ГК"'):
                collecting = True
            if not collecting:
                continue
            slug = f"brand-{hashlib.sha256(normalized_name(name).encode('utf-8')).hexdigest()[:12]}"
            add_brand(name, slug, "", "https://7legion.com/brands/")
            if name == "ТМ Линдипрайм":
                break

    return sorted(output, key=lambda item: item["name"].lower())


def prepare_certificates(pages: list[dict], exact: dict[str, Path], by_name: dict[str, Path]) -> list[dict]:
    output = []
    certificate_images = {}
    certificate_list = ARCHIVE / "html" / "brands" / "sertifikaty" / "index.html"
    if certificate_list.exists():
        listing_soup = BeautifulSoup(
            certificate_list.read_text(encoding="utf-8", errors="replace"),
            "html.parser",
        )
        for link in listing_soup.find_all("a", href=True):
            slug = urlsplit(str(link.get("href", ""))).path.rstrip("/").split("/")[-1]
            image = link.find("img")
            if not slug or image is None:
                continue
            image_source = str(
                image.get("data-lazy-src")
                or image.get("data-src")
                or image.get("src")
                or ""
            )
            if image_source:
                certificate_images[slug] = image_source
    for page in pages:
        parsed = urlsplit(page.get("url", ""))
        parts = [part for part in parsed.path.strip("/").split("/") if part]
        if len(parts) != 1 or not (parts[0].startswith("sert-") or parts[0].startswith("starozhilovskaja")):
            continue
        name = normalize_text((page.get("headings") or [page.get("title", "")])[0])
        if not name or " – " in name:
            name = name.split(" – ")[0]
        image_source = certificate_images.get(parts[0]) or next(
            (
                url
                for url in page.get("assets", [])
                if Path(urlsplit(url).path).suffix.lower() in {".jpg", ".jpeg", ".png", ".webp"}
                and "logo-png" not in url
            ),
            "",
        )
        source_path = resolve_asset(image_source, exact, by_name)
        if not source_path:
            certificate_html = ARCHIVE / "html" / parts[0] / "index.html"
            if certificate_html.exists():
                certificate_soup = BeautifulSoup(
                    certificate_html.read_text(encoding="utf-8", errors="replace"),
                    "html.parser",
                )
                certificate_image = certificate_soup.select_one(".entry-media img")
                if certificate_image is not None:
                    fallback_source = str(
                        certificate_image.get("data-src")
                        or certificate_image.get("data-lazy-src")
                        or certificate_image.get("src")
                        or ""
                    )
                    source_path = resolve_asset(fallback_source, exact, by_name)
        image = ""
        if source_path:
            destination = CERTIFICATE_IMAGES / f"{safe_name(parts[0])}.webp"
            if not destination.exists():
                optimize_image(source_path, destination, (1200, 900), 86)
            if destination.exists():
                image = f"/images/certificates/{destination.name}"
        output.append(
            {
                "name": name,
                "slug": parts[0],
                "image": image,
                "description": normalize_text(page.get("description", "")),
                "path": parsed.path if parsed.path.endswith("/") else f"{parsed.path}/",
                "sourceUrl": page.get("url", ""),
            }
        )
    return output


def prepare_documents(pages: list[dict], exact: dict[str, Path]) -> list[dict]:
    output = []
    seen = set()
    allowed_pages = {"/price/", "/dokumenty/", "/contact-us/"}
    for page in pages:
        parsed = urlsplit(page.get("url", ""))
        if parsed.path not in allowed_pages:
            continue
        for link in page.get("links", []):
            url = link.get("href", "")
            link_path = urlsplit(url).path
            suffix = Path(link_path).suffix.lower()
            if suffix not in {".pdf", ".doc", ".docx", ".xls", ".xlsx", ".rtf", ".zip"}:
                continue
            source_path = exact.get(url)
            if not source_path or url in seen:
                continue
            destination = DOCUMENTS / f"{safe_name(Path(unquote(link_path)).stem)}{suffix}"
            if copy_file(source_path, destination):
                seen.add(url)
                output.append(
                    {
                        "name": "Коммерческое предложение" if suffix == ".pdf" else destination.name,
                        "path": f"/documents/{destination.name}",
                        "sourceUrl": url,
                    }
                )
    return output


def prepare_site_assets(exact: dict[str, Path], by_name: dict[str, Path]) -> dict[str, str]:
    result = {}
    for name, url in SITE_IMAGE_SOURCES.items():
        source = resolve_asset(url, exact, by_name)
        if name == "favicon":
            source = source or resolve_asset(SITE_IMAGE_SOURCES["logo"], exact, by_name)
            destination = SITE_IMAGE_DIR / "favicon.png"
            if source and create_favicon(source, destination):
                result[name] = "/images/site/favicon.png"
            continue
        source = source or download_image(url)
        if not source:
            continue
        if name == "logo":
            destination = SITE_IMAGE_DIR / "logo.png"
            if copy_file(source, destination):
                result[name] = "/images/site/logo.png"
            continue
        if name in RESPONSIVE_SITE_IMAGE_NAMES:
            generated = []
            for width in (800, 1600):
                destination = SITE_IMAGE_DIR / f"{name}-{width}.webp"
                if not destination.exists():
                    optimize_image(source, destination, (width, 2400 if width == 1600 else 1200), 78)
                if destination.exists():
                    generated.append(destination)
            if len(generated) == 2:
                result[f"{name}-small"] = f"/images/site/{generated[0].name}"
                result[name] = f"/images/site/{generated[1].name}"
    return result


def prepare_team(exact: dict[str, Path], by_name: dict[str, Path]) -> list[dict]:
    team = [
        {"name": "Галина Зырянова", "role": "Главный бухгалтер", "phone": "+7 495 232-04-70", "email": "g.zyryanova@myaso.msk.ru"},
        {"name": "Екатерина Филимонова", "role": "Менеджер коммерческого отдела", "phone": "+7 910 306-75-85", "email": "e.filimonova@myaso.msk.ru"},
        {"name": "Екатерина Трофимова", "role": "Менеджер по документообороту", "phone": "+7 495 225-06-36", "email": "e.mavlutova@myaso.msk.ru"},
        {"name": "Елизавета Шашкова", "role": "Менеджер по документообороту", "phone": "+7 996 972-68-65", "email": "e.shashkova@myaso.msk.ru"},
        {"name": "Ксения Шубина", "role": "Юрист", "phone": "+7 985 887-77-07", "email": "k.shubina@myaso.msk.ru"},
        {"name": "Ольга Кирсанова", "role": "Заместитель генерального директора", "phone": "+7 967 250-07-13", "email": "o.kirsanova@myaso.msk.ru"},
        {"name": "Анна Марютина", "role": "Менеджер по продажам", "phone": "+7 985 476-82-46", "email": "a.maryutina@myaso.msk.ru"},
        {"name": "Анастасия Цой", "role": "Менеджер по продажам", "phone": "+7 919 777-79-62", "email": "a.coy@myaso.msk.ru"},
    ]
    for person in team:
        person["image"] = ""
    return team


def main() -> None:
    for directory in (SOURCE_DATA, PRODUCT_IMAGES, SITE_IMAGE_DIR, BRAND_IMAGES, CERTIFICATE_IMAGES, DOCUMENTS):
        directory.mkdir(parents=True, exist_ok=True)
    products = load_json(DATA / "products.json")
    pages = load_json(DATA / "pages.json")
    assets = load_json(DATA / "assets.json")
    exact, by_name = build_asset_index(assets)
    catalog, categories = prepare_products(products, exact, by_name)
    brands = prepare_brands(pages, exact, by_name)
    certificates = prepare_certificates(pages, exact, by_name)
    documents = prepare_documents(pages, exact)
    site_images = prepare_site_assets(exact, by_name)
    team = prepare_team(exact, by_name)
    outputs = {
        "catalog.json": catalog,
        "categories.json": categories,
        "brands.json": brands,
        "certificates.json": certificates,
        "documents.json": documents,
        "team.json": team,
        "site-images.json": site_images,
    }
    for name, value in outputs.items():
        (SOURCE_DATA / name).write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Products: {len(catalog)}")
    print(f"Categories: {len(categories)}")
    print(f"Brands: {len(brands)}")
    print(f"Certificates: {len(certificates)}")
    print(f"Documents: {len(documents)}")
    print(f"Product images: {len(list(PRODUCT_IMAGES.glob('*.webp')))}")


if __name__ == "__main__":
    main()
