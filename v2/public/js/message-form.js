/*
  Message panel toggle + client-side anti-spam guard rails.
  Mirrors the proven v1 implementation (rate limit, honeypot, spam patterns,
  email validation) — see v1/site/index.html. The actual submission is a
  plain HTML form POST to formsubmit.co; this script only validates/blocks
  before that native submit happens.
*/
(function () {
  "use strict";

  const button = document.getElementById("message-button");
  const panel = document.getElementById("message-panel");
  const firstField = document.getElementById("message-name");
  const form = document.getElementById("message-form");
  const honeypotField = document.getElementById("message-website");
  const formStartTime = document.getElementById("form-start-time");
  const nextField = document.getElementById("message-next");
  const submitBtn = document.getElementById("submit-btn");
  const errorContainer = document.getElementById("message-error");

  if (!button || !panel || !form) {
    return;
  }

  const t = (key, fallback) => (window.__t ? window.__t(key) : fallback);
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const RATE_LIMIT = {
    maxAttempts: 3,
    windowMs: 60 * 1000,
    blockMs: 5 * 60 * 1000
  };
  const STORAGE_KEY = "akemi_msg_ratelimit";

  const getRateLimitData = () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : { attempts: 0, windowStart: 0, blockedUntil: 0 };
    } catch (_e) {
      return { attempts: 0, windowStart: 0, blockedUntil: 0 };
    }
  };

  const saveRateLimitData = (data) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (_e) {
      /* ignore storage errors (private mode, quota, etc.) */
    }
  };

  const checkRateLimit = () => {
    const data = getRateLimitData();
    const now = Date.now();

    if (data.blockedUntil > now) {
      const remaining = Math.ceil((data.blockedUntil - now) / 1000);
      return {
        blocked: true,
        message: t("msg.rateLimit", "Too many requests. Please wait {s} seconds.").replace("{s}", remaining)
      };
    }

    if (now - data.windowStart > RATE_LIMIT.windowMs) {
      data.attempts = 0;
      data.windowStart = now;
      saveRateLimitData(data);
    }

    if (data.attempts >= RATE_LIMIT.maxAttempts) {
      data.blockedUntil = now + RATE_LIMIT.blockMs;
      data.attempts = 0;
      data.windowStart = now;
      saveRateLimitData(data);
      return { blocked: true, message: t("msg.rateLimitExceeded", "Rate limit exceeded. Please try again later.") };
    }

    return { blocked: false };
  };

  const incrementRateLimit = () => {
    const data = getRateLimitData();
    const now = Date.now();
    if (now - data.windowStart > RATE_LIMIT.windowMs) {
      data.windowStart = now;
      data.attempts = 1;
    } else {
      data.attempts += 1;
    }
    saveRateLimitData(data);
  };

  const showError = (message) => {
    if (!errorContainer) {
      return;
    }
    errorContainer.textContent = message;
    errorContainer.classList.add("is-visible");
  };

  const clearError = () => {
    if (!errorContainer) {
      return;
    }
    errorContainer.textContent = "";
    errorContainer.classList.remove("is-visible");
  };

  const setExpanded = (isExpanded) => {
    button.setAttribute("aria-expanded", String(isExpanded));
  };

  const openPanel = () => {
    panel.hidden = false;
    setExpanded(true);
    clearError();

    // Bound to this origin so the form redirects back to whichever
    // deployment (v1 or v2) it was actually submitted from.
    if (nextField) {
      nextField.value = `${window.location.origin}/success.html?v=2`;
    }
    if (formStartTime) {
      formStartTime.value = String(Date.now());
    }

    panel.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "nearest" });
    window.setTimeout(
      () => {
        if (firstField) {
          firstField.focus({ preventScroll: true });
        }
      },
      reduceMotion ? 0 : 320
    );
  };

  const closePanel = () => {
    panel.hidden = true;
    setExpanded(false);
  };

  button.addEventListener("click", (event) => {
    event.preventDefault();
    if (panel.hidden) {
      openPanel();
    } else {
      closePanel();
      button.focus({ preventScroll: true });
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !panel.hidden) {
      closePanel();
      button.focus({ preventScroll: true });
    }
  });

  form.addEventListener("submit", (event) => {
    const now = Date.now();

    // 1. Honeypot — filled means it's a bot. Fail silently.
    if (honeypotField && honeypotField.value.trim() !== "") {
      event.preventDefault();
      window.location.href = "/success.html?v=2";
      return;
    }

    // 2. Timing check — too-fast submissions are logged, not blocked
    // (a fast human is possible; a bot is far more likely).
    if (formStartTime && formStartTime.value) {
      const elapsed = now - parseInt(formStartTime.value, 10);
      if (elapsed < 2000) {
        console.warn("[anti-spam] fast submission:", elapsed + "ms");
      }
    }

    // 3. Rate limit
    const rateCheck = checkRateLimit();
    if (rateCheck.blocked) {
      event.preventDefault();
      showError(rateCheck.message);
      if (submitBtn) {
        submitBtn.disabled = true;
        window.setTimeout(() => {
          submitBtn.disabled = false;
          clearError();
        }, 3000);
      }
      return;
    }

    // 4. Spam pattern check
    const spamPatterns = [/https?:\/\/[^\s]{50,}/i, /\b(viagra|casino|poker|crypto|bitcoin|loan)\b/i, /(.)\1{5,}/i];
    const nameInput = document.getElementById("message-name");
    const emailInput = document.getElementById("message-email");
    const messageInput = document.getElementById("message-text");

    const isSpam = (field) => field && field.value && spamPatterns.some((pattern) => pattern.test(field.value));
    if (isSpam(nameInput) || isSpam(emailInput) || isSpam(messageInput)) {
      event.preventDefault();
      showError(t("msg.spamError", "Please remove URLs or suspicious content from your message."));
      return;
    }

    // 5. Email format
    if (emailInput && emailInput.value) {
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailPattern.test(emailInput.value)) {
        event.preventDefault();
        showError(t("msg.emailError", "Please enter a valid email address."));
        return;
      }
    }

    // All checks passed — let the native submit proceed to formsubmit.co.
    incrementRateLimit();
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = t("msg.sending", "Sending...");
    }
  });
})();
