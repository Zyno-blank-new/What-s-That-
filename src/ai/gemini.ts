// src/ai/gemini.ts

const GEMINI_API_KEY = "******************";
const GEMINI_MODEL = "gemini-2.5-flash-lite";

export type AIQuestion = {
  id?: string;
  displayQuestion?: string;
  previewAnswer?: string;
  userQuery?: string;
  question?: string;
  source?:
    | "onscreen_question"
    | "subtitle_question"
    | "model_inferred"
    | "page_question"
    | "video_ai";
  priority?: number;
};

export type VideoSuggestPayload = {
  contextType: "youtube" | "webpage";
  videoTitle?: string;
  channelName?: string;
  subtitleText?: string;
  pageHtml?: string;
  snapshotDataUrl?: string;
  htmlQuestions?: string[];
};

type GeminiSuggestResponse = {
  questions: AIQuestion[];
};

export type FollowUpQuestion = {
  id: string;
  displayQuestion: string;
  userQuery: string;
};

export type AIAnswer = {
  answer: string;
  shortAnswer?: string;
  followUps: FollowUpQuestion[];
};

export type FullAnswerPayload = {
  contextType: "youtube" | "webpage";
  userQuery: string;
  videoTitle?: string;
  channelName?: string;
  subtitleText?: string;
  pageHtml?: string;
  snapshotDataUrl?: string;
};

function extractJsonObject(raw: string): any {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)```$/i);
  return JSON.parse(fenced ? fenced[1].trim() : trimmed);
}

export async function generateQuestionsFromVideo(
  payload: VideoSuggestPayload
): Promise<AIQuestion[]> {
  if (!GEMINI_API_KEY) return [];

  const parts: any[] = [];

  const schemaExample: GeminiSuggestResponse = {
    questions: [
      {
        id: "q1",
        displayQuestion: "What does 'void, excess energy' mean here?",
        previewAnswer:
          "It refers to a hypothetical field of energy that is unstable unless it settles into a lower-energy configuration.",
        userQuery:
          "Explain the phrase 'void, excess energy' as used in this video frame and the last 10 seconds of subtitles.",
        source: "model_inferred",
        priority: 0.9,
      },
    ],
  };

  const systemPrompt = `
You generate *high-quality, curiosity-driven* questions based on:
- 1 video frame image
- last ~10 seconds of subtitles
- video title + channel
- optional viewport HTML
- optional existing HTML questions

You MUST focus ONLY on concepts, explanations, meaning, graphs, diagrams, and ideas.
IGNORE:
- UI buttons
- streaming logos
- slogans (“Count on Sundays”)
- decorative background elements
- watermarks

You return:
- 3 to 10 questions
- each with id, displayQuestion, previewAnswer, userQuery, source, priority
- STRICT JSON ONLY matching:
${JSON.stringify(schemaExample, null, 2)}
`;

  parts.push({ text: systemPrompt });

  if (payload.snapshotDataUrl) {
    parts.push({
      inlineData: {
        mimeType: "image/png",
        data: payload.snapshotDataUrl.replace(/^data:image\/\w+;base64,/, ""),
      },
    });
  }

  const contextObj = {
    contextType: payload.contextType,
    videoTitle: payload.videoTitle || "",
    channelName: payload.channelName || "",
    subtitleText: payload.subtitleText || "",
    pageHtml: (payload.pageHtml || "").slice(0, 4000),
    htmlQuestions: payload.htmlQuestions || [],
  };

  parts.push({
    text: "CONTEXT (JSON):\n" + JSON.stringify(contextObj, null, 2),
  });

  const body = {
    contents: [{ role: "user", parts }],
    generationConfig: { temperature: 0.4, maxOutputTokens: 768 },
  };

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
  );

  const text = await res.text();
  if (!res.ok) {
    return [
      {
        id: "ai-debug",
        displayQuestion: "AI error",
        previewAnswer: text.slice(0, 500),
        userQuery: "",
        source: "video_ai",
        priority: 0,
      },
    ];
  }

  let apiJson;
  try {
    apiJson = JSON.parse(text);
  } catch {
    return [
      {
        id: "ai-parse-error",
        displayQuestion: "Parse error",
        previewAnswer: text.slice(0, 500),
        userQuery: "",
        source: "video_ai",
        priority: 0,
      },
    ];
  }

  const raw =
    apiJson?.candidates?.[0]?.content?.parts?.map((p: any) => p.text || "").join("") ||
    "";

  if (!raw.trim()) return [];

  let parsed: GeminiSuggestResponse;
  try {
    parsed = extractJsonObject(raw);
  } catch {
    return [
      {
        id: "ai-inner",
        displayQuestion: "AI inner parse error",
        previewAnswer: raw.slice(0, 500),
        userQuery: "",
        source: "video_ai",
        priority: 0,
      },
    ];
  }

  return parsed.questions.map((q, i) => ({
    id: q.id || `ai-${i + 1}`,
    displayQuestion: q.displayQuestion || q.question || `Question ${i + 1}`,
    previewAnswer: q.previewAnswer || "",
    userQuery: q.userQuery || q.displayQuestion || q.question || "Explain this.",
    source: q.source || "video_ai",
    priority: typeof q.priority === "number" ? q.priority : 0.5,
  }));
}


export async function generateFullAnswer(
  payload: FullAnswerPayload
): Promise<AIAnswer> {
  if (!GEMINI_API_KEY) {
    return {
      answer: "AI not configured.",
      shortAnswer: "AI not configured.",
      followUps: [],
    };
  }

  const parts: any[] = [];
  const qLower = payload.userQuery.toLowerCase();
  const subtitleFocused =
    qLower.includes("last 10 seconds") ||
    qLower.includes("last ten seconds") ||
    qLower.includes("what was said") ||
    qLower.includes("what did he say") ||
    qLower.includes("what did she say") ||
    qLower.includes("what did they say") ||
    qLower.includes("summarize what was said") ||
    qLower.includes("summarise what was said") ||
    qLower.includes("summarize the last") ||
    qLower.includes("summarise the last");

  const systemPrompt = `
You produce **two-layered answers**:

============================================================
1. DETERMINE MODE AND USE SUBTITLES WHEN ASKED
============================================================

A) GENERIC MODE — default  
Use when the question is not tied to the specific frame/image and is a general knowledge question.

B) SCENE-LOCAL MODE — ONLY when the question explicitly references:
   "this image", "this frame", "this graph", "this chart", "here", "on screen", "this screenshot"

If the user asks things like:
- "Can you summarize what was said in the last 10 seconds?"
- "What did they say just now?"
- "Summarize the last 10 seconds of dialogue."

then:
- You MUST treat this as GENERIC with respect to knowledge mode.
- You MUST base your answer primarily on the "subtitleText" field in CONTEXT (it represents the last ~10 seconds of speech).
- You MUST NOT describe the pause screen, play button, timeline, or other UI.
- You MUST answer as a transcript summary: what was said and what it meant.

In SCENE-LOCAL mode:
   - Give at most 1–2 sentences describing the visible image.
   - Then focus on INTERPRETATION:
       * What idea does the image communicate?
       * Why does it matter?
       * What concept does it illustrate?
   - Never produce long pixel-level descriptions.

============================================================
2. OUTPUT TWO ANSWERS
============================================================

1) shortAnswer — 1–2 sentences OR max 3 bullets  
   <= 40 words  
   A fast skim answer.

2) answer — detailed Markdown answer (~200 words max)  
   Must use:
      - **bold headers**
      - short paragraphs
      - "- " bullet points
   In subtitle-focused questions, clearly summarize what was said and its meaning.

============================================================
3. FOLLOW-UPS
============================================================
Return exactly 3 curiosity-driven follow-up questions.

============================================================
4. STRICT JSON OUTPUT
============================================================

{
  "mode": "...",
  "shortAnswer": "...",
  "answer": "...",
  "followUps": [
    { "id": "f1", "displayQuestion": "...", "userQuery": "..." },
    { "id": "f2", "displayQuestion": "...", "userQuery": "..." },
    { "id": "f3", "displayQuestion": "...", "userQuery": "..." }
  ]
}
`;

  parts.push({ text: systemPrompt });

  parts.push({
    text: "USER QUESTION:\n" + JSON.stringify({ userQuery: payload.userQuery }, null, 2),
  });

  if (payload.snapshotDataUrl && !subtitleFocused) {
    parts.push({
      inlineData: {
        mimeType: "image/png",
        data: payload.snapshotDataUrl.replace(/^data:image\/\w+;base64,/, ""),
      },
    });
  }

  const ctxObj = {
    contextType: payload.contextType,
    videoTitle: payload.videoTitle || "",
    channelName: payload.channelName || "",
    subtitleText: payload.subtitleText || "",
    pageHtml: (payload.pageHtml || "").slice(0, 4000),
  };

  parts.push({
    text: "CONTEXT (JSON):\n" + JSON.stringify(ctxObj, null, 2),
  });

  const body = {
    contents: [{ role: "user", parts }],
    generationConfig: { temperature: 0.5, maxOutputTokens: 1024 },
  };

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
  );

  const text = await res.text();
  if (!res.ok) {
    return {
      answer: "AI service error:\n" + text.slice(0, 1000),
      shortAnswer: "AI service error.",
      followUps: [],
    };
  }

  let apiJson;
  try {
    apiJson = JSON.parse(text);
  } catch {
    return {
      answer: "Malformed AI response:\n" + text.slice(0, 500),
      shortAnswer: "Malformed AI response.",
      followUps: [],
    };
  }

  const raw =
    apiJson?.candidates?.[0]?.content?.parts?.map((p: any) => p.text || "").join("") ||
    "";

  if (!raw.trim()) {
    return {
      answer: "Empty AI response.",
      shortAnswer: "No answer returned.",
      followUps: [],
    };
  }

  let parsed;
  try {
    parsed = extractJsonObject(raw);
  } catch {
    return {
      answer: "Failed to parse AI JSON.\n" + raw.slice(0, 1000),
      shortAnswer: "Failed to parse AI JSON.",
      followUps: [],
    };
  }

  const finalAnswer = parsed.answer?.trim() || "No answer extracted.";
  const finalShort =
    parsed.shortAnswer?.trim() ||
    finalAnswer.split(".")[0].trim();

  const followUps: FollowUpQuestion[] = (parsed.followUps || [])
    .filter((f: any) => f.displayQuestion)
    .map((f: any, i: number) => ({
      id: f.id || `f${i + 1}`,
      displayQuestion: f.displayQuestion.trim(),
      userQuery: f.userQuery?.trim() || f.displayQuestion.trim(),
    }));

  return {
    answer: finalAnswer,
    shortAnswer: finalShort,
    followUps,
  };
}