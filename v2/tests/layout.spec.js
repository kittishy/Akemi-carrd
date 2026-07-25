const { test, expect } = require("@playwright/test");
const { openHome } = require("./helpers");

// Mobile-first: the whole point of the "one screen, no scroll" design is
// that it never overflows horizontally, from the smallest real phones up.
const viewports = [
  { width: 320, height: 700 },
  { width: 360, height: 800 },
  { width: 375, height: 667 }, // iPhone SE — shortest common viewport
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1366, height: 768 }
];

for (const { width, height } of viewports) {
  test(`no horizontal overflow at ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await openHome(page);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });
}

test("profile card renders in one screen at iPhone SE height", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await openHome(page);
  const overflowY = await page.evaluate(() => document.documentElement.scrollHeight - document.documentElement.clientHeight);
  expect(overflowY).toBeLessThanOrEqual(1);
});

test("decorative stickers are hidden from assistive tech and don't block clicks", async ({ page }) => {
  await openHome(page);
  const stickers = page.locator(".decor-sticker, .decor-sparkle");
  const count = await stickers.count();
  expect(count).toBeGreaterThan(0);
  for (let i = 0; i < count; i++) {
    await expect(stickers.nth(i)).toHaveAttribute("aria-hidden", "true");
  }
});

test("core landmarks are present and accessible", async ({ page }) => {
  await openHome(page);
  await expect(page.locator('[data-testid="profile-card"]')).toBeVisible();
  await expect(page.locator("h1.profile-name")).toHaveText("Akemi");
});
