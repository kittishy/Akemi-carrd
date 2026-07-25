const { defineConfig, devices } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "./tests",
  timeout: 30_000,
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "on-first-retry"
  },
  webServer: {
    command: "node scripts/static-server.js",
    url: "http://127.0.0.1:4173/public/index.html",
    reuseExistingServer: true,
    timeout: 30_000
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // Only overridden when PLAYWRIGHT_CHROMIUM_PATH is set (e.g. sandboxes
        // that ship a pre-installed browser at a non-standard path). Leave
        // unset elsewhere so `npx playwright install`'s normal browser
        // resolution keeps working for everyone else.
        ...(process.env.PLAYWRIGHT_CHROMIUM_PATH
          ? { launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } }
          : {})
      }
    }
  ]
});
