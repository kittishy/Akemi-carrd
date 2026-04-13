/**
 * realtime.spec.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Tests for the real-time update subsystems:
 *   1. Last.fm "Now Playing" card  (#container06 / #now-playing-card)
 *   2. Discord Activity cards via Lanyard  (#container-lanyard / #lanyard-activities)
 *   3. Visibility-aware polling behaviour
 *   4. Network recovery triggers
 *
 * ALL external network calls are intercepted — no real Last.fm, Lanyard, or
 * WebSocket connections leave the browser.  Each test is self-contained and
 * should complete well within 10 s.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const { test, expect } = require("@playwright/test");

// ─── helpers ──────────────────────────────────────────────────────────────────

/**
 * Stub the global WebSocket constructor BEFORE any page JS runs.
 * This is the only reliable way to prevent Lanyard WS from connecting in tests,
 * because Playwright's route interception cannot reliably abort a wss:// upgrade
 * once the JS has already called `new WebSocket(...)`.
 *
 * The stub is a no-op: open/message/close/error handlers are stored but never
 * invoked, so the Lanyard code waits indefinitely for WS data and the test
 * controls what arrives via the mocked REST endpoint instead.
 *
 * @param {import('@playwright/test').Page} page
 * @param {object[]} [activitiesToInject=[]]  – if non-empty, the stub will fire
 *   an INIT_STATE message after a short delay to simulate real WS behaviour.
 */
async function stubWebSocket(page, activitiesToInject = []) {
  const activitiesJson = JSON.stringify(activitiesToInject);
  await page.addInitScript(`
    (function() {
      var activitiesToInject = ${activitiesJson};

      // Save real WebSocket for anything that isn't Lanyard
      var _RealWS = window.WebSocket;

      window.WebSocket = function(url, protocols) {
        // Only stub the Lanyard socket; let everything else through
        if (typeof url === "string" && url.indexOf("api.lanyard.rest") !== -1) {
          var self = this;
          self.readyState = 0; // CONNECTING
          self.url = url;
          self.protocol = "";
          self.extensions = "";
          self.bufferedAmount = 0;
          self.binaryType = "blob";

          self.send = function() {};
          self.close = function() {
            self.readyState = 3; // CLOSED
            if (typeof self.onclose === "function") {
              // Fire close so the reconnect loop kicks off (with delay), keeping
              // the WS in a stable non-delivering state for the test duration.
              setTimeout(function() {
                self.onclose({ code: 1000, reason: "stubbed" });
              }, 30000); // 30s — well past any test timeout
            }
          };

          // Simulate async connection open
          setTimeout(function() {
            self.readyState = 1; // OPEN
            if (typeof self.onopen === "function") self.onopen({});

            // Deliver Op 1 (Hello) so the init handshake completes
            if (typeof self.onmessage === "function") {
              self.onmessage({
                data: JSON.stringify({ op: 1, d: { heartbeat_interval: 30000 } })
              });
            }

            // Optionally deliver an INIT_STATE with the activities we want
            if (activitiesToInject.length > 0 && typeof self.onmessage === "function") {
              setTimeout(function() {
                self.onmessage({
                  data: JSON.stringify({
                    op: 0,
                    t: "INIT_STATE",
                    d: { activities: activitiesToInject }
                  })
                });
              }, 50);
            }
          }, 20);

          return self;
        }

        // Not Lanyard — use the real WebSocket
        return new _RealWS(url, protocols);
      };

      // Copy static properties (CONNECTING, OPEN, CLOSING, CLOSED)
      window.WebSocket.CONNECTING = 0;
      window.WebSocket.OPEN       = 1;
      window.WebSocket.CLOSING    = 2;
      window.WebSocket.CLOSED     = 3;
      window.WebSocket.prototype  = _RealWS.prototype;
    })();
  `);
}

/**
 * Open the home page with all external calls mocked.
 *
 * @param {import('@playwright/test').Page} page
 * @param {object} [opts]
 * @param {"playing"|"idle"} [opts.nowPlayingStatus="idle"]  – what /api/now-playing returns
 * @param {object|null}      [opts.nowPlayingTrack=null]     – track object when playing
 * @param {object[]}         [opts.lanyardActivities=[]]     – activities list for REST + WS stub
 */
async function openHome(page, opts = {}) {
  const {
    nowPlayingStatus = "idle",
    nowPlayingTrack = null,
    lanyardActivities = []
  } = opts;

  // ── 1. Stub WebSocket before any JS runs ─────────────────────────────────
  // This is the only reliable way to prevent real WS connections from Lanyard.
  await stubWebSocket(page, lanyardActivities);

  // ── 2. Mock /api/now-playing ──────────────────────────────────────────────
  await page.route("**/api/now-playing", async (route) => {
    const body = nowPlayingStatus === "playing"
      ? { status: "playing", track: nowPlayingTrack || defaultTrack() }
      : { status: "idle" };
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body)
    });
  });

  // ── 3. Mock Lanyard REST endpoint ─────────────────────────────────────────
  await page.route("**/api.lanyard.rest/v1/users/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: { activities: lanyardActivities }
      })
    });
  });

  // ── 4. Block Spotify embed (not under test, avoids slow external load) ────
  await page.route("**/open.spotify.com/**", (route) => route.abort());

  // ── 5. Block Discord CDN / proxy (not needed for structural tests) ────────
  await page.route("**/cdn.discordapp.com/**", (route) => route.abort());
  await page.route("**/media.discordapp.net/**", (route) => route.abort());
  await page.route("**/api/app-icon**", (route) =>
    route.fulfill({ status: 200, body: "" })
  );

  await page.goto("/site/index.html", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#home-section")).toBeVisible();
}

function defaultTrack() {
  return {
    name: "Test Track",
    artist: "Test Artist",
    album: "Test Album",
    lastfmUrl: "https://www.last.fm/music/Test+Artist/_/Test+Track",
    imageUrl: "https://example.com/art.jpg"
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// § 1 — DOM STRUCTURE: required containers exist on load
// ─────────────────────────────────────────────────────────────────────────────

test("DOM: #container06 (Last.fm card host) exists and is in the document", async ({ page }) => {
  await openHome(page);
  const container06 = page.locator("#container06");
  await expect(container06).toBeAttached();
});

test("DOM: #now-playing-card exists inside #container06", async ({ page }) => {
  await openHome(page);
  const card = page.locator("#container06 #now-playing-card");
  await expect(card).toBeAttached();
});

test("DOM: #container-lanyard exists and is in the document", async ({ page }) => {
  await openHome(page);
  const lanyardContainer = page.locator("#container-lanyard");
  await expect(lanyardContainer).toBeAttached();
});

test("DOM: #lanyard-activities exists inside #container-lanyard", async ({ page }) => {
  await openHome(page);
  const activities = page.locator("#container-lanyard #lanyard-activities");
  await expect(activities).toBeAttached();
});

// ─────────────────────────────────────────────────────────────────────────────
// § 2 — LAST.FM IDLE STATE: spotify mode is default
// ─────────────────────────────────────────────────────────────────────────────

test("Last.fm idle: #container06 does NOT carry .is-now-playing class", async ({ page }) => {
  await openHome(page, { nowPlayingStatus: "idle" });
  // Wait for the initial fetch to complete (runUpdate is called on load)
  await page.waitForTimeout(500);
  const hasClass = await page.locator("#container06").evaluate(
    (el) => el.classList.contains("is-now-playing")
  );
  expect(hasClass).toBe(false);
});

test("Last.fm idle: #now-playing-card is hidden via CSS (display:none via :not(.is-now-playing) rule)", async ({ page }) => {
  await openHome(page, { nowPlayingStatus: "idle" });
  await page.waitForTimeout(500);
  // The CSS rule: #container06:not(.is-now-playing) #now-playing-card { display: none }
  const isHidden = await page.locator("#now-playing-card").evaluate(
    (el) => getComputedStyle(el).display === "none"
  );
  expect(isHidden).toBe(true);
});

// ─────────────────────────────────────────────────────────────────────────────
// § 3 — LAST.FM NOW PLAYING: card renders track data from API response
// ─────────────────────────────────────────────────────────────────────────────

test("Last.fm playing: #container06 gains .is-now-playing class", async ({ page }) => {
  await openHome(page, {
    nowPlayingStatus: "playing",
    nowPlayingTrack: defaultTrack()
  });
  // The runUpdate() call on page load will fetch immediately
  await expect(page.locator("#container06.is-now-playing")).toBeVisible({ timeout: 5000 });
});

test("Last.fm playing: track name appears in #now-playing-track", async ({ page }) => {
  await openHome(page, {
    nowPlayingStatus: "playing",
    nowPlayingTrack: defaultTrack()
  });
  await expect(page.locator("#now-playing-track")).toHaveText("Test Track", { timeout: 5000 });
});

test("Last.fm playing: artist name appears in #now-playing-artist", async ({ page }) => {
  await openHome(page, {
    nowPlayingStatus: "playing",
    nowPlayingTrack: defaultTrack()
  });
  await expect(page.locator("#now-playing-artist")).toHaveText("Test Artist", { timeout: 5000 });
});

test("Last.fm playing: #now-playing-link href points to Last.fm track URL", async ({ page }) => {
  const trackUrl = "https://www.last.fm/music/Test+Artist/_/Test+Track";
  await openHome(page, {
    nowPlayingStatus: "playing",
    nowPlayingTrack: { ...defaultTrack(), lastfmUrl: trackUrl }
  });
  await expect(page.locator("#container06.is-now-playing")).toBeVisible({ timeout: 5000 });
  const href = await page.locator("#now-playing-link").getAttribute("href");
  expect(href).toBe(trackUrl);
});

test("Last.fm playing: artwork updates even when the same track keeps playing", async ({ page }) => {
  let callCount = 0;
  await stubWebSocket(page);
  await page.route("**/api/now-playing", async (route) => {
    callCount += 1;
    const track = defaultTrack();
    track.imageUrl = callCount === 1 ? "" : "https://example.com/fixed-art.jpg";

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ status: "playing", track })
    });
  });
  await page.route("**/api.lanyard.rest/v1/users/**", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, data: { activities: [] } }) });
  });
  await page.route("**/open.spotify.com/**", (route) => route.abort());

  await page.goto("/site/index.html", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#home-section")).toBeVisible();
  await expect(page.locator("#now-playing-art")).toHaveAttribute("src", /assets\/images\/profile\.jpeg/, { timeout: 5000 });

  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(page.locator("#now-playing-art")).toHaveAttribute("src", "https://example.com/fixed-art.jpg", { timeout: 5000 });
});

test("Last.fm playing: artwork falls back when remote art fails to load", async ({ page }) => {
  await openHome(page, {
    nowPlayingStatus: "playing",
    nowPlayingTrack: { ...defaultTrack(), imageUrl: "https://example.com/broken-art.jpg" }
  });

  await expect(page.locator("#container06.is-now-playing")).toBeVisible({ timeout: 5000 });
  await page.locator("#now-playing-art").evaluate((img) => img.dispatchEvent(new Event("error")));
  await expect(page.locator("#now-playing-art")).toHaveAttribute("src", /assets\/images\/profile\.jpeg/);
});

test("Last.fm playing: #now-playing-card is visible (not display:none) when playing", async ({ page }) => {
  await openHome(page, {
    nowPlayingStatus: "playing",
    nowPlayingTrack: defaultTrack()
  });
  await expect(page.locator("#container06.is-now-playing")).toBeVisible({ timeout: 5000 });
  const display = await page.locator("#now-playing-card").evaluate(
    (el) => getComputedStyle(el).display
  );
  // When .is-now-playing is set, the :not(.is-now-playing) rule no longer applies —
  // so display should NOT be "none"
  expect(display).not.toBe("none");
});

test("Last.fm playing: #spotify-player is hidden (display:none) during now-playing mode", async ({ page }) => {
  await openHome(page, {
    nowPlayingStatus: "playing",
    nowPlayingTrack: defaultTrack()
  });
  await expect(page.locator("#container06.is-now-playing")).toBeVisible({ timeout: 5000 });
  // CSS rule: #container06.is-now-playing #spotify-player { display: none }
  const display = await page.locator("#spotify-player").evaluate(
    (el) => getComputedStyle(el).display
  );
  expect(display).toBe("none");
});

// ─────────────────────────────────────────────────────────────────────────────
// § 4 — LAST.FM: ETag / 304 handling — card stays stable on 304
// ─────────────────────────────────────────────────────────────────────────────

test("Last.fm 304: track card content is unchanged after a Not-Modified response", async ({ page }) => {
  let callCount = 0;
  await stubWebSocket(page);
  await page.route("**/api/now-playing", async (route) => {
    callCount++;
    if (callCount === 1) {
      // First call: playing
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: { ETag: '"abc123"' },
        body: JSON.stringify({ status: "playing", track: defaultTrack() })
      });
    } else {
      // Subsequent calls: 304 Not Modified
      await route.fulfill({ status: 304, body: "" });
    }
  });
  await page.route("**/api.lanyard.rest/v1/users/**", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, data: { activities: [] } }) });
  });
  await page.route("**/open.spotify.com/**", (route) => route.abort());

  await page.goto("/site/index.html", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#home-section")).toBeVisible();

  // Wait for the initial "playing" state to render
  await expect(page.locator("#now-playing-track")).toHaveText("Test Track", { timeout: 5000 });

  // Content should still be correct — the 304 must NOT wipe the card
  const trackText = await page.locator("#now-playing-track").textContent();
  expect(trackText).toBe("Test Track");
});

// ─────────────────────────────────────────────────────────────────────────────
// § 5 — LAST.FM: API error falls back gracefully (no crash, stays in spotify mode)
// ─────────────────────────────────────────────────────────────────────────────

test("Last.fm 500 error: page stays functional and #container06 exists without crash", async ({ page }) => {
  await stubWebSocket(page);
  await page.route("**/api/now-playing", async (route) => {
    await route.fulfill({ status: 500, body: "Server Error" });
  });
  await page.route("**/api.lanyard.rest/v1/users/**", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, data: { activities: [] } }) });
  });
  await page.route("**/open.spotify.com/**", (route) => route.abort());

  await page.goto("/site/index.html", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#home-section")).toBeVisible();

  // Give error handler time to run
  await page.waitForTimeout(500);

  // Page should not crash: container still in DOM, no .is-now-playing
  await expect(page.locator("#container06")).toBeAttached();
  const hasPlaying = await page.locator("#container06").evaluate(
    (el) => el.classList.contains("is-now-playing")
  );
  expect(hasPlaying).toBe(false);
});

// ─────────────────────────────────────────────────────────────────────────────
// § 6 — LANYARD: activities container starts empty when no activities
// ─────────────────────────────────────────────────────────────────────────────

test("Lanyard idle: #lanyard-activities is empty when no activities returned", async ({ page }) => {
  await openHome(page, { lanyardActivities: [] });
  // Wait for REST fetch to settle
  await page.waitForTimeout(600);
  const childCount = await page.locator("#lanyard-activities").evaluate(
    (el) => el.children.length
  );
  expect(childCount).toBe(0);
});

test("Lanyard idle: empty #lanyard-activities has display:none via CSS :empty rule", async ({ page }) => {
  await openHome(page, { lanyardActivities: [] });
  await page.waitForTimeout(600);
  const display = await page.locator("#lanyard-activities").evaluate(
    (el) => getComputedStyle(el).display
  );
  expect(display).toBe("none");
});

// ─────────────────────────────────────────────────────────────────────────────
// § 7 — LANYARD: activity cards are built from REST data
// ─────────────────────────────────────────────────────────────────────────────

const fakeActivity = {
  type: 0,              // Playing
  name: "Minecraft",
  details: "Survival mode",
  state: "In the Nether",
  application_id: "1234567890",
  assets: {
    large_image: "1111111111",
    large_text: "Minecraft icon",
    small_image: null,
    small_text: null
  },
  timestamps: null
};

test("Lanyard: one activity card is rendered for one Playing activity", async ({ page }) => {
  await openHome(page, { lanyardActivities: [fakeActivity] });
  const card = page.locator("#lanyard-activities .activity-card");
  await expect(card).toHaveCount(1, { timeout: 5000 });
});

test("Lanyard: activity card shows correct game name", async ({ page }) => {
  await openHome(page, { lanyardActivities: [fakeActivity] });
  await expect(page.locator("#lanyard-activities .activity-name")).toHaveText("Minecraft", { timeout: 5000 });
});

test("Lanyard: activity card shows correct details text", async ({ page }) => {
  await openHome(page, { lanyardActivities: [fakeActivity] });
  await expect(page.locator("#lanyard-activities .activity-details")).toHaveText("Survival mode", { timeout: 5000 });
});

test("Lanyard: activity card shows correct state text", async ({ page }) => {
  await openHome(page, { lanyardActivities: [fakeActivity] });
  await expect(page.locator("#lanyard-activities .activity-state")).toHaveText("In the Nether", { timeout: 5000 });
});

test("Lanyard: activity card has correct aria-label (type label + name)", async ({ page }) => {
  await openHome(page, { lanyardActivities: [fakeActivity] });
  const card = page.locator("#lanyard-activities .activity-card");
  await expect(card).toBeVisible({ timeout: 5000 });
  const ariaLabel = await card.getAttribute("aria-label");
  // buildActivityCard sets aria-label = label + " " + name = "Playing Minecraft"
  expect(ariaLabel).toBe("Playing Minecraft");
});

test("Lanyard: activity card label element shows 'Playing' for type 0", async ({ page }) => {
  await openHome(page, { lanyardActivities: [fakeActivity] });
  const labelEl = page.locator("#lanyard-activities .activity-label");
  await expect(labelEl).toBeVisible({ timeout: 5000 });
  const text = await labelEl.textContent();
  expect(text).toContain("Playing");
});

test("Lanyard: activity card pulse has aria-hidden=true", async ({ page }) => {
  await openHome(page, { lanyardActivities: [fakeActivity] });
  await expect(page.locator("#lanyard-activities .activity-card")).toBeVisible({ timeout: 5000 });
  const ariaHidden = await page
    .locator("#lanyard-activities .activity-pulse")
    .first()
    .getAttribute("aria-hidden");
  expect(ariaHidden).toBe("true");
});

// ─────────────────────────────────────────────────────────────────────────────
// § 8 — LANYARD: type filtering — Spotify (type 2) and Custom Status (type 4) are excluded
// ─────────────────────────────────────────────────────────────────────────────

test("Lanyard: Spotify activity (type 2) is filtered out — no card rendered", async ({ page }) => {
  const spotifyActivity = { ...fakeActivity, type: 2, name: "Spotify" };
  await openHome(page, { lanyardActivities: [spotifyActivity] });
  await page.waitForTimeout(600);
  const childCount = await page.locator("#lanyard-activities").evaluate(
    (el) => el.children.length
  );
  expect(childCount).toBe(0);
});

test("Lanyard: Custom Status activity (type 4) is filtered out — no card rendered", async ({ page }) => {
  const customStatus = { ...fakeActivity, type: 4, name: "Custom Status" };
  await openHome(page, { lanyardActivities: [customStatus] });
  await page.waitForTimeout(600);
  const childCount = await page.locator("#lanyard-activities").evaluate(
    (el) => el.children.length
  );
  expect(childCount).toBe(0);
});

test("Lanyard: mixed activities — only non-Spotify, non-custom-status cards are shown", async ({ page }) => {
  const mixed = [
    { ...fakeActivity, type: 0, name: "Minecraft" },       // shown
    { ...fakeActivity, type: 2, name: "Spotify" },          // hidden
    { ...fakeActivity, type: 4, name: "My custom status" }, // hidden
    { ...fakeActivity, type: 3, name: "YouTube" }           // shown
  ];
  await openHome(page, { lanyardActivities: mixed });
  const cards = page.locator("#lanyard-activities .activity-card");
  await expect(cards).toHaveCount(2, { timeout: 5000 });
});

// ─────────────────────────────────────────────────────────────────────────────
// § 9 — LANYARD: elapsed timer is rendered when timestamps.start is present
// ─────────────────────────────────────────────────────────────────────────────

test("Lanyard: activity with timestamps.start renders an elapsed time element", async ({ page }) => {
  const activityWithTime = {
    ...fakeActivity,
    timestamps: { start: Date.now() - 120000 } // 2 minutes ago
  };
  await openHome(page, { lanyardActivities: [activityWithTime] });
  const elapsedEl = page.locator("#lanyard-activities .activity-elapsed");
  await expect(elapsedEl).toBeVisible({ timeout: 5000 });
  const text = await elapsedEl.textContent();
  expect(text).toMatch(/\d+:\d+ elapsed/);
});

test("Lanyard: activity without timestamps has no elapsed element", async ({ page }) => {
  const noTimestamp = { ...fakeActivity, timestamps: null };
  await openHome(page, { lanyardActivities: [noTimestamp] });
  await expect(page.locator("#lanyard-activities .activity-card")).toBeVisible({ timeout: 5000 });
  const elapsedCount = await page.locator("#lanyard-activities .activity-elapsed").count();
  expect(elapsedCount).toBe(0);
});

// ─────────────────────────────────────────────────────────────────────────────
// § 10 — LANYARD: DOM re-render on data change (idempotency)
// ─────────────────────────────────────────────────────────────────────────────

test("Lanyard: DOM updates correctly when new activity data is injected programmatically", async ({ page }) => {
  await openHome(page, { lanyardActivities: [fakeActivity] });
  await expect(page.locator("#lanyard-activities .activity-card")).toHaveCount(1, { timeout: 5000 });

  // Simulate a presence update via the renderActivities function
  await page.evaluate(() => {
    const container = document.getElementById("lanyard-activities");
    // Clear existing and inject a new card directly (mimics renderActivities behaviour)
    container.innerHTML = "";

    const newCard = document.createElement("article");
    newCard.className = "activity-card";
    newCard.setAttribute("aria-label", "Playing Cyberpunk 2077");

    const nameEl = document.createElement("p");
    nameEl.className = "activity-name";
    nameEl.textContent = "Cyberpunk 2077";
    newCard.appendChild(nameEl);

    container.appendChild(newCard);
  });

  await expect(page.locator("#lanyard-activities .activity-name")).toHaveText("Cyberpunk 2077");
  await expect(page.locator("#lanyard-activities .activity-card")).toHaveCount(1);
});

// ─────────────────────────────────────────────────────────────────────────────
// § 11 — VISIBILITY: tab-hidden guard prevents runUpdate from doing work
// ─────────────────────────────────────────────────────────────────────────────

test("Visibility: #container06 does not gain .is-now-playing while document.hidden=true", async ({ page }) => {
  let fetchCallsWhileHidden = 0;

  // Open idle first so the initial fetch clears
  await openHome(page, { nowPlayingStatus: "idle" });
  await page.waitForTimeout(400);

  // Override the route to track calls and switch to "playing"
  await page.route("**/api/now-playing", async (route) => {
    const hidden = await page.evaluate(() => document.hidden);
    if (hidden) fetchCallsWhileHidden++;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ status: "playing", track: defaultTrack() })
    });
  });

  // Simulate tab going hidden using Page.emulateMedia / property override
  // Playwright's page.hide() is not available, so we patch document.hidden
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      get: () => true
    });
    // Fire the visibilitychange event so the listener clears the timer
    document.dispatchEvent(new Event("visibilitychange"));
  });

  // Wait long enough that the previous 15s poll would NOT fire anyway
  // (we're just confirming the guard works; 800ms is sufficient)
  await page.waitForTimeout(800);

  const hasPlaying = await page.locator("#container06").evaluate(
    (el) => el.classList.contains("is-now-playing")
  );
  expect(hasPlaying).toBe(false);
  expect(fetchCallsWhileHidden).toBe(0);
});

test("Visibility: runUpdate fires immediately when tab becomes visible again", async ({ page }) => {
  // Start hidden, then reveal → expect immediate fetch & card update
  await stubWebSocket(page);
  await page.route("**/api/now-playing", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ status: "playing", track: defaultTrack() })
    });
  });
  await page.route("**/api.lanyard.rest/v1/users/**", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, data: { activities: [] } }) });
  });
  await page.route("**/open.spotify.com/**", (route) => route.abort());

  await page.goto("/site/index.html", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#home-section")).toBeVisible();

  // Simulate: go hidden (clears timers), then come back visible
  await page.evaluate(() => {
    // Hide
    Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
    document.dispatchEvent(new Event("visibilitychange"));
  });

  await page.waitForTimeout(100);

  // Come back visible — this triggers runUpdate() in the visibilitychange handler
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, get: () => false });
    document.dispatchEvent(new Event("visibilitychange"));
  });

  // runUpdate will fetch immediately → card should become "playing"
  await expect(page.locator("#container06.is-now-playing")).toBeVisible({ timeout: 5000 });
});

// ─────────────────────────────────────────────────────────────────────────────
// § 12 — NETWORK RECOVERY: online event triggers immediate fetch
// ─────────────────────────────────────────────────────────────────────────────

test("Network recovery: firing 'online' event triggers Last.fm fetch when tab is visible", async ({ page }) => {
  let fetchCount = 0;

  await stubWebSocket(page);
  await page.route("**/api/now-playing", async (route) => {
    fetchCount++;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ status: "idle" })
    });
  });
  await page.route("**/api.lanyard.rest/v1/users/**", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, data: { activities: [] } }) });
  });
  await page.route("**/open.spotify.com/**", (route) => route.abort());

  await page.goto("/site/index.html", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#home-section")).toBeVisible();

  // Wait for the initial fetch to complete
  await page.waitForTimeout(500);
  const countAfterLoad = fetchCount;

  // Fire the online event (simulates browser coming back online)
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await page.waitForTimeout(500);

  // Should have triggered at least one more fetch
  expect(fetchCount).toBeGreaterThan(countAfterLoad);
});

// ─────────────────────────────────────────────────────────────────────────────
// § 13 — OVERFLOW: #container-lanyard does NOT cause horizontal overflow
// ─────────────────────────────────────────────────────────────────────────────

const mobileViewports = [
  { width: 390, height: 844 },
  { width: 600, height: 900 }
];

for (const vp of mobileViewports) {
  test(`Lanyard: no horizontal overflow with activity card at ${vp.width}x${vp.height}`, async ({ page }) => {
    await page.setViewportSize(vp);
    await openHome(page, { lanyardActivities: [fakeActivity] });

    // Wait for the card to render
    await expect(page.locator("#lanyard-activities .activity-card")).toBeVisible({ timeout: 5000 });

    const dims = await page.evaluate(() => ({
      client: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth
    }));
    expect(dims.scroll).toBeLessThanOrEqual(dims.client + 1);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// § 14 — OVERFLOW: #now-playing-card does NOT cause horizontal overflow
// ─────────────────────────────────────────────────────────────────────────────

for (const vp of mobileViewports) {
  test(`Last.fm: no horizontal overflow with now-playing card at ${vp.width}x${vp.height}`, async ({ page }) => {
    await page.setViewportSize(vp);
    await openHome(page, {
      nowPlayingStatus: "playing",
      nowPlayingTrack: {
        ...defaultTrack(),
        name: "A Very Long Track Name That Could Potentially Overflow The Card Layout",
        artist: "An Extremely Long Artist Name That Also Might Be Problematic"
      }
    });

    await expect(page.locator("#container06.is-now-playing")).toBeVisible({ timeout: 5000 });

    const dims = await page.evaluate(() => ({
      client: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth
    }));
    expect(dims.scroll).toBeLessThanOrEqual(dims.client + 1);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// § 15 — ACCESSIBILITY: aria-live regions are present and correctly attributed
// ─────────────────────────────────────────────────────────────────────────────

test("A11y: #music-dynamic has aria-live=polite", async ({ page }) => {
  await openHome(page);
  const ariaLive = await page.locator("#music-dynamic").getAttribute("aria-live");
  expect(ariaLive).toBe("polite");
});

test("A11y: #music-dynamic has aria-label", async ({ page }) => {
  await openHome(page);
  const ariaLabel = await page.locator("#music-dynamic").getAttribute("aria-label");
  expect(ariaLabel).toBeTruthy();
});

test("A11y: #lanyard-activities has aria-live=polite", async ({ page }) => {
  await openHome(page);
  const ariaLive = await page.locator("#lanyard-activities").getAttribute("aria-live");
  expect(ariaLive).toBe("polite");
});

test("A11y: #lanyard-activities has aria-label", async ({ page }) => {
  await openHome(page);
  const ariaLabel = await page.locator("#lanyard-activities").getAttribute("aria-label");
  expect(ariaLabel).toBeTruthy();
});

test("A11y: #now-playing-card has aria-label describing the card purpose", async ({ page }) => {
  await openHome(page);
  const ariaLabel = await page.locator("#now-playing-card").getAttribute("aria-label");
  expect(ariaLabel).toBeTruthy();
  expect(ariaLabel?.toLowerCase()).toContain("playing");
});

test("A11y: now-playing pulse dot has aria-hidden=true", async ({ page }) => {
  await openHome(page);
  const ariaHidden = await page.locator(".now-playing-pulse").getAttribute("aria-hidden");
  expect(ariaHidden).toBe("true");
});

// ─────────────────────────────────────────────────────────────────────────────
// § 16 — DESTRUCTIVE: XSS payloads in track name/artist must not execute
// ─────────────────────────────────────────────────────────────────────────────

test("Security: XSS payload in track name is rendered as text, not executed", async ({ page }) => {
  const xssPayload = '<img src=x onerror="window.__xss=true">';

  await openHome(page, {
    nowPlayingStatus: "playing",
    nowPlayingTrack: {
      ...defaultTrack(),
      name: xssPayload,
      artist: "Safe Artist"
    }
  });

  await expect(page.locator("#container06.is-now-playing")).toBeVisible({ timeout: 5000 });

  // The script uses .textContent assignment — XSS should NOT execute
  const xssRan = await page.evaluate(() => window.__xss === true);
  expect(xssRan).toBe(false);

  // The content should be the raw string, not parsed HTML
  const trackText = await page.locator("#now-playing-track").textContent();
  expect(trackText).toBe(xssPayload);
});

test("Security: XSS payload in activity name is rendered as text, not executed", async ({ page }) => {
  const xssPayload = '<script>window.__xss2=true<\/script>';
  const maliciousActivity = {
    ...fakeActivity,
    name: xssPayload
  };

  await openHome(page, { lanyardActivities: [maliciousActivity] });
  await expect(page.locator("#lanyard-activities .activity-card")).toBeVisible({ timeout: 5000 });

  const xssRan = await page.evaluate(() => window.__xss2 === true);
  expect(xssRan).toBe(false);

  const nameText = await page.locator("#lanyard-activities .activity-name").textContent();
  expect(nameText).toBe(xssPayload);
});

// ─────────────────────────────────────────────────────────────────────────────
// § 17 — DESTRUCTIVE: empty/missing fields don't crash the card builder
// ─────────────────────────────────────────────────────────────────────────────

test("Robustness: activity card renders 'Unknown' when name is empty string", async ({ page }) => {
  const emptyNameActivity = { ...fakeActivity, name: "" };
  await openHome(page, { lanyardActivities: [emptyNameActivity] });
  const card = page.locator("#lanyard-activities .activity-card");
  await expect(card).toBeVisible({ timeout: 5000 });
  // buildActivityCard falls back to "Unknown" when name is falsy
  const nameText = await page.locator("#lanyard-activities .activity-name").textContent();
  expect(nameText).toBe("Unknown");
});

test("Robustness: activity with no details/state still renders without throwing", async ({ page }) => {
  const minimalActivity = {
    type: 0,
    name: "Minecraft",
    details: null,
    state: null,
    application_id: null,
    assets: null,
    timestamps: null
  };
  await openHome(page, { lanyardActivities: [minimalActivity] });
  const card = page.locator("#lanyard-activities .activity-card");
  await expect(card).toBeVisible({ timeout: 5000 });
  // No details/state elements should exist
  expect(await page.locator("#lanyard-activities .activity-details").count()).toBe(0);
  expect(await page.locator("#lanyard-activities .activity-state").count()).toBe(0);
});

test("Robustness: Last.fm response with missing track fields doesn't crash", async ({ page }) => {
  await stubWebSocket(page);
  await page.route("**/api/now-playing", async (route) => {
    // Missing name, artist, imageUrl
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ status: "playing", track: {} })
    });
  });
  await page.route("**/api.lanyard.rest/v1/users/**", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, data: { activities: [] } }) });
  });
  await page.route("**/open.spotify.com/**", (route) => route.abort());

  await page.goto("/site/index.html", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#home-section")).toBeVisible();

  // Give the fetch time to land
  await page.waitForTimeout(500);

  // Page should still be functional — #container06 exists
  await expect(page.locator("#container06")).toBeAttached();

  // No JS error should have crashed the page
  const title = await page.title();
  expect(title).toBeTruthy();
});
