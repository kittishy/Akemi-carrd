/*
  i18n — 3 languages (pt/en/ja), manual selector, localStorage persistence.
  Unlike v1 (13 languages, browser-detected only, no manual switch), this
  exposes window.__t(key, fallback) synchronously so every other module can
  call it defensively before/after the DOM sweep runs.

  Note: profile name, pronouns, bio and about-me are intentionally NOT
  translated here (same choice v1 made) — they're fixed personal copy that
  mixes scripts on purpose (e.g. "疲れたわ"), not UI chrome.
*/
(function () {
  "use strict";

  const STORAGE_KEY = "akemi_lang";
  const SUPPORTED = ["pt", "en", "ja"];

  const translations = {
    pt: {
      "np.listening": "Ouvindo",
      "np.unknownTrack": "Faixa desconhecida",
      "np.unknownArtist": "Artista desconhecido",
      "btn.addFriend": "Adicionar",
      "btn.message": "Mensagem",
      "msg.namePlaceholder": "Seu nome",
      "msg.emailPlaceholder": "Seu email",
      "msg.textPlaceholder": "Digite sua mensagem",
      "msg.submit": "Enviar mensagem",
      "msg.sending": "Enviando...",
      "msg.rateLimit": "Muitas solicitações. Aguarde {s} segundos.",
      "msg.rateLimitExceeded": "Limite atingido. Tente novamente mais tarde.",
      "msg.spamError": "Remova links ou conteúdo suspeito da sua mensagem.",
      "msg.emailError": "Insira um email válido.",
      "lanyard.playing": "Jogando",
      "lanyard.streaming": "Transmitindo",
      "lanyard.listening": "Ouvindo",
      "lanyard.watching": "Assistindo",
      "lanyard.custom": "Status Personalizado",
      "lanyard.competing": "Competindo em",
      "lanyard.elapsed": "decorrido",
      "lanyard.unknown": "Desconhecido",
      "lang.label": "Idioma"
    },
    en: {
      "np.listening": "Listening",
      "np.unknownTrack": "Unknown track",
      "np.unknownArtist": "Unknown artist",
      "btn.addFriend": "Add Friend",
      "btn.message": "Message",
      "msg.namePlaceholder": "Your name",
      "msg.emailPlaceholder": "Your email",
      "msg.textPlaceholder": "Type your message",
      "msg.submit": "Send message",
      "msg.sending": "Sending...",
      "msg.rateLimit": "Too many requests. Please wait {s} seconds.",
      "msg.rateLimitExceeded": "Rate limit exceeded. Please try again later.",
      "msg.spamError": "Please remove URLs or suspicious content from your message.",
      "msg.emailError": "Please enter a valid email address.",
      "lanyard.playing": "Playing",
      "lanyard.streaming": "Streaming",
      "lanyard.listening": "Listening to",
      "lanyard.watching": "Watching",
      "lanyard.custom": "Custom Status",
      "lanyard.competing": "Competing in",
      "lanyard.elapsed": "elapsed",
      "lanyard.unknown": "Unknown",
      "lang.label": "Language"
    },
    ja: {
      "np.listening": "聴いています",
      "np.unknownTrack": "不明な曲",
      "np.unknownArtist": "不明なアーティスト",
      "btn.addFriend": "フレンド追加",
      "btn.message": "メッセージ",
      "msg.namePlaceholder": "お名前",
      "msg.emailPlaceholder": "メールアドレス",
      "msg.textPlaceholder": "メッセージを入力",
      "msg.submit": "送信する",
      "msg.sending": "送信中...",
      "msg.rateLimit": "リクエストが多すぎます。{s}秒お待ちください。",
      "msg.rateLimitExceeded": "制限を超えました。しばらくしてからお試しください。",
      "msg.spamError": "メッセージからURLや不審な内容を削除してください。",
      "msg.emailError": "有効なメールアドレスを入力してください。",
      "lanyard.playing": "プレイ中",
      "lanyard.streaming": "配信中",
      "lanyard.listening": "再生中",
      "lanyard.watching": "視聴中",
      "lanyard.custom": "カスタムステータス",
      "lanyard.competing": "競技中",
      "lanyard.elapsed": "経過",
      "lanyard.unknown": "不明",
      "lang.label": "言語"
    }
  };

  function detectLang() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && SUPPORTED.indexOf(stored) !== -1) {
        return stored;
      }
    } catch (_e) {
      /* ignore storage errors */
    }
    const nav = ((navigator.language || navigator.userLanguage || "pt") + "").toLowerCase().split("-")[0];
    return SUPPORTED.indexOf(nav) !== -1 ? nav : "pt";
  }

  let currentLang = detectLang();

  function t(key, fallback) {
    const dict = translations[currentLang] || translations.pt;
    if (dict[key] != null) {
      return dict[key];
    }
    if (translations.pt[key] != null) {
      return translations.pt[key];
    }
    return fallback != null ? fallback : key;
  }

  function applyTranslations() {
    document.documentElement.lang = currentLang;

    document.querySelectorAll("[data-i18n]").forEach((el) => {
      el.textContent = t(el.getAttribute("data-i18n"));
    });
    document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
      el.setAttribute("placeholder", t(el.getAttribute("data-i18n-placeholder")));
    });
    document.querySelectorAll("[data-i18n-aria-label]").forEach((el) => {
      el.setAttribute("aria-label", t(el.getAttribute("data-i18n-aria-label")));
    });
    document.querySelectorAll(".lang-btn").forEach((btn) => {
      btn.setAttribute("aria-pressed", String(btn.getAttribute("data-lang") === currentLang));
    });
  }

  function setLang(lang) {
    if (SUPPORTED.indexOf(lang) === -1 || lang === currentLang) {
      return;
    }
    currentLang = lang;
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch (_e) {
      /* ignore storage errors */
    }
    applyTranslations();
  }

  // Exposed synchronously so any module loaded after this one can call
  // window.__t immediately, even before DOMContentLoaded fires.
  window.__t = t;

  document.addEventListener("DOMContentLoaded", () => {
    applyTranslations();
    document.querySelectorAll(".lang-btn").forEach((btn) => {
      btn.addEventListener("click", () => setLang(btn.getAttribute("data-lang")));
    });
  });
})();
