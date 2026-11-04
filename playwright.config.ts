import { defineConfig } from "@playwright/test";

const remoteURL = process.env.TEST_BASE_URL;
const localURL = "http://127.0.0.1:4321";

export default defineConfig({
  testDir: "./tests",
  timeout: 60000,
  expect: { timeout: 10000 },
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: remoteURL ?? localURL,
    headless: true,
    launchOptions: {
      ...(process.platform === "win32" ? { executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" } : {}),
    },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: remoteURL ? undefined : {
    command: `npm run preview -- --host 127.0.0.1 --port 4321${process.env.TEST_OUT_DIR ? ` --outDir "${process.env.TEST_OUT_DIR}"` : ""}`,
    url: localURL,
    reuseExistingServer: true,
    timeout: 120000,
  },
  projects: [
    {
      name: "desktop",
      use: { viewport: { width: 1440, height: 1000 } },
    },
    {
      name: "mobile",
      use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
    },
  ],
});
