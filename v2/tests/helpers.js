/*
  Shared test helpers. Route mocking + a WebSocket stub for Lanyard, so no
  spec ever depends on a real network call to Last.fm or Discord.
*/

const STUB_WEBSOCKET_SCRIPT = `
  (() => {
    window.__lanyardMessages = [];
    class StubWebSocket {
      constructor(url) {
        this.url = url;
        this.readyState = 0;
        window.__lastLanyardSocket = this;
        if (url.indexOf("api.lanyard.rest") === -1) {
          return;
        }
        setTimeout(() => {
          this.readyState = 1;
          this.onopen && this.onopen();
          this.onmessage && this.onmessage({
            data: JSON.stringify({ op: 1, d: { heartbeat_interval: 30000 } })
          });
        }, 10);
      }
      send(data) {
        window.__lanyardMessages.push(data);
      }
      close() {
        this.readyState = 3;
        this.onclose && this.onclose();
      }
      emit(payload) {
        this.onmessage && this.onmessage({ data: JSON.stringify(payload) });
      }
    }
    window.WebSocket = StubWebSocket;
  })();
`;

/**
 * Navigate to the app with now-playing and lanyard REST/WS fully mocked.
 * @param {import('@playwright/test').Page} page
 * @param {object} [options]
 * @param {object} [options.nowPlaying] - body for /api/now-playing (default idle)
 * @param {Array}  [options.lanyardActivities] - initial REST activities (default [])
 * @param {boolean} [options.skipNowPlayingMock] - let the caller register its
 *   own /api/now-playing route (e.g. to test ETag/304 sequencing); the last
 *   route registered before goto() is the one Playwright actually uses.
 */
async function openHome(page, options = {}) {
  const nowPlaying = options.nowPlaying || { status: "idle", track: null };
  const lanyardActivities = options.lanyardActivities || [];

  await page.addInitScript(STUB_WEBSOCKET_SCRIPT);

  if (!options.skipNowPlayingMock) {
    await page.route("**/api/now-playing", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(nowPlaying) })
    );
  }
  await page.route("**/api.lanyard.rest/v1/users/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, data: { activities: lanyardActivities } })
    })
  );
  await page.route("**/api/app-icon**", (route) => route.fulfill({ status: 302, headers: { location: "/assets/icons/gamepad-fallback.svg" } }));
  await page.route("**cdn.discordapp.com/**", (route) => route.abort());
  await page.route("**media.discordapp.net/**", (route) => route.abort());
  await page.route("**i.scdn.co/**", (route) => route.abort());

  await page.goto("/public/index.html", { waitUntil: "networkidle" });
}

/** Push a Lanyard PRESENCE_UPDATE/INIT_STATE frame through the stub socket. */
async function emitLanyardActivities(page, activities) {
  await page.waitForFunction(() => !!window.__lastLanyardSocket);
  await page.evaluate((acts) => {
    window.__lastLanyardSocket.emit({ op: 0, t: "PRESENCE_UPDATE", d: { activities: acts } });
  }, activities);
}

module.exports = { openHome, emitLanyardActivities };
