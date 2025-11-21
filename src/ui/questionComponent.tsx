// src/ui/questionComponent.tsx
import type { QuestionProps } from "./questions";

type QuestionComponentProps = {
  question: QuestionProps;
  onUpdate: (q: QuestionProps) => void;
};

export function QuestionComponent({ question, onUpdate }: QuestionComponentProps) {
  const { title, description } = question;

  const goToAnswer = () => {
    onUpdate(question);
  };

  return (
    <div onClick={goToAnswer} className="wt-question">
      <div className="wt-question-title">{title}</div>
      <div className="wt-question-desc">{description}</div>
    </div>
  );
}