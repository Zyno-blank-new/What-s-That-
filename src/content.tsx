// src/content.tsx
export {};

declare global {
  interface Window {
    __WT_INSTALLED__?: boolean;
    ytInitialPlayerResponse?: any;
    ytPlayerApplicationContext?: any;
  }
}

declare const chrome: any;

import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import Sidebar from "./ui/Sidebar";
import sidebarCss from "./ui/sidebar.css?inline";
import questionCss from "./ui/questionStyles.css?inline";
import type { AIQuestion } from "./ai/gemini";


function isYoutube(): boolean {
  return /(\.|^)youtube\.com$/.test(window.location.hostname);
}

function getYoutubeMetadata() {
  const ytr =
    window.ytInitialPlayerResponse ||
    (window.ytPlayerApplicationContext &&
      window.ytPlayerApplicationContext.playerResponse);

  let title = "";
  let channel = "";

  if (ytr && ytr.videoDetails) {
    title = ytr.videoDetails.title || "";
    channel = ytr.videoDetails.author || "";
  }

  if (!title) {
    const titleEl =
      document.querySelector<HTMLElement>(
        "h1.ytd-watch-metadata, h1.title, h1.ytd-video-primary-info-renderer, #title h1"
      ) ||
      document.querySelector<HTMLElement>(
        "#title yt-formatted-string.ytd-video-primary-info-renderer"
      );

    if (titleEl && titleEl.textContent) {
      title = titleEl.textContent.trim();
    }
  }

  if (!channel) {
    const channelEl =
      document.querySelector<HTMLElement>("#owner-name a") ||
      document.querySelector<HTMLElement>("#channel-name a") ||
      document.querySelector<HTMLElement>("#channel-name #text a") ||
      document.querySelector<HTMLElement>(
        "ytd-channel-name yt-formatted-string a"
      ) ||
      document.querySelector<HTMLElement>(
        "ytd-video-owner-renderer #text a"
      );

    if (channelEl && channelEl.textContent) {
      channel = channelEl.textContent.trim();
    }
  }

  console.debug("[What’sThat][yt] metadata:", { title, channel });
  return { title, channel };
}

function findVisibleImageRects(): DOMRect[] {
  const vh = window.innerHeight;
  const imgs = Array.from(
    document.querySelectorAll<HTMLImageElement>("img")
  );

  const rects: DOMRect[] = [];

  for (const el of imgs) {
    const rect = el.getBoundingClientRect();
    const centerY = rect.top + rect.height / 2;

    if (centerY < 0 || centerY > vh) continue;

    const style = window.getComputedStyle(el);
    if (
      style.display === "none" ||
      style.visibility === "hidden" ||
      style.opacity === "0"
    ) {
      continue;
    }

    const MIN_SIZE = 50;
    if (rect.width < MIN_SIZE || rect.height < MIN_SIZE) continue;

    rects.push(rect);
  }

  return rects;
}

type VideoInfo = { el: HTMLVideoElement; rect: DOMRect };

function findMainVisibleVideoInfo(): VideoInfo | null {
  const vh = window.innerHeight;
  const videos = Array.from(
    document.querySelectorAll<HTMLVideoElement>("video")
  );

  let best: { el: HTMLVideoElement; rect: DOMRect; area: number } | null = null;

  for (const el of videos) {
    const rect = el.getBoundingClientRect();
    const centerY = rect.top + rect.height / 2;

    if (centerY < 0 || centerY > vh) continue;

    const style = window.getComputedStyle(el);
    if (
      style.display === "none" ||
      style.visibility === "hidden" ||
      style.opacity === "0"
    ) {
      continue;
    }

    const MIN_SIZE = 80;
    if (rect.width < MIN_SIZE || rect.height < MIN_SIZE) continue;

    const area = rect.width * rect.height;
    if (!best || area > best.area) {
      best = { el, rect, area };
    }
  }

  return best ? { el: best.el, rect: best.rect } : null;
}

function cropImageToRect(dataUrl: string, rect: DOMRect): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const dpr = window.devicePixelRatio || 1;
      const canvas = document.createElement("canvas");
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(null);
        return;
      }

      ctx.drawImage(
        img,
        rect.left * dpr,
        rect.top * dpr,
        rect.width * dpr,
        rect.height * dpr,
        0,
        0,
        canvas.width,
        canvas.height
      );

      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

function getViewportHtml(): string {
  const vh = window.innerHeight;

  const elements = Array.from(
    document.querySelectorAll<HTMLElement>(
      "h1, h2, h3, h4, h5, h6, p, li, ul, ol, table, pre, code, blockquote, figure, img"
    )
  );

  const chosen: HTMLElement[] = [];

  outer: for (const el of elements) {
    const rect = el.getBoundingClientRect();
    const centerY = rect.top + rect.height / 2;

    if (centerY < -2 * vh || centerY > vh) continue;

    const style = window.getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden") continue;

    if (el.tagName !== "TABLE" && el.closest("table")) continue;

    for (const parent of chosen) {
      if (parent.contains(el)) continue outer;
    }

    chosen.push(el);
  }

  return chosen.map((el) => el.outerHTML).join("\n\n");
}


function injectYoutubeCaptionHook() {
  try {
    const id = "wt-yt-caption-seek-hook";
    if (document.getElementById(id)) return;

    const s = document.createElement("script");
    s.id = id;
    s.src = chrome.runtime.getURL("yt-caption-hook.js");
    s.async = false;
    (document.head || document.documentElement).appendChild(s);
  } catch (e) {
    console.warn("[What’sThat] failed to inject yt-caption-hook:", e);
  }
}

if (!window.__WT_INSTALLED__) {
  window.__WT_INSTALLED__ = true;

  if (isYoutube()) {
    injectYoutubeCaptionHook();
  }

  let host: HTMLDivElement | null = null;

  function mountReact() {
    if (host) return;

    host = document.createElement("div");
    host.id = "wt-host";
    host.style.all = "initial";
    host.style.position = "fixed";
    host.style.inset = "0 0 0 auto";
    host.style.zIndex = "2147483647";
    document.documentElement.appendChild(host);

    const shadow = host.attachShadow({ mode: "open" });

    const css1 = document.createElement("style");
    css1.textContent = sidebarCss;
    shadow.appendChild(css1);

    const css2 = document.createElement("style");
    css2.textContent = questionCss;
    shadow.appendChild(css2);

    const mountEl = document.createElement("div");
    shadow.appendChild(mountEl);

    const App: React.FC = () => {
      const [open, setOpen] = useState(false);
      const [pageHtml, setPageHtml] = useState("");
      const [snapshotUrls, setSnapshotUrls] = useState<string[]>([]);
      const [videoSnapshotUrl, setVideoSnapshotUrl] = useState<string | null>(null);
      const [subtitleText, setSubtitleText] = useState<string>("");
      const [videoTitle, setVideoTitle] = useState("");
      const [channelName, setChannelName] = useState("");
      const [aiQuestions, setAiQuestions] = useState<AIQuestion[]>([]);

      useEffect(() => {
        const handler = (
          msg: any,
          _sender: chrome.runtime.MessageSender,
          sendResponse: (r: any) => void
        ) => {
          if (msg?.type === "WT_PING") {
            sendResponse({ ok: true });
            return;
          }
          if (msg?.type === "WT_TOGGLE") {
            setOpen((prev) => !prev);
          }
        };

        chrome.runtime.onMessage.addListener(handler as any);
        return () => chrome.runtime.onMessage.removeListener(handler as any);
      }, []);

      useEffect(() => {
        let cancelled = false;

        if (!open) {
          setSnapshotUrls([]);
          setVideoSnapshotUrl(null);
          setSubtitleText("");
          setVideoTitle("");
          setChannelName("");
          return;
        }

        if (isYoutube()) {
          const meta1 = getYoutubeMetadata();
          setVideoTitle(meta1.title);
          setChannelName(meta1.channel);

          setTimeout(() => {
            if (cancelled) return;
            const meta2 = getYoutubeMetadata();
            if (!meta1.title && meta2.title) setVideoTitle(meta2.title);
            if (!meta1.channel && meta2.channel) setChannelName(meta2.channel);
          }, 500);
        }

        const html = getViewportHtml();
        setPageHtml(html);

        const imageRects = findVisibleImageRects();
        const videoInfo = findMainVisibleVideoInfo();

        if (videoInfo && isYoutube()) {
          setSubtitleText("no record");

          const onMessage = (ev: MessageEvent) => {
            const data = ev.data;
            if (
              !data ||
              data.source !== "WHATSTHAT" ||
              data.type !== "WT_YT_LAST10"
            ) {
              return;
            }
            if (cancelled) return;

            const txt =
              data && data.ok && typeof data.text === "string"
                ? data.text
                : "no record";
            setSubtitleText(txt || "no record");

            window.removeEventListener("message", onMessage);
          };

          window.addEventListener("message", onMessage);

          window.postMessage(
            { source: "WHATSTHAT", type: "WT_GET_YT_LAST10" },
            "*"
          );
        } else {
          setSubtitleText("");
        }

        if (imageRects.length === 0 && !videoInfo) {
          setSnapshotUrls([]);
          setVideoSnapshotUrl(null);
          return;
        }

        chrome.runtime.sendMessage(
          { type: "WT_REQUEST_CAPTURE" },
          async (resp: any) => {
            if (cancelled) return;

            if (!resp || !resp.ok || !resp.dataUrl) {
              setSnapshotUrls([]);
              setVideoSnapshotUrl(null);
              return;
            }

            const dataUrl: string = resp.dataUrl;

            const imageCrops = await Promise.all(
              imageRects.map((r) => cropImageToRect(dataUrl, r))
            );
            if (cancelled) return;

            const validImages = imageCrops.filter(
              (c): c is string => !!c
            );
            setSnapshotUrls(validImages);

            if (videoInfo) {
              const vCrop = await cropImageToRect(
                dataUrl,
                videoInfo.rect
              );
              if (!cancelled) {
                setVideoSnapshotUrl(vCrop || null);
              }
            } else {
              setVideoSnapshotUrl(null);
            }
          }
        );

        return () => {
          cancelled = true;
        };
      }, [open]);

      useEffect(() => {
        if (!open) {
          setAiQuestions([]);
          return;
        }

        const hasContext =
          !!videoSnapshotUrl ||
          !!subtitleText ||
          !!pageHtml;

        if (!hasContext) {
          return;
        }

        const payload = {
          contextType: isYoutube() ? "youtube" : "webpage",
          videoTitle,
          channelName,
          subtitleText,
          pageHtml,
          snapshotDataUrl: videoSnapshotUrl || undefined,
          htmlQuestions: [] as string[],
        };

        const reqId = Date.now() + Math.random().toString(16);
        let cancelled = false;

        console.log("[What’sThat][AI] sending WT_AI_VIDEO_SUGGEST", {
          reqId,
          payloadSummary: {
            hasImage: !!payload.snapshotDataUrl,
            subtitleLen: payload.subtitleText.length,
          },
        });

        chrome.runtime.sendMessage(
          { type: "WT_AI_VIDEO_SUGGEST", payload, reqId },
          (resp: any) => {
            if (cancelled) return;

            if (chrome.runtime.lastError) {
              console.warn(
                "[What’sThat][AI] message error",
                chrome.runtime.lastError.message
              );
              return;
            }

            if (!resp || !resp.ok || !Array.isArray(resp.questions)) {
              console.warn("[What’sThat][AI] bad AI response", resp);
              return;
            }

            console.log(
              "[What’sThat][AI] got questions",
              resp.questions.map((q: any) => q.displayQuestion || q.userQuery)
            );
            setAiQuestions(resp.questions);
          }
        );

        return () => {
          cancelled = true;
        };
      }, [
        open,
        videoSnapshotUrl,
        subtitleText,
        videoTitle,
        channelName,
        pageHtml,
      ]);

      useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
          if (e.key === "Escape" && open) setOpen(false);
        };
        document.addEventListener("keydown", onKey, true);
        return () => document.removeEventListener("keydown", onKey, true);
      }, [open]);

      return (
        <Sidebar
          open={open}
          onClose={() => setOpen(false)}
          pageHtml={pageHtml}
          snapshotUrls={snapshotUrls}
          videoSnapshotUrl={videoSnapshotUrl}
          subtitleText={subtitleText}
          videoTitle={videoTitle}
          channelName={channelName}
          aiQuestions={aiQuestions}
        />
      );
    };

    createRoot(mountEl).render(<App />);
  }

  mountReact();
}