//yt-caption-hook.js
(function () {
  if (window.__WT_YT_HOOKED__) return;
  window.__WT_YT_HOOKED__ = true;

  console.log("[What’sThat][yt] seek-based caption hook injected");


  function getVideo() {
    return document.querySelector("video");
  }

  function getCaptionContainer() {
    return (
      document.querySelector(".ytp-caption-window-container") ||
      document.querySelector(".ytp-caption-window-bottom") ||
      document.querySelector(".ytp-caption-window-top") ||
      null
    );
  }

  function getCcButton() {
    return document.querySelector(".ytp-subtitles-button");
  }

  function cleanCaptionText(raw) {
    if (!raw) return "";

    let t = raw.replace(/\s+/g, " ").trim();
    if (!t) return "";

    const uiPatterns = [
      /click\s*for\s*settings/i,
      /\benglish\b/i,
      /subtitles\/?\s*closed captions/i,
      /\bsubtitles\b/i,
      /\bclosed captions\b/i,
      /\bauto[-\s]?generated\b/i,
    ];

    for (const pat of uiPatterns) {
      if (pat.test(t)) {
        return "";
      }
    }

    t = t
      .replace(/♪/g, "")
      .replace(/\.{2,}/g, "…")
      .replace(/<[^>]+>/g, "")
      .replace(/\[[^\]]+\]/g, "")
      .replace(/\{[^}]+\}/g, "")
      .replace(/\([^)]+\)/g, "")
      .replace(/\s+/g, " ")
      .trim();

    if (t.length < 3) return "";

    return t;
  }

  function readCaptionText(container) {
    if (!container) return "";

    let nodes = container.querySelectorAll(".ytp-caption-segment");
    if (!nodes.length) {
      nodes = container.querySelectorAll("span");
    }

    const parts = [];
    nodes.forEach((s) => {
      const cleaned = cleanCaptionText(s.textContent || "");
      if (cleaned) parts.push(cleaned);
    });

    const joined = parts.join(" ").replace(/\s+/g, " ").trim();
    return joined;
  }

  function dedupeSentences(text) {
    if (!text) return "";
    const sentences = text
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter(Boolean);

    const seen = new Set();
    const result = [];

    for (const s of sentences) {
      const key = s.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(s);
    }

    return result.join(" ");
  }


  async function simulateLastSeconds(windowSeconds) {
    const video = getVideo();
    if (!video) {
      console.warn("[What’sThat][yt] no video element");
      return { ok: false, text: "no record" };
    }

    const container = getCaptionContainer();
    if (!container) {
      console.warn("[What’sThat][yt] no caption container in DOM");
      return { ok: false, text: "no record" };
    }

    const ccButton = getCcButton();
    const ccWasOn =
      ccButton && ccButton.getAttribute("aria-pressed") === "true";

    const original = {
      time: video.currentTime,
      rate: video.playbackRate,
      paused: video.paused,
      muted: video.muted,
      ccWasOn,
    };

    const startTime = Math.max(0, original.time - windowSeconds);
    const span = original.time - startTime;

    if (!ccWasOn && ccButton && typeof ccButton.click === "function") {
      ccButton.click();
    }

    let fullTranscript = "";
    let lastChunk = "";

    const observer = new MutationObserver(() => {
      const cleaned = readCaptionText(container);
      if (!cleaned) return;

      const current = fullTranscript.trim();
      if (current && current.includes(cleaned)) return;

      if (cleaned === lastChunk) return;

      if (
        lastChunk &&
        cleaned.startsWith(lastChunk) &&
        cleaned.length <= lastChunk.length * 2
      ) {
        const tail = cleaned.slice(lastChunk.length).trim();
        if (tail) {
          fullTranscript = (current + " " + tail).trim();
        }
        lastChunk = cleaned;
        return;
      }

      if (lastChunk && lastChunk.includes(cleaned)) {
        return;
      }

      fullTranscript = (current + " " + cleaned).trim();
      lastChunk = cleaned;
    });

    observer.observe(container, {
      childList: true,
      characterData: true,
      subtree: true,
    });

    try {
      video.muted = true;
      video.playbackRate = 8.0;

      video.currentTime = startTime;
      await video.play().catch(() => {
      });

      const playMs = (span / video.playbackRate) * 1000 + 400;

      await new Promise((resolve) => setTimeout(resolve, playMs));
    } catch (e) {
      console.warn("[What’sThat][yt] simulate error:", e);
    } finally {
      observer.disconnect();

      try {
        video.playbackRate = original.rate;
        video.muted = original.muted;
        video.currentTime = original.time;
        if (original.paused) {
          video.pause();
        }
      } catch (e) {
        console.warn("[What’sThat][yt] restore error:", e);
      }

      if (!original.ccWasOn && ccButton && typeof ccButton.click === "function") {
        ccButton.click();
      }
    }

    let finalText = fullTranscript.replace(/\s+/g, " ").trim();
    if (!finalText) {
      return { ok: false, text: "no record" };
    }

    finalText = dedupeSentences(finalText);

    return { ok: true, text: finalText };
  }


  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    const data = event.data;
    if (!data || data.source !== "WHATSTHAT") return;

    if (data.type === "WT_GET_YT_LAST10") {
      simulateLastSeconds(10).then((result) => {
        window.postMessage(
          {
            source: "WHATSTHAT",
            type: "WT_YT_LAST10",
            ok: result.ok,
            text: result.text,
          },
          "*"
        );
      });
    }
  });
})();