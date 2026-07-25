const { test, expect } = require("@playwright/test");
const { openHome } = require("./helpers");

test.beforeEach(async ({ page }) => {
  await openHome(page);
  await page.evaluate(() => localStorage.removeItem("akemi_msg_ratelimit"));
});

test("message button opens the panel and moves focus to the first field", async ({ page }) => {
  await expect(page.locator("#message-panel")).toBeHidden();
  await page.click("#message-button");
  await expect(page.locator("#message-panel")).toBeVisible();
  await expect(page.locator("#message-button")).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator("#message-name")).toBeFocused();
});

test("Escape closes the panel and returns focus to the button", async ({ page }) => {
  await page.click("#message-button");
  await expect(page.locator("#message-panel")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("#message-panel")).toBeHidden();
  await expect(page.locator("#message-button")).toBeFocused();
});

test("_next is bound to the current origin, not a hardcoded domain", async ({ page }) => {
  await page.click("#message-button");
  const next = await page.locator("#message-next").getAttribute("value");
  expect(next.startsWith(new URL(page.url()).origin)).toBe(true);
  expect(next).toContain("/success.html");
});

test("invalid email blocks submission", async ({ page }) => {
  await page.click("#message-button");
  await page.fill("#message-name", "Test User");
  await page.fill("#message-email", "not-an-email");
  await page.fill("#message-text", "hello, just checking the form");
  await page.click("#submit-btn");
  await page.waitForTimeout(150);
  expect(page.url()).toContain("index.html");
});

test("honeypot fill silently redirects to success.html without submitting for real", async ({ page }) => {
  await page.click("#message-button");
  await page.fill("#message-name", "Bot");
  await page.fill("#message-email", "bot@example.com");
  await page.fill("#message-text", "spam");
  await page.evaluate(() => {
    document.getElementById("message-website").value = "http://spambot.example";
  });
  await Promise.all([page.waitForURL("**/success.html*"), page.click("#submit-btn")]);
  expect(page.url()).toContain("success.html");
});

test("spam patterns in the message body are blocked with an error", async ({ page }) => {
  await page.click("#message-button");
  await page.fill("#message-name", "Test User");
  await page.fill("#message-email", "test@example.com");
  await page.fill("#message-text", "aaaaaaaaaa check this out");
  await page.click("#submit-btn");
  await page.waitForTimeout(150);
  await expect(page.locator("#message-error")).not.toBeEmpty();
  expect(page.url()).toContain("index.html");
});

test("third submission within the window is rate-limited", async ({ page }) => {
  await page.evaluate(() => {
    localStorage.setItem(
      "akemi_msg_ratelimit",
      JSON.stringify({ attempts: 3, windowStart: Date.now(), blockedUntil: Date.now() + 60000 })
    );
  });
  await page.click("#message-button");
  await page.fill("#message-name", "Test User");
  await page.fill("#message-email", "test@example.com");
  await page.fill("#message-text", "hello there");
  await page.click("#submit-btn");
  await page.waitForTimeout(150);
  await expect(page.locator("#message-error")).not.toBeEmpty();
  await expect(page.locator("#submit-btn")).toBeDisabled();
});
