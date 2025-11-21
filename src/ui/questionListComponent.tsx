// src/ui/questionListComponent.tsx
import { QuestionComponent } from "./questionComponent";
import type { QuestionProps } from "./questions";

type QuestionListProps = {
  questions: QuestionProps[];
  onUpdateParent: (q: QuestionProps) => void;
};

export function QuestionList({ questions, onUpdateParent }: QuestionListProps) {
  const onUpdate = (question: QuestionProps) => {
    onUpdateParent(question);
  };

  return (
    <div>
      {questions.map((q) => (
        <QuestionComponent
          key={q.id}
          question={q}
          onUpdate={onUpdate}
        />
      ))}
    </div>
  );
}