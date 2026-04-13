const DISCORD_USER_ID = "334980960351158276";
const LANYARD_API = "https://api.lanyard.rest/v1/users/";
const REQUEST_TIMEOUT_MS = 4500;

/**
 * Discord activity types (from Discord Gateway docs):
 * 0 = Playing (Game)
 * 1 = Streaming
 * 2 = Listening (Spotify, etc.)
 * 3 = Watching
 * 4 = Custom Status
 * 5 = Competing
 */
const ACTIVITY_TYPE_LABELS = {
  0: "Playing",
  1: "Streaming",
  2: "Listening to",
  3: "Watching",
  4: "Custom Status",
  5: "Competing in"
};

const safeText = (value) =>
  typeof value === "string" ? value.trim() : "";

const resolveAssetUrl = (applicationId, assetKey) => {
  if (!assetKey) return "";
  if (assetKey.startsWith("mp:external/")) {
    const path = assetKey.replace("mp:external/", "");
    return `https://media.discordapp.net/external/${path}`;
  }
  if (assetKey.startsWith("spotify:")) {
    return `https://i.scdn.co/image/${assetKey.replace("spotify:", "")}`;
  }
  if (/^\d+$/.test(assetKey) && applicationId) {
    return `https://cdn.discordapp.com/app-assets/${applicationId}/${assetKey}.png`;
  }
  return "";
};

const normalizeActivity = (activity) => {
  const type = typeof activity.type === "number" ? activity.type : 0;
  const label = ACTIVITY_TYPE_LABELS[type] || "Playing";
  const applicationId = safeText(activity.application_id);

  const largeImage = resolveAssetUrl(
    applicationId,
    safeText(activity.assets && activity.assets.large_image)
  );
  const smallImage = resolveAssetUrl(
    applicationId,
    safeText(activity.assets && activity.assets.small_image)
  );

  return {
    type,
    label,
    name: safeText(activity.name),
    details: safeText(activity.details),
    state: safeText(activity.state),
    largeImage,
    smallImage,
    largeText: safeText(activity.assets && activity.assets.large_text),
    smallText: safeText(activity.assets && activity.assets.small_text),
    applicationId,
    timestamps: activity.timestamps || null,
    createdAt: activity.created_at || null
  };
};

const buildEtag = (activities) => {
  const base = JSON.stringify(activities.map((a) => [a.name, a.details, a.state, a.type]));
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

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${LANYARD_API}${DISCORD_USER_ID}`, {
      method: "GET",
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`Lanyard request failed (${response.status})`);
    }

    const json = await response.json();

    if (!json.success || !json.data) {
      throw new Error("Lanyard returned unsuccessful response");
    }

    const data = json.data;
    const allActivities = Array.isArray(data.activities) ? data.activities : [];

    // Filter out: Spotify/Listening (type 2) and Custom Status (type 4)
    const activities = allActivities
      .filter((a) => a.type !== 2 && a.type !== 4)
      .map(normalizeActivity);

    const payload = {
      status: "ok",
      discordStatus: safeText(data.discord_status),
      activities,
      activityCount: activities.length,
      updatedAt: new Date().toISOString()
    };

    const etag = buildEtag(activities);

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
      discordStatus: "offline",
      activities: [],
      activityCount: 0,
      updatedAt: new Date().toISOString()
    });
  } finally {
    clearTimeout(timeout);
  }
};
