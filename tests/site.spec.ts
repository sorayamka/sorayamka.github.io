import { expect, test } from "@playwright/test";

test("homepage renders and has no horizontal overflow", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("response", (response) => {
    if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
  });
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Седьмой Легион");
  await expect(page.locator(".product-of-week")).toBeVisible();
  await expect(page.locator(".product-of-week")).toContainText("Тушка цыпленка");
  await expect(page.locator(".product-of-week")).toContainText("Цена по запросу");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await page.evaluate(async () => {
    const step = Math.max(window.innerHeight * 0.75, 600);
    for (let position = 0; position < document.documentElement.scrollHeight; position += step) {
      window.scrollTo(0, position);
      await new Promise((resolve) => setTimeout(resolve, 90));
    }
    window.scrollTo(0, 0);
  });
  await page.screenshot({ path: `test-results/home-${testInfo.project.name}.png`, fullPage: true });
  expect(errors).toEqual([]);
});

test("catalog search, filtering and reset work", async ({ page }) => {
  await page.goto("/shop/");
  const search = page.getByPlaceholder("Название продукта…");
  await search.fill("Голень");
  await expect.poll(async () => page.getByText("товаров найдено").locator("xpath=preceding-sibling::strong").textContent()).not.toBe("1 120");
  await expect(page.locator("[data-product-card]:visible").first()).toBeVisible();
  expect(await page.locator("[data-product-card]:visible").count()).toBeGreaterThan(0);
  expect(await page.locator("[data-product-card]:visible").count()).toBeLessThan(100);
  const filterToggle = page.locator("[data-filter-toggle]");
  if (await filterToggle.isVisible()) await filterToggle.click();
  const reset = page.getByRole("button", { name: "Сбросить", exact: true }).first();
  if (await reset.isVisible()) await reset.click();
  await expect(search).toHaveValue("");
  await expect.poll(async () => page.locator("[data-product-card]:visible").count()).toBe(48);
  await expect(page.locator("[data-result-count]")).toHaveText(/1\s*120/);
  await page.locator("[data-page-next]").click();
  await expect(page).toHaveURL(/[?&]page=2(?:&|$)/);
  await expect(page.locator("[data-page-start]")).toHaveText("49");
  await expect(page.locator("[data-product-grid]")).toBeInViewport();
  await expect(page.locator("[data-product-card]").first()).toBeInViewport();
  await expect(page.locator("[data-product-card] .product-card__index").first()).toHaveText(/^\d{3}$/);
});

test("English locale keeps the catalog index lazy and switches back", async ({ page }) => {
  const indexRequests: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.endsWith("/catalog-index.json")) indexRequests.push(request.url());
  });

  await page.goto("/en/shop/");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  expect(await page.locator("body").innerText()).not.toMatch(/[А-Яа-яЁё]/);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await expect(page.getByPlaceholder("Product name…")).toBeVisible();
  expect(await page.locator("[data-product-card]").count()).toBe(48);
  expect(indexRequests).toHaveLength(0);

  await page.getByPlaceholder("Product name…").fill("Beef");
  await expect.poll(() => indexRequests.length).toBe(1);
  await expect.poll(() => page.locator("[data-product-card]:visible").count()).toBeGreaterThan(0);

  await page.locator('a[hreflang="ru"]').first().click();
  await expect(page).toHaveURL(/\/shop\/$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "ru");
});

test("cart persists and supports quantity", async ({ page, context }) => {
  await page.goto("/shop/");
  const firstAdd = page.locator("[data-add-to-cart]").first();
  await firstAdd.click();
  await expect(page.locator("[data-cart-count]").first()).toHaveText("1");
  await page.locator("[data-cart-open]").first().click();
  await expect(page.locator("#cart-drawer")).toBeVisible();
  await page.locator('#cart-drawer [data-cart-action="increase"]').first().click();
  await expect(page.locator("#cart-drawer").getByText("2", { exact: true }).first()).toBeVisible();
  await page.locator("[data-cart-close]").click();
  await page.goto("/cart/");
  await expect(page.locator("[data-cart-page-count]")).toHaveText("2");
  await expect(page.locator("[data-cart-page-items] .cart-line")).toHaveCount(1);
  await page.reload();
  await expect(page.locator("[data-cart-page-count]")).toHaveText("2");
  page.once("dialog", (dialog) => void dialog.accept());
  await page.locator("[data-cart-clear]").click();
  await expect(page.locator("[data-cart-page-count]")).toHaveText("0");
  const stored = await context.storageState();
  expect(stored).toBeTruthy();
});

test("mobile navigation opens when enabled", async ({ page, isMobile }) => {
  test.skip(!isMobile);
  await page.goto("/");
  await page.locator(".mobile-menu > summary").click();
  await expect(page.locator(".mobile-menu__panel")).toBeVisible();
  await expect(page.getByRole("link", { name: /Каталог/ }).last()).toBeVisible();
  await page.getByRole("button", { name: "Закрыть меню" }).click();
  await expect(page.locator(".mobile-menu__panel")).toBeHidden();
});

test("product form submits with Enter", async ({ page }) => {
  await page.goto("/shop/govyadina/ribaj-iz-govjadiny/");
  await page.getByLabel("Кол-во").fill("2");
  await page.getByLabel("Кол-во").press("Enter");
  await expect(page.locator("#cart-drawer")).toBeVisible();
  await expect(page.locator("[data-cart-count]").first()).toHaveText("2");
});

test("key pages fit common device widths", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Viewport matrix runs once");
  const routes = ["/", "/hranenie/", "/logisticheskie-uslugi/", "/contact-us/"];
  const viewports = [
    { width: 360, height: 800 },
    { width: 768, height: 1024 },
    { width: 1024, height: 768 },
    { width: 1440, height: 900 },
    { width: 1920, height: 1080 },
  ];

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    for (const route of routes) {
      await page.goto(route);
      const audit = await page.evaluate(() => {
        const stat = document.querySelector<HTMLElement>(".page-hero__stat")?.getBoundingClientRect();
        const categoryImage = document.querySelector<HTMLElement>(".category-index__card img");
        return {
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          hiddenRevealCount: [...document.querySelectorAll<HTMLElement>("[data-reveal]")].filter((element) => getComputedStyle(element).opacity === "0").length,
          stat,
          categoryImageOpacity: categoryImage ? Number(getComputedStyle(categoryImage).opacity) : null,
        };
      });
      expect(audit.overflow, `${route} at ${viewport.width}px`).toBeLessThanOrEqual(1);
      expect(audit.hiddenRevealCount, `${route} at ${viewport.width}px`).toBe(0);
      if (audit.stat) {
        expect(audit.stat.left, `${route} at ${viewport.width}px`).toBeGreaterThanOrEqual(0);
        expect(audit.stat.right, `${route} at ${viewport.width}px`).toBeLessThanOrEqual(viewport.width + 1);
      }
      if (route === "/" && audit.categoryImageOpacity !== null) {
        expect(audit.categoryImageOpacity).toBeGreaterThan(0.5);
      }
    }
  }
});
