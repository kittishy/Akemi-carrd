/*
  Discord activity feed via Lanyard (REST bootstrap + WebSocket live updates).
  Contract mirrors the proven v1 implementation — see v1/site/index.html.
  Renders strictly via createElement/textContent, never innerHTML with
  remote data (Discord activity names/details/state are untrusted input).
*/
(function () {
  "use strict";

  const DISCORD_USER_ID = "334980960351158276";
  const WS_URL = "wss://api.lanyard.rest/socket";
  const REST_URL = "https://api.lanyard.rest/v1/users/" + DISCORD_USER_ID;
  const DEFAULT_ART = "/assets/icons/gamepad-fallback.svg";
  const container = document.getElementById("lanyard-activities");

  if (!container) {
    return;
  }

  const t = (key, fallback) => (window.__t ? window.__t(key) : fallback);

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const ELAPSED_TICK_MS = reduceMotion ? 10000 : 1000;

  const ACTIVITY_LABELS = {
    0: ["lanyard.playing", "Playing"],
    1: ["lanyard.streaming", "Streaming"],
    2: ["lanyard.listening", "Listening to"],
    3: ["lanyard.watching", "Watching"],
    4: ["lanyard.custom", "Custom Status"],
    5: ["lanyard.competing", "Competing in"]
  };

  let ws = null;
  let heartbeatInterval = null;
  let reconnectDelay = 1000;
  const maxReconnect = 30000;
  let elapsedTimers = [];
  let lastActivitiesKey = "";

  function safeText(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function resolveAssetUrl(appId, key) {
    if (!key) {
      return "";
    }
    if (key.indexOf("mp:external/") === 0) {
      return "https://media.discordapp.net/external/" + key.replace("mp:external/", "");
    }
    if (key.indexOf("spotify:") === 0) {
      return "https://i.scdn.co/image/" + key.replace("spotify:", "");
    }
    if (/^\d+$/.test(key) && appId) {
      return "https://cdn.discordapp.com/app-assets/" + appId + "/" + key + ".png?size=512";
    }
    return "";
  }

  function formatElapsed(ms) {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const pad = (n) => (n < 10 ? "0" + n : "" + n);
    const elapsedWord = t("lanyard.elapsed", "elapsed");
    if (hours > 0) {
      return `${pad(hours)}:${pad(minutes)}:${pad(seconds)} ${elapsedWord}`;
    }
    return `${pad(minutes)}:${pad(seconds)} ${elapsedWord}`;
  }

  function clearElapsedTimers() {
    elapsedTimers.forEach((id) => window.clearInterval(id));
    elapsedTimers = [];
  }

  function buildActivityCard(activity) {
    const type = typeof activity.type === "number" ? activity.type : 0;
    const [i18nKey, fallbackLabel] = ACTIVITY_LABELS[type] || ACTIVITY_LABELS[0];
    const label = t(i18nKey, fallbackLabel);

    const appId = safeText(activity.application_id);
    const name = safeText(activity.name);
    const details = safeText(activity.details);
    const state = safeText(activity.state);
    const displayName = name || t("lanyard.unknown", "Unknown");

    let largeImage = resolveAssetUrl(appId, activity.assets && safeText(activity.assets.large_image));
    if (!largeImage && appId) {
      largeImage = "/api/app-icon?id=" + appId;
    }
    const smallImage = resolveAssetUrl(appId, activity.assets && safeText(activity.assets.small_image));
    const largeText = activity.assets ? safeText(activity.assets.large_text) : "";
    const smallText = activity.assets ? safeText(activity.assets.small_text) : "";
    const startTimestamp = activity.timestamps && activity.timestamps.start ? activity.timestamps.start : null;

    const card = document.createElement("article");
    card.className = "activity-card";
    card.setAttribute("aria-label", `${label} ${displayName}`);

    const artWrapper = document.createElement("div");
    artWrapper.className = "activity-art-wrapper";

    const img = document.createElement("img");
    img.className = "activity-art";
    img.src = largeImage || DEFAULT_ART;
    img.alt = largeText || displayName;
    img.width = 38;
    img.height = 38;
    img.loading = "lazy";
    img.decoding = "async";
    img.onerror = function () {
      if (this.src !== DEFAULT_ART && !this.src.endsWith(DEFAULT_ART)) {
        this.onerror = null;
        this.src = DEFAULT_ART;
      } else {
        this.onerror = null;
      }
    };
    artWrapper.appendChild(img);

    if (smallImage) {
      const smallImg = document.createElement("img");
      smallImg.className = "activity-art-small";
      smallImg.src = smallImage;
      smallImg.alt = smallText || "";
      smallImg.width = 16;
      smallImg.height = 16;
      smallImg.loading = "lazy";
      smallImg.decoding = "async";
      smallImg.onerror = function () {
        this.style.display = "none";
      };
      artWrapper.appendChild(smallImg);
    }

    card.appendChild(artWrapper);

    const info = document.createElement("div");
    info.className = "activity-info";

    const labelEl = document.createElement("p");
    labelEl.className = "activity-label";
    const pulse = document.createElement("span");
    pulse.className = "activity-pulse";
    pulse.setAttribute("aria-hidden", "true");
    labelEl.appendChild(pulse);
    labelEl.appendChild(document.createTextNode(label));
    info.appendChild(labelEl);

    const nameEl = document.createElement("p");
    nameEl.className = "activity-name";
    nameEl.textContent = displayName;
    nameEl.title = displayName;
    info.appendChild(nameEl);

    if (details) {
      const detailsEl = document.createElement("p");
      detailsEl.className = "activity-details";
      detailsEl.textContent = details;
      detailsEl.title = details;
      info.appendChild(detailsEl);
    }

    if (state) {
      const stateEl = document.createElement("p");
      stateEl.className = "activity-state";
      stateEl.textContent = state;
      stateEl.title = state;
      info.appendChild(stateEl);
    }

    if (startTimestamp) {
      const elapsedEl = document.createElement("p");
      elapsedEl.className = "activity-elapsed";
      const updateElapsed = () => {
        elapsedEl.textContent = formatElapsed(Date.now() - startTimestamp);
      };
      updateElapsed();
      elapsedTimers.push(window.setInterval(updateElapsed, ELAPSED_TICK_MS));
      info.appendChild(elapsedEl);
    }

    card.appendChild(info);
    return card;
  }

  function renderActivities(activities) {
    const filtered = activities.filter((a) => a.type !== 2 && a.type !== 4);

    const key = JSON.stringify(
      filtered.map((a) => [a.name, a.details, a.state, a.type, a.application_id])
    );
    if (key === lastActivitiesKey) {
      return;
    }
    lastActivitiesKey = key;

    clearElapsedTimers();
    container.textContent = "";
    filtered.forEach((activity) => {
      container.appendChild(buildActivityCard(activity));
    });
  }

  function connectWS() {
    if (ws) {
      try {
        ws.close();
      } catch (_e) {
        /* ignore */
      }
    }

    ws = new WebSocket(WS_URL);

    ws.onopen = () => {
      reconnectDelay = 1000;
    };

    ws.onmessage = (event) => {
      let msg;
      try {
        msg = JSON.parse(event.data);
      } catch (_e) {
        return;
      }

      if (msg.op === 1) {
        const interval = (msg.d && msg.d.heartbeat_interval) || 30000;
        if (heartbeatInterval) {
          window.clearInterval(heartbeatInterval);
        }
        heartbeatInterval = window.setInterval(() => {
          if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ op: 3 }));
          }
        }, interval);

        ws.send(JSON.stringify({ op: 2, d: { subscribe_to_id: DISCORD_USER_ID } }));
      }

      if (msg.op === 0 && msg.d) {
        if (msg.t === "INIT_STATE" || msg.t === "PRESENCE_UPDATE") {
          const activities = Array.isArray(msg.d.activities) ? msg.d.activities : [];
          renderActivities(activities);
        }
      }
    };

    ws.onerror = () => {
      /* onclose handles reconnect */
    };

    ws.onclose = () => {
      if (heartbeatInterval) {
        window.clearInterval(heartbeatInterval);
        heartbeatInterval = null;
      }
      window.setTimeout(() => {
        reconnectDelay = Math.min(reconnectDelay * 2, maxReconnect);
        connectWS();
      }, reconnectDelay);
    };
  }

  function fetchREST() {
    fetch(REST_URL)
      .then((res) => res.json())
      .then((json) => {
        if (json.success && json.data && Array.isArray(json.data.activities)) {
          renderActivities(json.data.activities);
        }
      })
      .catch(() => {
        /* silent — WS will populate once connected */
      });
  }

  fetchREST();
  connectWS();

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      connectWS();
    }
  });

  window.addEventListener("online", () => {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      fetchREST();
      connectWS();
    }
  });
})();
