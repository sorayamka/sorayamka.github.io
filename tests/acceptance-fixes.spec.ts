import { expect, test } from "@playwright/test";

test("320px header and pagination fit and menu remains usable", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  for (const route of ["/", "/shop/", "/en/brands/"]) {
    await page.goto(route);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), route).toBeLessThanOrEqual(1);
    const rect = await page.locator(".mobile-menu > summary").boundingBox();
    expect(rect!.x + rect!.width).toBeLessThanOrEqual(320);
    await page.locator(".mobile-menu > summary").click();
    await expect(page.locator(".mobile-menu__panel")).toBeVisible();
    await page.locator("[data-mobile-menu-close]").click();
  }
});

test("all brand cards have individual localized pages", async ({ page, request }) => {
  test.setTimeout(120000);
  for (const prefix of ["", "/en"]) {
    await page.goto(`${prefix}/brands/`);
    await expect(page.locator("a.brand-card")).toHaveCount(118);
    const urls = await page.locator("a.brand-card").evaluateAll((cards) => cards.map((card) => card.getAttribute("href")!));
    expect(new Set(urls).size).toBe(118);
    for (const url of urls) {
      expect(url).toMatch(new RegExp(`^${prefix}/brands/[^/]+/$`));
      expect((await request.get(url)).status(), url).toBe(200);
    }
  }
});

test("brand search and repeated whitespace return matching products", async ({ page }) => {
  await page.goto("/shop/?q=" + encodeURIComponent("Мираторг"));
  await expect.poll(async () => Number((await page.locator("[data-result-count]").innerText()).replace(/\D/g, ""))).toBeGreaterThan(0);
  await page.locator("[data-catalog-search]").fill("Филе грудки");
  await expect.poll(async () => Number((await page.locator("[data-result-count]").innerText()).replace(/\D/g, ""))).toBeGreaterThan(0);
  const count = await page.locator("[data-result-count]").innerText();
  await page.locator("[data-catalog-search]").fill("  Филе   грудки  ");
  await expect(page.locator("[data-result-count]")).toHaveText(count);
  await page.goto("/en/shop/?q=miratorg");
  await expect.poll(async () => Number((await page.locator("[data-result-count]").innerText()).replace(/\D/g, ""))).toBeGreaterThan(0);
});

test("failed cart save does not double a later successful add", async ({ page }) => {
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem;
    (window as any).restoreAuditStorage = () => { Storage.prototype.setItem = original; };
    Storage.prototype.setItem = () => { throw new DOMException("Simulated storage failure", "QuotaExceededError"); };
  });
  await page.goto("/shop/");
  const button = page.locator("[data-add-to-cart]").first();
  await button.click();
  await expect(page.locator("[data-toast]")).toContainText("Не удалось сохранить");
  await expect(page.locator("[data-cart-count]").first()).toHaveText("0");
  await page.evaluate(() => (window as any).restoreAuditStorage());
  await button.click();
  await expect(page.locator("[data-cart-count]").first()).toHaveText("1");
  await page.reload();
  await expect(page.locator("[data-cart-count]").first()).toHaveText("1");
});
