// src/ui/Sidebar.tsx

declare const chrome: any;

import { useState } from "react";
import { QuestionList } from "./questionListComponent";
import QUESTIONS, { type QuestionProps } from "./questions";
import { Answer, type FollowUpQuestion } from "./answerComponent";
import type { AIQuestion, AIAnswer } from "../ai/gemini";

type Props = {
  open: boolean;
  onClose: () => void;
  pageHtml: string;
  snapshotUrls: string[];
  videoSnapshotUrl: string | null;
  subtitleText: string;
  videoTitle: string;
  channelName: string;
  aiQuestions: AIQuestion[];
};

type SidebarQuestion = QuestionProps & {
  userQuery?: string;
  kind?: "ai" | "static" | "image";
  imageUrl?: string | null;
};

export default function Sidebar({
  open,
  onClose,
  pageHtml,
  snapshotUrls,
  videoSnapshotUrl,
  subtitleText,
  videoTitle,
  channelName,
  aiQuestions,
}: Props) {
  const [isAnswerOpen, setIsAnswerOpen] = useState(false);
  const [loadingAnswer, setLoadingAnswer] = useState(false);
  const [selectedQuestion, setSelectedQuestion] =
    useState<SidebarQuestion | null>(null);
  const [fullAnswer, setFullAnswer] = useState<AIAnswer | null>(null);
  const [loadingTip, setLoadingTip] = useState<string | null>(null);

  const loadingTips: string[] = [
    "Pro tip: pausing the video and asking 'why?' is one of the fastest ways to learn.",
    "Your brain loves patterns. While we think, try to guess what the answer might be.",
    "Micro-learning works best: short bursts of focus beat long, tired study sessions.",
    "If something feels confusing, you are closer to understanding than you think.",
    "Explaining a concept to someone else (or to yourself aloud) locks it into memory.",
    "The best questions usually start with 'why' or 'how', not 'what'.",
    "Small consistent progress beats last-minute cramming almost every time.",
  ];

  const pickRandomTip = () =>
    loadingTips[Math.floor(Math.random() * loadingTips.length)];

  const safeSubtitle = (subtitleText || "").trim() || "no record";

  const aiQuestionProps: SidebarQuestion[] = [...aiQuestions]
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))
    .map((q, idx) => ({
      id: q.id || `ai-${idx + 1}`,
      title: q.displayQuestion || q.userQuery || `Question ${idx + 1}`,
      description: q.previewAnswer || "AI suggested question",
      userQuery: q.userQuery,
      kind: "ai",
    }));

  const staticQuestionProps: SidebarQuestion[] = QUESTIONS.map((q) => ({
    ...q,
    kind: "static",
  }));

  const combinedQuestions: SidebarQuestion[] = [
    ...aiQuestionProps,
    ...staticQuestionProps,
  ];
  

  const handleUpdate = (q: SidebarQuestion) => {
    setSelectedQuestion(q);
    setIsAnswerOpen(true);
    setFullAnswer(null);
    setLoadingAnswer(true);
    setLoadingTip(pickRandomTip());

    const isImage = q.kind === "image";
    const snapshotDataUrl = isImage
      ? q.imageUrl || undefined
      : videoSnapshotUrl || undefined;

    const userQuery =
      q.userQuery && q.userQuery.trim().length > 0
        ? q.userQuery
        : q.title;

    chrome.runtime.sendMessage(
      {
        type: "WT_AI_FULL_ANSWER",
        payload: {
          contextType: "youtube",
          userQuery,
          videoTitle: isImage ? "" : videoTitle,
          channelName: isImage ? "" : channelName,
          subtitleText: isImage ? "" : subtitleText,
          pageHtml: isImage ? "" : pageHtml,
          snapshotDataUrl,
        },
      },
      (resp: any) => {
        setLoadingAnswer(false);
        setLoadingTip(null);

        if (chrome.runtime.lastError) {
          console.warn(
            "[What’sThat][AI] full answer message error",
            chrome.runtime.lastError.message
          );
          setFullAnswer({
            answer: "AI failed to respond. Please try again.",
            shortAnswer: "The AI could not respond right now.",
            followUps: [],
          });
          return;
        }

        if (resp?.ok && typeof resp.answer === "string") {
          const answerObj: AIAnswer = {
            answer: resp.answer,
            shortAnswer:
              typeof resp.shortAnswer === "string"
                ? resp.shortAnswer
                : undefined,
            followUps: Array.isArray(resp.followUps) ? resp.followUps : [],
          };
          setFullAnswer(answerObj);
        } else {
          setFullAnswer({
            answer: "AI failed to produce an answer.",
            shortAnswer: "No valid answer was produced.",
            followUps: [],
          });
        }
      }
    );
  };

  const handleBack = () => {
    setIsAnswerOpen(false);
    setSelectedQuestion(null);
    setFullAnswer(null);
    setLoadingAnswer(false);
    setLoadingTip(null);
  };

  return (
    <>
      <div
        className={`wt-backdrop ${open ? "open" : ""}`}
        onClick={onClose}
      />

      <aside
        className={`wt-panel ${open ? "open" : ""}`}
        role="dialog"
        aria-modal="true"
      >
        <header className="wt-header">
          <div className="wt-title">What’s That?</div>
          <button className="wt-close" onClick={onClose}>
            ✕
          </button>
        </header>

        <div className="wt-body">
          {isAnswerOpen && selectedQuestion ? (
            <Answer
              title={selectedQuestion.title}
              summary={
                fullAnswer?.shortAnswer || selectedQuestion.description
              }
              description={
                fullAnswer?.answer || selectedQuestion.description
              }
              image={
                selectedQuestion.kind === "image"
                  ? selectedQuestion.imageUrl || null
                  : null
              }
              followUps={fullAnswer?.followUps || []}
              onFollowUp={(fq: FollowUpQuestion) =>
                handleUpdate({
                  id: fq.id,
                  title: fq.displayQuestion,
                  description: "",
                  userQuery: fq.userQuery,
                  kind: "ai",
                })
              }
              onBack={handleBack}
              isLoading={loadingAnswer}
              loadingTip={loadingTip || undefined}
            />
          ) : (
            <>
              <QuestionList
                questions={combinedQuestions}
                onUpdateParent={(q) => handleUpdate(q as SidebarQuestion)}
              />

              {videoSnapshotUrl && (
                <section className="wt-snapshot-section">
                  <div className="wt-snapshot-label">Current video frame</div>
                  <img
                    src={videoSnapshotUrl}
                    alt="Captured video frame"
                    className="wt-snapshot-video"
                  />
                </section>
              )}

              <section className="wt-subtitle-section">
                <div className="wt-subtitle-label">
                  Last 10 seconds subtitles
                </div>
                <div className="wt-subtitle-box">{safeSubtitle}</div>
              </section>

              {snapshotUrls.length > 0 && (
                <section className="wt-snapshot-section">
                  <div className="wt-snapshot-label">
                    Images on screen – tap to explain
                  </div>
                  <div className="wt-snapshot-grid">
                    {snapshotUrls.map((url, i) => (
                      <div
                        key={i}
                        className="wt-snapshot-img-wrap"
                        onClick={() =>
                          handleUpdate({
                            id: `img-${i + 1}`,
                            title: "What is this image showing?",
                            description:
                              "Tap to see a detailed explanation of this image.",
                            userQuery: `Provide a complete, self-contained explanation of this image.
Step 1 — Describe: Give a clear visual description of everything visible (layout, objects, people, text, colours, structure).
Step 2 — Identify: Identify any recognizable people, brands, logos, symbols, UI elements, diagrams, or data visualizations. If it is a chart or graph, explain the axes, labels, units, data patterns, and what the chart is communicating. If it is a map, explain locations and meaning. If it is a UI screen, explain the interface elements and their purpose.
Step 3 — Interpret: Explain what the image is most likely about, what message or purpose it serves, and why it may matter or be interesting to a viewer.
Make the explanation detailed, helpful, and correct, even if context outside the image is required.`,
                            kind: "image",
                            imageUrl: url,
                          })
                        }
                      >
                        <img
                          src={url}
                          alt={`Captured media ${i + 1}`}
                          className="wt-snapshot-img"
                        />
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* {pageHtml && (
                <section className="wt-html-section">
                  <div className="wt-html-label">Viewport HTML</div>
                  <pre className="wt-html-block">{pageHtml}</pre>
                </section>
              )} */}
            </>
          )}
        </div>
      </aside>
    </>
  );
}