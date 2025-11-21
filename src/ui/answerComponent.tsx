// src/ui/answerComponent.tsx

export type FollowUpQuestion = {
  id: string;
  displayQuestion: string;
  userQuery: string;
};

type AnswerProps = {
  title: string;
  summary: string;
  description: string; 
  image: string | null;
  followUps: FollowUpQuestion[];
  onFollowUp: (fq: FollowUpQuestion) => void;
  onBack: () => void;
  isLoading: boolean;
  loadingTip?: string;
};


function renderMarkdownToHtml(md: string): string {
  if (!md) return "";

  const escapeHtml = (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt/")
      .replace(/>/g, "&gt;");

  const lines = md.split(/\r?\n/);
  const htmlParts: string[] = [];
  let inList = false;

  const closeListIfNeeded = () => {
    if (inList) {
      htmlParts.push("</ul>");
      inList = false;
    }
  };

  for (let rawLine of lines) {
    let line = rawLine.trimEnd();

    if (!line.trim()) {
      closeListIfNeeded();
      continue;
    }

    if (/^[-*]\s+/.test(line)) {
      const text = line.replace(/^[-*]\s+/, "");
      if (!inList) {
        htmlParts.push("<ul>");
        inList = true;
      }
      const escaped = escapeHtml(text);
      const withBold = escaped.replace(
        /\*\*(.+?)\*\*/g,
        "<strong>$1</strong>"
      );
      htmlParts.push(`<li>${withBold}</li>`);
      continue;
    }

    closeListIfNeeded();
    const escaped = escapeHtml(line);
    const withBold = escaped.replace(
      /\*\*(.+?)\*\*/g,
      "<strong>$1</strong>"
    );
    htmlParts.push(`<p>${withBold}</p>`);
  }

  closeListIfNeeded();
  return htmlParts.join("\n");
}

export function Answer({
  title,
  summary,
  description,
  image,
  followUps,
  onFollowUp,
  onBack,
  isLoading,
  loadingTip,
}: AnswerProps) {
  if (isLoading) {
    return (
      <div className="wt-answer-section">
        <header className="wt-answer-header" onClick={onBack}>
          <svg
            className="wt-back-arrow"
            fill="#a2a2a2"
            viewBox="0 0 52 52"
            aria-hidden="true"
          >
            <g>
              <path d="M38,52a2,2,0,0,1-1.41-.59l-24-24a2,2,0,0,1,0-2.82l24-24a2,2,0,0,1,2.82,0,2,2,0,0,1,0,2.82L16.83,26,39.41,48.59A2,2,0,0,1,38,52Z" />
            </g>
          </svg>
          <p className="wt-back">Back</p>
        </header>

        <section className="wt-answer-section">
          <div className="wt-answer-title">{title}</div>

          <div className="wt-loader-wrap">
            <div className="wt-loader-orbit">
              <div className="wt-loader-dot wt-loader-dot-1" />
              <div className="wt-loader-dot wt-loader-dot-2" />
              <div className="wt-loader-dot wt-loader-dot-3" />
            </div>

            <div className="wt-loader-title">
              Crafting your explanation…
            </div>
            <div className="wt-loader-sub">
              Reading the scene, recalling concepts, lining up examples.
            </div>

            {loadingTip && (
              <div className="wt-loader-tip">
                Tip: {loadingTip}
              </div>
            )}
          </div>
        </section>
      </div>
    );
  }

  const html = renderMarkdownToHtml(description);

  return (
    <div className="wt-answer-section">
      <header className="wt-answer-header" onClick={onBack}>
        <svg
          className="wt-back-arrow"
          fill="#a2a2a2"
          viewBox="0 0 52 52"
          aria-hidden="true"
        >
          <g>
            <path d="M38,52a2,2,0,0,1-1.41-.59l-24-24a2,2,0,0,1,0-2.82l24-24a2,2,0,0,1,2.82,0,2,2,0,0,1,0,2.82L16.83,26,39.41,48.59A2,2,0,0,1,38,52Z" />
          </g>
        </svg>
        <p className="wt-back">Back</p>
      </header>

      <section className="wt-answer-section">
        <div className="wt-answer-title">{title}</div>

        {image && (
          <div className="wt-answer-image-wrap">
            <img
              src={image}
              alt="Answer related"
              className="wt-answer-image"
            />
          </div>
        )}

        {summary && (
          <div className="wt-summary-card">
            <div className="wt-summary-label">Quick answer</div>
            <div className="wt-summary-text">{summary}</div>
          </div>
        )}

        <div className="wt-detail-label">Deep dive</div>
        <div
          className="wt-answer"
          dangerouslySetInnerHTML={{ __html: html }}
        />

        {followUps && followUps.length > 0 && (
          <div className="wt-followups">
            <div className="wt-followups-label">Follow-up questions</div>

            <div className="wt-followups-list">
              {followUps.map((fq) => (
                <div
                  key={fq.id}
                  className="wt-question wt-followup-question"
                  onClick={() => onFollowUp(fq)}
                >
                  <div className="wt-question-title">
                    {fq.displayQuestion}
                  </div>
                  <div className="wt-question-desc">
                    Tap to dig deeper into this.
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}