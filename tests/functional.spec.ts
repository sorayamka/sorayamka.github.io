import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

const failures = new WeakMap<Page, string[]>();
test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  failures.set(page, errors);
  page.on("pageerror", (error) => errors.push(error.message));
});
test.afterEach(async ({ page }) => {
  expect(failures.get(page), "Uncaught browser exceptions").toEqual([]);
});

for (const locale of ["ru", "en"] as const) {
  const prefix = locale === "en" ? "/en" : "";
  const catalog = `${prefix}/shop/`;

  test(`${locale}: categories, subcategories, sorting and empty search`, async ({ page }) => {
    await page.goto(catalog);
    const toggle = page.locator("[data-filter-toggle]");
    if (await toggle.isVisible()) await toggle.click();
    const category = page.locator("[data-category-filter]");
    if (await category.isVisible()) await category.selectOption("poultry");
    else await page.locator('[data-filter-category="poultry"]').click();
    await expect(page).toHaveURL(/category=poultry/);
    await expect.poll(() => page.locator('[data-product-card]:not([data-category="poultry"])').count()).toBe(0);
    await page.locator("[data-subcategory-filter]").selectOption("chicken");
    await expect(page).toHaveURL(/subcategory=chicken/);
    await expect.poll(() => page.locator('[data-product-card]:not([data-subcategory="chicken"])').count()).toBe(0);
    await page.locator("[data-sort-select]").selectOption("category");
    await expect(page).toHaveURL(/sort=category/);
    await page.locator("[data-catalog-search]").fill("zzzz_no_product_78291");
    await expect(page.locator("[data-catalog-empty]")).toBeVisible();
    await expect(page.locator("[data-product-grid]")).toBeHidden();
    await page.locator("[data-catalog-empty] [data-catalog-reset]").click();
    await expect(page.locator("[data-product-card]")).toHaveCount(48);
    await expect(page.locator("[data-catalog-empty]")).toBeHidden();
    await expect(page.locator("[data-catalog-search]")).toHaveValue("");
    await expect(page.locator("[data-result-count]")).toHaveText(/1[\s,]*120/);
  });

  test(`${locale}: last page, previous page, browser history and reload`, async ({ page }) => {
    await page.goto(catalog);
    await page.locator("[data-page-select]").selectOption("24");
    await expect(page).toHaveURL(/page=24/);
    await expect(page.locator("[data-product-card]")).toHaveCount(16);
    await expect(page.locator("[data-page-next]")).toBeDisabled();
    await expect(page.locator("[data-product-card]").first()).toBeInViewport();
    await page.locator("[data-page-prev]").click();
    await expect(page).toHaveURL(/page=23/);
    await expect(page.locator("[data-product-card]")).toHaveCount(48);
    await page.goBack();
    await expect(page).toHaveURL(/page=24/);
    await expect(page.locator("[data-product-card]")).toHaveCount(16);
    await page.reload();
    await expect(page.locator("[data-page-select]")).toHaveValue("24");
    await expect(page.locator("[data-product-card]")).toHaveCount(16);
  });

  test(`${locale}: repeated add, decrease to one and confirmed removal`, async ({ page }) => {
    await page.goto(catalog);
    const add = page.locator("[data-add-to-cart]").first();
    await add.click();
    await add.click();
    await page.locator("[data-cart-open]").click();
    const drawer = page.locator("#cart-drawer");
    await expect(drawer.locator(".cart-line")).toHaveCount(1);
    await expect(drawer.locator("[data-cart-quantity]")).toHaveText("2");
    await drawer.locator('[data-cart-action="decrease"]').click();
    await expect(drawer.locator("[data-cart-quantity]")).toHaveText("1");
    await expect(page.locator("[data-cart-count]").first()).toHaveText("1");
    page.once("dialog", (dialog) => void dialog.dismiss());
    await drawer.locator('[data-cart-action="remove"]').click();
    await expect(drawer.locator(".cart-line")).toHaveCount(1);
    page.once("dialog", (dialog) => void dialog.accept());
    await drawer.locator('[data-cart-action="remove"]').click();
    await expect(drawer.locator(".cart-line")).toHaveCount(0);
    await expect(page.locator("[data-cart-count]").first()).toHaveText("0");
  });

  test(`${locale}: cart download contains the selected product and quantity`, async ({ page }) => {
    await page.goto(catalog);
    const add = page.locator("[data-add-to-cart]").first();
    const name = await add.getAttribute("data-product-name");
    await add.click();
    await page.goto(`${prefix}/cart/`);
    const downloadPromise = page.waitForEvent("download");
    await page.locator("[data-cart-download]:visible").click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^sedmoy-legion-.*\.txt$/);
    const file = await download.path();
    expect(file).toBeTruthy();
    const text = await readFile(file!, "utf8");
    expect(text).toContain(name!);
    expect(text).toContain(locale === "ru" ? "Количество: 1" : "Quantity: 1");
    expect(text).toContain(new URL(catalog, page.url()).origin);
  });

  test(`${locale}: search shortcut, ticker and cart Escape`, async ({ page }) => {
    await page.goto(catalog);
    await page.keyboard.press("/");
    await expect(page.locator("[data-catalog-search]")).toBeFocused();
    await page.goto(`${prefix}/`);
    const ticker = page.locator("[data-ticker-toggle]");
    await ticker.click();
    await expect(page.locator(".ticker")).toHaveClass(/is-paused/);
    await ticker.click();
    await expect(page.locator(".ticker")).not.toHaveClass(/is-paused/);
    await page.locator("[data-cart-open]").click();
    await expect(page.locator("#cart-drawer")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator("#cart-drawer")).toBeHidden();
    await expect(page.locator("body")).not.toHaveClass(/has-modal/);
  });

  test(`${locale}: corrupt stored cart recovers without breaking the page`, async ({ page }) => {
    await page.goto(catalog);
    await page.evaluate(() => localStorage.setItem("seventh-legion-cart:v1", "invalid JSON"));
    await page.reload();
    await expect(page.locator("[data-cart-count]").first()).toHaveText("0");
    await page.locator("[data-add-to-cart]").first().click();
    await expect(page.locator("[data-cart-count]").first()).toHaveText("1");
  });

  test(`${locale}: saved filter URL and name sort survive a reload`, async ({ page }) => {
    await page.goto(`${catalog}?category=poultry&subcategory=chicken&q=${encodeURIComponent(locale === "ru" ? "Голень" : "chicken")}&sort=name`);
    await expect(page.locator("[data-catalog-search]")).toHaveValue(locale === "ru" ? "Голень" : "chicken");
    await expect.poll(() => page.locator("[data-product-card]").count()).toBeGreaterThan(0);
    await expect.poll(() => page.locator('[data-product-card]:not([data-subcategory="chicken"])').count()).toBe(0);
    const names = await page.locator("[data-product-card] h3").allTextContents();
    expect(names).toEqual([...names].sort((left, right) => left.localeCompare(right, locale)));
    const first = await page.locator("[data-product-card]").first().getAttribute("data-id");
    await page.reload();
    await expect(page.locator("[data-product-card]").first()).toHaveAttribute("data-id", first!);
    await expect(page.locator("[data-subcategory-filter]")).toHaveValue("chicken");
  });

  test(`${locale}: cart synchronizes across tabs and clear confirmation can be cancelled`, async ({ page, context }) => {
    await page.goto(catalog);
    const second = await context.newPage();
    await second.goto(`${prefix}/cart/`);
    await page.locator("[data-add-to-cart]").first().click();
    await expect(second.locator("[data-cart-page-count]")).toHaveText("1");
    await expect(second.locator("[data-cart-page-items] .cart-line")).toHaveCount(1);
    second.once("dialog", (dialog) => void dialog.dismiss());
    await second.locator("[data-cart-clear]").click();
    await expect(second.locator("[data-cart-page-count]")).toHaveText("1");
    second.once("dialog", (dialog) => void dialog.accept());
    await second.locator("[data-cart-clear]").click();
    await expect(page.locator("[data-cart-count]").first()).toHaveText("0");
    await second.close();
  });

  test(`${locale}: decrease at one asks before removing`, async ({ page }) => {
    await page.goto(catalog);
    await page.locator("[data-add-to-cart]").first().click();
    await page.locator("[data-cart-open]").click();
    const decrease = page.locator('#cart-drawer [data-cart-action="decrease"]');
    page.once("dialog", (dialog) => void dialog.dismiss());
    await decrease.click();
    await expect(page.locator('#cart-drawer [data-cart-quantity]')).toHaveText("1");
    page.once("dialog", (dialog) => void dialog.accept());
    await decrease.click();
    await expect(page.locator('#cart-drawer .cart-line')).toHaveCount(0);
    await expect(page.locator("[data-cart-count]").first()).toHaveText("0");
  });

  test(`${locale}: failed catalog index leaves initial products usable`, async ({ page }) => {
    await page.route("**/catalog-index.json", (route) => route.abort("failed"));
    await page.goto(catalog);
    await expect(page.locator("[data-product-card]")).toHaveCount(48);
    await page.locator("[data-catalog-search]").fill("zzzz_unavailable_731");
    await expect(page.locator("[data-catalog-empty]")).toBeVisible();
    await page.locator("[data-catalog-empty] [data-catalog-reset]").click();
    await expect(page.locator("[data-product-card]")).toHaveCount(48);
    await page.locator("[data-add-to-cart]").first().click();
    await expect(page.locator("[data-cart-count]").first()).toHaveText("1");
  });

  test(`${locale}: all main navigation pages and category links load`, async ({ page, request }) => {
    await page.goto(`${prefix}/`);
    const links = await page.locator(".site-header a[href], .category-index a[href]").evaluateAll((items) =>
      [...new Set(items.map((item) => item.getAttribute("href")!))].filter((href) => href.startsWith("/") && !href.startsWith("//")),
    );
    for (const href of links) {
      const response = await request.get(href);
      expect(response.status(), href).toBe(200);
      expect(response.headers()["content-type"], href).toContain("text/html");
    }
    await page.locator(".category-index a").first().click();
    await expect(page.locator("[data-catalog]")).toBeVisible();
    const active = await page.locator("[data-catalog]").getAttribute("data-active-category");
    expect(active).toBeTruthy();
    const toggle = page.locator("[data-filter-toggle]");
    if (await toggle.isVisible()) await toggle.click();
    const category = page.locator("[data-category-filter]");
    if (await category.isVisible()) await category.selectOption("");
    else await page.locator('[data-filter-category=""]').click();
    await expect(page).toHaveURL(new RegExp(`${catalog}$`));
    await expect(page.locator("html")).toHaveAttribute("lang", locale);
  });
}

test("product language switch preserves item and cart across locales", async ({ page }) => {
  await page.goto("/shop/govyadina/ribaj-iz-govjadiny/");
  const add = page.locator("[data-product-form] [data-add-to-cart]");
  const id = await add.getAttribute("data-product-id");
  await add.click();
  await page.locator("[data-cart-close]").click();
  await page.locator('.language-switch a[hreflang="en"]').click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.locator("[data-product-form] [data-add-to-cart]")).toHaveAttribute("data-product-id", id!);
  await expect(page.locator("[data-cart-count]").first()).toHaveText("1");
  await page.locator('.language-switch a[hreflang="ru"]').click();
  await expect(page).toHaveURL(/\/shop\/govyadina\/ribaj-iz-govjadiny\/$/);
});

test("missing page returns 404 instead of a successful catalog fallback", async ({ request }) => {
  expect((await request.get("/missing-e2e-page-79123/")).status()).toBe(404);
});

test("full-width hero selects responsive image sources", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Viewport matrix runs once");
  for (const width of [390, 1440, 3840]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/");
    await expect.poll(() => page.locator(".home-hero__visual img").evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
    const result = await page.locator(".home-hero__visual").evaluate((element) => ({
      width: element.getBoundingClientRect().width,
      left: element.getBoundingClientRect().left,
      source: element.querySelector("img")!.currentSrc,
    }));
    expect(Math.abs(result.width - width)).toBeLessThanOrEqual(1);
    expect(Math.abs(result.left)).toBeLessThanOrEqual(1);
    expect(result.source).toContain(`/hero-${width === 390 ? 800 : width === 1440 ? 1600 : 3840}.avif`);
  }
});

test("desktop search submits to catalog; menu closes outside", async ({ page, isMobile }) => {
  test.skip(isMobile, "Desktop navigation only");
  await page.goto("/");
  const menu = page.locator(".desktop-nav .nav-menu").first();
  await menu.locator("summary").click();
  await expect(menu).toHaveAttribute("open", "");
  await page.locator("h1").click();
  await expect(menu).not.toHaveAttribute("open", "");
  await page.locator("#header-search-input").fill("Голень");
  await page.locator("#header-search-input").press("Enter");
  await expect(page).toHaveURL(/\/shop\/\?q=/);
  await expect(page.locator("[data-catalog-search]")).toHaveValue("Голень");
  await expect(page.locator("[data-product-card]").first()).toBeVisible();
});

test("mobile menu traps focus and navigates to catalog", async ({ page, isMobile }) => {
  test.skip(!isMobile, "Mobile navigation only");
  await page.goto("/");
  await page.locator(".mobile-menu > summary").click();
  const panel = page.locator(".mobile-menu__panel");
  await expect(panel).toBeVisible();
  const close = panel.locator("[data-mobile-menu-close]");
  await expect(close).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(panel.locator('a[href^="mailto:"]')).toBeFocused();
  await panel.locator('a[href="/shop/"]').click();
  await expect(page).toHaveURL(/\/shop\/$/);
  await expect(page.locator("body")).not.toHaveClass(/mobile-menu-open/);
});

test("product quantity validation rejects zero and accepts a chosen quantity", async ({ page }) => {
  await page.goto("/shop/govyadina/ribaj-iz-govjadiny/");
  const quantity = page.getByLabel("Кол-во");
  await quantity.fill("0");
  await page.locator("[data-product-form] [data-add-to-cart]").click();
  await expect(page.locator("[data-cart-count]").first()).toHaveText("0");
  expect(await quantity.evaluate((input: HTMLInputElement) => input.validity.valid)).toBe(false);
  await quantity.fill("3");
  await page.locator("[data-product-form] [data-add-to-cart]").click();
  await expect(page.locator("[data-cart-count]").first()).toHaveText("3");
});

test("price list, documents and contact links point to usable resources", async ({ page, request }) => {
  await page.goto("/");
  await expect(page.locator(".product-of-week__price-list li")).toHaveCount(7);
  await expect(page.locator(".product-of-week__price-list")).toContainText("425 ₽/кг");
  const productPath = await page.locator(".product-of-week__media").getAttribute("href");
  expect((await request.get(productPath!)).status()).toBe(200);
  for (const path of ["/price/", "/dokumenty/", "/sertifikaty/", "/contact-us/"]) {
    expect((await page.goto(path))?.status(), path).toBe(200);
    await expect(page.locator("h1")).toBeVisible();
  }
  await expect(page.locator('a[href="mailto:info@myaso.msk.ru"]').first()).toHaveAttribute("href", "mailto:info@myaso.msk.ru");
  await page.goto("/dokumenty/");
  const pdfs = await page.locator('a[href$=".pdf"]').evaluateAll((links) => links.map((link) => link.getAttribute("href")!));
  expect(pdfs.length).toBeGreaterThan(0);
  for (const href of new Set(pdfs)) {
    const response = await request.get(href);
    expect(response.status(), href).toBe(200);
    expect(response.headers()["content-type"]).toContain("application/pdf");
  }
});
