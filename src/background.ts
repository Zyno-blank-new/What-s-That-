// src/background.ts
import {
  generateQuestionsFromVideo,
  generateFullAnswer,
  type VideoSuggestPayload,
  type FullAnswerPayload,
  type AIQuestion,
  type AIAnswer,
} from "./ai/gemini";

async function toggleInActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.url) return;

  if (/^(chrome|chrome-extension|edge|about):/i.test(tab.url)) {
    console.warn("[What’sThat] Cannot run on:", tab.url);
    return;
  }

  chrome.tabs.sendMessage(tab.id, { type: "WT_TOGGLE" }, () => {
    if (chrome.runtime.lastError) {
      console.warn(
        "[What’sThat] WT_TOGGLE send failed:",
        chrome.runtime.lastError.message
      );
    }
  });
}

chrome.commands.onCommand.addListener((cmd) => {
  if (cmd === "toggle-sidebar") {
    toggleInActiveTab();
  }
});

chrome.action?.onClicked?.addListener(() => toggleInActiveTab());

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  try {
    if (msg?.type === "WT_REQUEST_CAPTURE") {
      const windowId = sender.tab?.windowId;

      if (windowId === undefined) {
        sendResponse({ ok: false, error: "No windowId" });
        return;
      }

      chrome.tabs.captureVisibleTab(
        windowId,
        { format: "png" },
        (dataUrl) => {
          if (chrome.runtime.lastError || !dataUrl) {
            console.warn(
              "[What’sThat] captureVisibleTab failed:",
              chrome.runtime.lastError?.message
            );
            sendResponse({ ok: false });
            return;
          }
          sendResponse({ ok: true, dataUrl });
        }
      );

      return true;
    }

    if (msg?.type === "WT_AI_VIDEO_SUGGEST") {
      const payload = msg.payload as VideoSuggestPayload;
      const reqId = msg.reqId;

      (async () => {
        try {
          console.log("[What’sThat][AI] background suggest start", {
            reqId,
            payloadSummary: {
              contextType: payload.contextType,
              hasImage: !!payload.snapshotDataUrl,
              subtitleLen: payload.subtitleText?.length ?? 0,
            },
          });

          const questions: AIQuestion[] = await generateQuestionsFromVideo(
            payload
          );

          console.log("[What’sThat][AI] background suggest done", {
            reqId,
            count: questions.length,
          });

          sendResponse({ ok: true, questions, reqId });
        } catch (err) {
          console.error("[What’sThat][AI] suggest error", err);
          sendResponse({
            ok: false,
            error: String(err),
            reqId,
          });
        }
      })();

      return true;
    }

    if (msg?.type === "WT_AI_FULL_ANSWER") {
      const payload = msg.payload as FullAnswerPayload;

      (async () => {
        try {
          const answer: AIAnswer = await generateFullAnswer(payload);

          sendResponse({
            ok: true,
            answer: answer.answer,
            shortAnswer: answer.shortAnswer,
            followUps: answer.followUps,
          });
        } catch (err) {
          console.error("[What’sThat][AI] full answer error", err);
          sendResponse({
            ok: false,
            error: String(err),
          });
        }
      })();

      return true;
    }
  } catch (e) {
    console.error("[What’sThat] background onMessage top-level error", e);
    try {
      sendResponse({ ok: false, error: String(e) });
    } catch {
    }
  }

  return false;
});