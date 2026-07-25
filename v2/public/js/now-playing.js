/*
  Last.fm "now playing" poller.
  Contract: GET /api/now-playing -> {status:"playing"|"idle"|"error", track:{...}|null, ...}
  Behavior (intervals, backoff, ETag, visibility/online handling) mirrors the
  proven v1 implementation — see v1/site/index.html for the original.
*/
(function () {
  "use strict";

  const card = document.getElementById("now-playing-card");
  const art = document.getElementById("now-playing-art");
  const track = document.getElementById("now-playing-track");
  const artist = document.getElementById("now-playing-artist");
  const link = document.getElementById("now-playing-link");

  if (!card || !art || !track || !artist || !link) {
    return;
  }

  const t = (key, fallback) => (window.__t ? window.__t(key) : fallback);

  const POLL_PLAYING = 5000;
  const POLL_IDLE = 30000;
  const POLL_HIDDEN = 300000;
  const POLL_ERROR_BASE = 30000;
  const POLL_ERROR_MAX = 300000;
  const STALE_KEEP_PLAYING_MS = 120000;
  const REQUEST_TIMEOUT_MS = 4500;
  const endpoint = "/api/now-playing";

  art.onerror = function () {
    this.onerror = null;
    this.hidden = true;
    this.removeAttribute("src");
  };

  let isPlaying = false;
  let timer = null;
  let etag = "";
  let inFlightController = null;
  let errorCount = 0;
  let lastPlayingAt = 0;
  let lastTrackKey = "";
  let lastTrackImage = "";
  let lastTrackUrl = "";

  const withJitter = (ms) => ms + Math.round(ms * 0.1 * Math.random());

  const schedule = (ms) => {
    if (timer) {
      window.clearTimeout(timer);
    }
    timer = window.setTimeout(runUpdate, withJitter(ms));
  };

  const setPlaying = (next) => {
    if (isPlaying === next) {
      return;
    }
    isPlaying = next;
    card.hidden = !next;
  };

  const writeTrack = (payload) => {
    const nextTrack = payload && payload.track ? payload.track : null;
    if (!nextTrack) {
      return;
    }

    const nextTrackKey = [nextTrack.artist, nextTrack.name, nextTrack.album].filter(Boolean).join("::");
    const nextTrackUrl = nextTrack.lastfmUrl || "https://www.last.fm";
    const nextTrackImage = nextTrack.imageUrl || "";
    if (nextTrackKey === lastTrackKey && nextTrackUrl === lastTrackUrl && nextTrackImage === lastTrackImage) {
      return;
    }
    lastTrackKey = nextTrackKey;
    lastTrackUrl = nextTrackUrl;
    lastTrackImage = nextTrackImage;

    const displayTrack = nextTrack.name || t("np.unknownTrack", "Unknown track");
    const displayArtist = nextTrack.artist || t("np.unknownArtist", "Unknown artist");

    track.textContent = displayTrack;
    track.title = displayTrack;
    artist.textContent = displayArtist;
    artist.title = displayArtist;
    link.href = nextTrackUrl;
    card.setAttribute("aria-label", `${t("np.listening", "Listening")} — ${displayTrack} · ${displayArtist}`);

    art.onerror = function () {
      this.onerror = null;
      this.hidden = true;
      this.removeAttribute("src");
    };

    if (nextTrackImage) {
      art.src = nextTrackImage;
      art.alt = `${displayTrack} — ${displayArtist}`;
      art.hidden = false;
    } else {
      art.hidden = true;
      art.removeAttribute("src");
    }
  };

  const fetchNowPlaying = async () => {
    if (inFlightController) {
      inFlightController.abort();
    }
    inFlightController = new AbortController();
    const timeoutId = window.setTimeout(() => inFlightController.abort(), REQUEST_TIMEOUT_MS);

    try {
      const headers = {};
      if (etag) {
        headers["If-None-Match"] = etag;
      }
      const response = await fetch(endpoint, {
        method: "GET",
        cache: "no-store",
        headers,
        signal: inFlightController.signal
      });

      if (response.status === 304) {
        return { notModified: true };
      }
      if (!response.ok) {
        throw new Error("now-playing request failed");
      }
      const responseEtag = response.headers.get("ETag");
      if (responseEtag) {
        etag = responseEtag;
      }
      return await response.json();
    } finally {
      window.clearTimeout(timeoutId);
      inFlightController = null;
    }
  };

  const handleOffline = () => {
    if (isPlaying && Date.now() - lastPlayingAt <= STALE_KEEP_PLAYING_MS) {
      schedule(POLL_HIDDEN);
      return;
    }
    setPlaying(false);
    schedule(POLL_HIDDEN);
  };

  async function runUpdate() {
    if (document.hidden) {
      schedule(POLL_HIDDEN);
      return;
    }
    if (!navigator.onLine) {
      handleOffline();
      return;
    }

    try {
      const payload = await fetchNowPlaying();

      if (payload && payload.notModified) {
        schedule(isPlaying ? POLL_PLAYING : POLL_IDLE);
        return;
      }

      errorCount = 0;

      if (payload && payload.status === "playing") {
        writeTrack(payload);
        lastPlayingAt = Date.now();
        setPlaying(true);
        schedule(POLL_PLAYING);
        return;
      }

      setPlaying(false);
      schedule(POLL_IDLE);
    } catch (_error) {
      errorCount += 1;
      const errorPoll = Math.min(POLL_ERROR_BASE * Math.pow(2, errorCount - 1), POLL_ERROR_MAX);

      if (isPlaying && Date.now() - lastPlayingAt <= STALE_KEEP_PLAYING_MS) {
        schedule(errorPoll);
        return;
      }
      setPlaying(false);
      schedule(errorPoll);
    }
  }

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) {
      if (timer) {
        window.clearTimeout(timer);
        timer = null;
      }
      if (inFlightController) {
        inFlightController.abort();
        inFlightController = null;
      }
    } else {
      runUpdate();
    }
  });

  window.addEventListener("online", function () {
    if (!document.hidden) {
      runUpdate();
    }
  });

  window.addEventListener("offline", handleOffline);

  runUpdate();
})();
