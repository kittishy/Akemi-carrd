const LASTFM_BASE_URL = "https://ws.audioscrobbler.com/2.0/";
const API_METHOD = "user.getrecenttracks";
const REQUEST_TIMEOUT_MS = 4500;

const getEnv = (name, fallback = "") => {
  const value = process.env[name];
  return typeof value === "string" ? value.trim() : fallback;
};

const safeText = (value) => {
  return typeof value === "string" ? value.trim() : "";
};

const extractImageUrl = (track) => {
  if (!track || !Array.isArray(track.image)) {
    return "";
  }

  const preferred = ["extralarge", "large", "medium", "small"];
  for (const size of preferred) {
    const image = track.image.find((entry) => entry && entry.size === size && safeText(entry["#text"]));
    if (image) {
      return safeText(image["#text"]);
    }
  }

  const first = track.image.find((entry) => entry && safeText(entry["#text"]));
  return first ? safeText(first["#text"]) : "";
};

const normalizePayload = (track) => {
  const nowPlaying = safeText(track && track["@attr"] && track["@attr"].nowplaying).toLowerCase() === "true";
  if (!nowPlaying) {
    return {
      status: "idle",
      track: null,
      source: "lastfm",
      updatedAt: new Date().toISOString(),
      isStale: false
    };
  }

  const artistName = safeText(track && track.artist && track.artist["#text"]);
  const trackName = safeText(track && track.name);
  const albumName = safeText(track && track.album && track.album["#text"]);
  const trackUrl = safeText(track && track.url);
  const imageUrl = extractImageUrl(track);

  return {
    status: "playing",
    track: {
      name: trackName,
      artist: artistName,
      album: albumName,
      imageUrl,
      lastfmUrl: trackUrl
    },
    source: "lastfm",
    updatedAt: new Date().toISOString(),
    isStale: false
  };
};

const buildEtag = (payload) => {
  const base = JSON.stringify({
    status: payload.status,
    track: payload.track
  });

  let hash = 0;
  for (let i = 0; i < base.length; i += 1) {
    hash = (hash << 5) - hash + base.charCodeAt(i);
    hash |= 0;
  }

  return `W/"${Math.abs(hash)}"`;
};

module.exports = async (req, res) => {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    res.status(405).json({ status: "error", message: "Method not allowed" });
    return;
  }

  const apiKey = getEnv("LAST_FM_API_KEY");
  const username = getEnv("LAST_FM_USERNAME", "ak6h");

  if (!apiKey || !username) {
    res.status(500).json({ status: "error", message: "Missing Last.fm configuration" });
    return;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const search = new URLSearchParams({
      method: API_METHOD,
      user: username,
      api_key: apiKey,
      format: "json",
      limit: "1"
    });

    const response = await fetch(`${LASTFM_BASE_URL}?${search.toString()}`, {
      method: "GET",
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`Last.fm request failed (${response.status})`);
    }

    const data = await response.json();
    const track = data && data.recenttracks && Array.isArray(data.recenttracks.track) ? data.recenttracks.track[0] : null;
    const payload = normalizePayload(track);
    const etag = buildEtag(payload);

    res.setHeader("Cache-Control", "public, max-age=10, stale-while-revalidate=30");
    res.setHeader("ETag", etag);

    if (req.headers["if-none-match"] === etag) {
      res.status(304).end();
      return;
    }

    res.status(200).json(payload);
  } catch (_error) {
    res.setHeader("Cache-Control", "no-store");
    res.status(200).json({
      status: "error",
      track: null,
      source: "lastfm",
      updatedAt: new Date().toISOString(),
      isStale: true
    });
  } finally {
    clearTimeout(timeout);
  }
};
