const { test, expect } = require("@playwright/test");

const viewports = [
  { width: 390, height: 844 },
  { width: 600, height: 900 },
  { width: 767, height: 1024 },
  { width: 768, height: 1024 },
  { width: 1366, height: 768 }
];

const openHome = async (page) => {
  await page.route("**/api/now-playing", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        status: "idle"
      })
    });
  });

  await page.goto("/site/index.html", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#home-section")).toBeVisible();
};

for (const viewport of viewports) {
  test(`no horizontal overflow at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await openHome(page);

    const dimensions = await page.evaluate(() => ({
      client: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth
    }));

    expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.client + 1);
  });
}

test("message/about toggle behavior stays stable", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await openHome(page);

  const messageButton = page.locator("#message-button");
  const aboutButton = page.locator("#about-button");
  const messageContainer = page.locator("#container10");
  const aboutContainer = page.locator("#container11");

  await messageButton.click();
  await expect(messageContainer).toBeVisible();

  await aboutButton.click();
  await expect(aboutContainer).toBeVisible();
  await expect(messageContainer).toBeHidden();

  await page.keyboard.press("Escape");
  await expect(aboutContainer).toBeHidden();
});
