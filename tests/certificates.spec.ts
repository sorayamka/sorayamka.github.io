import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import type { Certificate } from "../src/data/types";

const certificates: Certificate[] = JSON.parse(readFileSync(new URL("../src/data/certificates.json", import.meta.url), "utf8"));

test("supplier archive exposes every saved PDF and each file is available", async ({ page, request }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Full document inventory runs once");
  test.setTimeout(180000);
  const documents = new Map(certificates.flatMap((certificate) => certificate.files.map((file) => [file.path, file] as const)));
  expect(documents.size).toBe(127);
  for (const certificate of certificates) {
    const response = await request.get(`/certificates/${certificate.slug}/`);
    expect(response.status(), certificate.slug).toBe(200);
    const html = await response.text();
    for (const file of certificate.files) expect(html, certificate.slug).toContain(file.path);
  }
  for (const [path, file] of documents) {
    const response = await request.head(path);
    expect(response.status(), path).toBe(200);
    expect(response.headers()["content-type"], path).toContain("application/pdf");
    expect(Number(response.headers()["content-length"]), path).toBe(file.bytes);
  }
  await page.goto("/sertifikaty/");
  await expect(page.locator(".certificate-card")).toHaveCount(42);
  const first = page.locator('.certificate-card a[href$=".pdf"]').first();
  await expect(first).toHaveAttribute("target", "_blank");
  const file = await request.get((await first.getAttribute("href"))!);
  expect((await file.body()).subarray(0, 1024).toString("latin1")).toContain("%PDF-");
  await page.goto("/en/sertifikaty/");
  await expect(page.locator(".certificate-card")).toHaveCount(42);
});

test("weekly product photo fits inside its frame", async ({ page }) => {
  await page.goto("/");
  const image = page.locator(".product-of-week__media img");
  await image.scrollIntoViewIfNeeded();
  const layout = await image.evaluate((element) => {
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    const parent = element.parentElement!.getBoundingClientRect();
    return { fit: style.objectFit, padding: parseFloat(style.paddingLeft), width: rect.width, parentWidth: parent.width };
  });
  expect(layout.fit).toBe("contain");
  expect(layout.padding).toBeGreaterThan(0);
  expect(layout.width).toBeLessThanOrEqual(layout.parentWidth + 1);
});
