"use client";

import { useId, useRef, useState } from "react";
import {
  createAskClient,
  type AskAnswer,
  type AskBlock,
  type AskState,
} from "@/lib/ask-client";
import { formatDate } from "@/lib/format";

/**
 * The explicit opt-in for the question service (ADR-0002).
 *
 * Until the reader opens the panel and submits a question, this component
 * renders static markup and performs no request of any kind. Every response
 * state — answer, refusal, rate limit, service absent — renders inside the
 * panel and leaves the rest of the page untouched.
 */

interface AskDirectiveProps {
  directiveId: string;
  directiveLabel: string;
}

function AnswerBlockView({ block }: { block: AskBlock }) {
  switch (block.type) {
    case "text":
      return <p className="ask-answer__text">{block.text}</p>;
    case "quote":
      return (
        <figure className="ask-answer__quote">
          <blockquote>“{block.text}”</blockquote>
          <figcaption>
            {block.label} · <a href={block.sourceUrl} rel="noreferrer">verify in the signed PDF, page {block.pages[0]}</a> · quotation verified against the retained corpus
          </figcaption>
        </figure>
      );
    case "evidence":
      return (
        <div className="ask-answer__evidence">
          <p className="utility-label">Reviewed public artifact</p>
          <p>
            <a href={block.url} rel="noreferrer">{block.title}</a>
          </p>
          <p>
            {block.publisher} · dated {formatDate(block.datedOn)} ({block.dateKind}) · Atlas last reviewed{" "}
            <time dateTime={block.lastReviewedOn}>{formatDate(block.lastReviewedOn)}</time> · cites: “{block.citation}” (pages {block.pages.join(", ")})
          </p>
          <ul>
            {block.limitations.map((limitation) => (
              <li key={limitation}>{limitation}</li>
            ))}
          </ul>
        </div>
      );
    case "empty-state":
      return (
        <div className="ask-answer__empty">
          <p className="utility-label">Directive {block.label} · evidence coverage</p>
          <p>{block.statement}</p>
        </div>
      );
    case "freshness":
      return (
        <div className="ask-answer__freshness">
          <p className="utility-label">How current this is</p>
          <ul>
            {block.items.map((item) => (
              <li key={item.directiveId}>
                Directive {item.label}:{" "}
                {item.evidence.length > 0
                  ? `${item.evidence.length} linked record(s), last reviewed ${item.evidence
                      .map(({ lastReviewedOn }) => formatDate(lastReviewedOn))
                      .join("; ")}. `
                  : ""}
                Sources {item.sourcesLastCheckedOn ? `last checked ${formatDate(item.sourcesLastCheckedOn)}` : "not yet successfully checked"}; next planned check{" "}
                {formatDate(item.nextReviewOn)}.
              </li>
            ))}
          </ul>
        </div>
      );
    default:
      return null;
  }
}

function AnswerView({ answer }: { answer: AskAnswer }) {
  return (
    <div className="ask-answer" aria-live="polite">
      <p className="ask-answer__label">
        AI-generated · unofficial · not a compliance determination
      </p>
      {answer.kind === "refusal" && answer.refusal ? (
        <>
          <p className="ask-answer__text">{answer.refusal.text}</p>
          <ul className="ask-answer__pointers">
            {answer.refusal.pointers.map((pointer) => (
              <li key={pointer.href}>
                <a href={pointer.href}>{pointer.label}</a>
              </li>
            ))}
          </ul>
        </>
      ) : (
        answer.blocks.map((block, index) => <AnswerBlockView key={index} block={block} />)
      )}
      {answer.withheld.count > 0 ? (
        <p className="ask-answer__withheld">
          {answer.withheld.count} claim{answer.withheld.count === 1 ? "" : "s"} from the model{" "}
          {answer.withheld.count === 1 ? "was" : "were"} withheld because the verifier could not back{" "}
          {answer.withheld.count === 1 ? "it" : "them"} with the retained order text or a reviewed record.
        </p>
      ) : null}
      <p className="ask-answer__provenance">
        {answer.labels.notice} Model: {answer.provenance.model} · prompt {answer.provenance.promptVersion} · answered{" "}
        {answer.provenance.generatedAt.slice(0, 10)}.
      </p>
    </div>
  );
}

export function AskDirective({ directiveId, directiveLabel }: AskDirectiveProps) {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState<AskState | null>(null);
  const clientRef = useRef<ReturnType<typeof createAskClient> | null>(null);
  const inputId = useId();

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy || question.trim() === "") return;
    // The client is created on first submit: before that, this component has
    // performed no request and holds no connection.
    clientRef.current ??= createAskClient({
      endpoint: process.env.NEXT_PUBLIC_ASK_ENDPOINT || undefined,
    });
    setBusy(true);
    try {
      setState(await clientRef.current.ask(question.trim(), directiveId));
    } finally {
      setBusy(false);
    }
  }

  return (
    <aside className="ask-directive" aria-labelledby={`${inputId}-title`} data-ask-directive={directiveId}>
      <p className="ask-directive__badge">Optional · AI · off until you use it</p>
      <h2 id={`${inputId}-title`}>Ask about this directive</h2>
      {!open ? (
        <>
          <p>
            An optional AI layer can answer questions about directive {directiveLabel} from this
            record only: the order&apos;s reviewed language, the named bodies, the timing, and the
            reviewed evidence or its explicit absence. It refuses compliance and status questions.
            Nothing is sent anywhere until you submit a question.
          </p>
          <button type="button" className="ask-directive__open" onClick={() => setOpen(true)}>
            Ask a question (AI, unofficial)
          </button>
        </>
      ) : (
        <form onSubmit={submit} className="ask-directive__form">
          <label htmlFor={inputId}>
            Your question about directive {directiveLabel}. It is sent to this site&apos;s question
            service and not stored; answers are AI-generated, unofficial, and never a compliance
            determination.
          </label>
          <textarea
            id={inputId}
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            maxLength={600}
            rows={3}
            placeholder="For example: What does the order require here, and by when? What evidence is linked?"
          />
          <div className="ask-directive__actions">
            <button type="submit" disabled={busy || question.trim() === ""}>
              {busy ? "Asking…" : "Ask"}
            </button>
            <button type="button" onClick={() => setOpen(false)} disabled={busy}>
              Close
            </button>
          </div>
        </form>
      )}
      {state ? (
        state.status === "answered" ? (
          <AnswerView answer={state.answer} />
        ) : (
          <p className={`ask-directive__notice ask-directive__notice--${state.status}`} aria-live="polite">
            {state.message}
          </p>
        )
      ) : null}
    </aside>
  );
}
