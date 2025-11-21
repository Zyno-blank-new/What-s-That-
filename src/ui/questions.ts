// src/ui/questions.ts
export type QuestionProps = {
  id: string;
  title: string;
  description: string;
  userQuery?: string;
  snapshotUrl?: string;
};

const QUESTIONS: QuestionProps[] = [
  {
    id: "q1",
    title: "What is happening in this scene?",
    description:
      "Analyze the current visual or action and explain what’s occurring in the video frame.",
  },
  {
    id: "q2",
    title: "Who or what is being shown right now?",
    description:
      "Identify the main subject or object currently visible on screen.",
  },
  {
    id: "q3",
    title: "Why did the speaker mention this concept here?",
    description:
      "Explain the relevance of the mentioned concept within the current context.",
  },
  {
    id: "q4",
    title: "Can you summarize what was said in the last 10 seconds?",
    description:
      "Provide a concise summary of the recent spoken content or caption text.",
  },
];

export default QUESTIONS;