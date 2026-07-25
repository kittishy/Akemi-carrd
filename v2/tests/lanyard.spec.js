const { test, expect } = require("@playwright/test");
const { openHome, emitLanyardActivities } = require("./helpers");

test("no activities keeps the list empty and collapsed", async ({ page }) => {
  await openHome(page, { lanyardActivities: [] });
  const list = page.locator("#lanyard-activities");
  await expect(list).toHaveCount(1);
  await expect(list.locator('[data-testid="activity-card"]')).toHaveCount(0);
  // :empty > display:none — a genuinely empty container reports not visible
  await expect(list).toBeHidden();
});

test("renders one card per non-filtered activity", async ({ page }) => {
  await openHome(page, {
    lanyardActivities: [
      { type: 0, name: "Minecraft", details: "Survival mode", state: "In the Nether", application_id: "1" },
      { type: 3, name: "Some Show", details: "Season 2", application_id: "2" }
    ]
  });
  await expect(page.locator('[data-testid="activity-card"]')).toHaveCount(2);
  await expect(page.locator('[data-testid="activity-name"]').first()).toHaveText("Minecraft");
});

test("filters out Spotify (type 2) and Custom Status (type 4)", async ({ page }) => {
  await openHome(page, {
    lanyardActivities: [
      { type: 0, name: "Minecraft", application_id: "1" },
      { type: 2, name: "Spotify listening", application_id: "2" },
      { type: 4, name: "Custom status text", application_id: "3" }
    ]
  });
  await expect(page.locator('[data-testid="activity-card"]')).toHaveCount(1);
  await expect(page.locator('[data-testid="activity-name"]')).toHaveText("Minecraft");
});

test("shows an elapsed timer only when the activity has a start timestamp", async ({ page }) => {
  await openHome(page, {
    lanyardActivities: [
      { type: 0, name: "With timer", application_id: "1", timestamps: { start: Date.now() - 5000 } },
      { type: 0, name: "Without timer", application_id: "2" }
    ]
  });
  const cards = page.locator('[data-testid="activity-card"]');
  await expect(cards).toHaveCount(2);
  await expect(cards.nth(0).locator('[data-testid="activity-elapsed"]')).toHaveText(/\d+:\d+ /);
  await expect(cards.nth(1).locator('[data-testid="activity-elapsed"]')).toHaveCount(0);
});

test("live PRESENCE_UPDATE frames re-render the list", async ({ page }) => {
  await openHome(page, { lanyardActivities: [] });
  await expect(page.locator('[data-testid="activity-card"]')).toHaveCount(0);

  await emitLanyardActivities(page, [{ type: 0, name: "Live Update Game", application_id: "9" }]);
  await expect(page.locator('[data-testid="activity-card"]')).toHaveCount(1);
  await expect(page.locator('[data-testid="activity-name"]')).toHaveText("Live Update Game");
});

test("activity name/details from the API render as literal text, never as markup", async ({ page }) => {
  const payload = '<img src=x onerror="window.__xss=true">';
  await openHome(page, {
    lanyardActivities: [{ type: 0, name: payload, details: payload, application_id: "1" }]
  });

  await expect(page.locator('[data-testid="activity-name"]')).toHaveText(payload);
  await expect(page.locator('[data-testid="activity-details"]')).toHaveText(payload);
  const executed = await page.evaluate(() => window.__xss === true);
  expect(executed).toBe(false);
  // The card legitimately contains one real <img> (the game/app icon) — the
  // payload must not have added another element inside the text nodes.
  await expect(page.locator('[data-testid="activity-name"] img, [data-testid="activity-details"] img')).toHaveCount(0);
});
