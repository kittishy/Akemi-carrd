const { test, expect } = require("@playwright/test");
const { openHome } = require("./helpers");

test("idle state keeps the card hidden", async ({ page }) => {
  await openHome(page, { nowPlaying: { status: "idle", track: null } });
  await expect(page.locator("#now-playing-card")).toBeHidden();
});

test("playing state shows track, artist and a working Last.fm link", async ({ page }) => {
  await openHome(page, {
    nowPlaying: {
      status: "playing",
      track: {
        name: "Test Track",
        artist: "Test Artist",
        album: "Test Album",
        imageUrl: "",
        lastfmUrl: "https://www.last.fm/music/Test+Artist/_/Test+Track"
      }
    }
  });
  await expect(page.locator("#now-playing-card")).toBeVisible();
  await expect(page.locator("#now-playing-track")).toHaveText("Test Track");
  await expect(page.locator("#now-playing-artist")).toHaveText("Test Artist");
  await expect(page.locator("#now-playing-link")).toHaveAttribute(
    "href",
    "https://www.last.fm/music/Test+Artist/_/Test+Track"
  );
});

test("missing artwork keeps the art image hidden instead of a broken icon", async ({ page }) => {
  await openHome(page, {
    nowPlaying: {
      status: "playing",
      track: { name: "No Art", artist: "Someone", imageUrl: "", lastfmUrl: "https://www.last.fm" }
    }
  });
  await expect(page.locator("#now-playing-art")).toBeHidden();
});

test("a 500 error does not crash the page and leaves the card hidden", async ({ page }) => {
  await page.route("**/api/now-playing", (route) =>
    route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ status: "error", message: "boom" }) })
  );
  await openHome(page);
  await expect(page.locator("#now-playing-card")).toBeHidden();
  await expect(page.locator('[data-testid="profile-card"]')).toBeVisible();
});

test("a 304 response does not touch the already-rendered track", async ({ page }) => {
  let hits = 0;
  await page.route("**/api/now-playing", (route) => {
    hits += 1;
    if (hits === 1) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: { etag: 'W/"abc"' },
        body: JSON.stringify({
          status: "playing",
          track: { name: "First Track", artist: "First Artist", lastfmUrl: "https://www.last.fm/1" }
        })
      });
    }
    return route.fulfill({ status: 304, headers: { etag: 'W/"abc"' }, body: "" });
  });
  await openHome(page, { skipNowPlayingMock: true });
  await expect(page.locator("#now-playing-track")).toHaveText("First Track");

  // Force a second cycle: simulate the poller waking up via a visibility flip.
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, get: () => false });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.waitForTimeout(300);
  await expect(page.locator("#now-playing-track")).toHaveText("First Track");
});

test("empty track name/artist fall back to Unknown copy", async ({ page }) => {
  await openHome(page, {
    nowPlaying: { status: "playing", track: { name: "", artist: "", lastfmUrl: "https://www.last.fm" } }
  });
  await expect(page.locator("#now-playing-track")).toHaveText(/Unknown/);
  await expect(page.locator("#now-playing-artist")).toHaveText(/Unknown/);
});
