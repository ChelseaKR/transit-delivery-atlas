import Link from "next/link";
import { BUILD_DATE } from "@/lib/build-date";
import {
  directiveById,
  type WatchlistItem,
} from "@/lib/data";
import { formatDate } from "@/lib/format";
import { reviewCurrency, sourceDateCurrency } from "@/lib/watchlist-review.mjs";

function kindLabel(kind: WatchlistItem["kind"]) {
  return kind === "publication-checkpoint"
    ? "Publication checkpoint"
    : "Official context source";
}

function relationshipLabel(
  relationship: WatchlistItem["directiveLinks"][number]["relationship"],
) {
  switch (relationship) {
    case "process-adjacency":
      return "Process adjacency";
    case "publication-watch":
      return "Publication watch";
    default:
      return "Topic alignment";
  }
}

function boundaryReasonLabel(
  reason: WatchlistItem["evidenceBoundary"]["reason"],
) {
  return reason === "expected-artifact-not-published"
    ? "Expected artifact not yet published"
    : "No explicit order citation";
}

export function WatchlistCard({
  item,
  headingLevel = "h3",
}: {
  item: WatchlistItem;
  headingLevel?: "h3" | "h4";
}) {
  const Heading = headingLevel;
  const sourceDate = "sourceDate" in item ? item.sourceDate : undefined;
  // Currency is stated against the build date, never a render-time clock: this
  // page is static HTML that can sit unchanged at the edge for months.
  const review = reviewCurrency(item, BUILD_DATE);
  const sourceDateState = sourceDateCurrency(item, BUILD_DATE)?.state;

  return (
    <article
      className="watchlist-card"
      aria-labelledby={`watchlist-${item.id}-title`}
    >
      <p className="watchlist-card__boundary">
        Context only · Not implementation evidence
      </p>
      <Heading id={`watchlist-${item.id}-title`}>{item.title}</Heading>

      <dl className="watchlist-meta">
        <div>
          <dt>Item kind</dt>
          <dd>{kindLabel(item.kind)}</dd>
        </div>
        <div>
          <dt>Publisher</dt>
          <dd>{item.publisher}</dd>
        </div>
        <div>
          <dt>Official date</dt>
          <dd>
            {sourceDate ? (
              <>
                <time dateTime={sourceDate.value}>
                  {formatDate(sourceDate.value)}
                </time>
                <span>
                  {sourceDate.kind === "scheduled-event"
                    ? sourceDateState === "passed-unreviewed"
                      ? "Scheduled event date. The date has passed and the outcome has not been reviewed."
                      : "Scheduled event date"
                    : `${sourceDate.kind.replaceAll("-", " ")} date`}
                </span>
              </>
            ) : (
              <>
                No source date stated
                <span>Retrieval date is not substituted</span>
              </>
            )}
          </dd>
        </div>
        <div>
          <dt>Last Atlas review</dt>
          <dd>
            <time dateTime={item.lastReviewedOn}>
              {formatDate(item.lastReviewedOn)}
            </time>
            <span>
              Latest manual check of this source. Everything below states what
              was true on that date.
            </span>
          </dd>
        </div>
        <div className={review.overdue ? "watchlist-meta--overdue" : undefined}>
          <dt>{review.overdue ? "Review overdue" : "Next planned review"}</dt>
          <dd>
            <time dateTime={item.nextReviewOn}>
              {formatDate(item.nextReviewOn)}
            </time>
            <span>
              {review.overdue
                ? `Review due since ${formatDate(item.nextReviewOn)}, ${review.daysOverdue} day${review.daysOverdue === 1 ? "" : "s"} overdue at this build (${formatDate(review.buildDate)}).`
                : "Planned research checkpoint, not a deadline or a prediction that new material will exist."}
            </span>
          </dd>
        </div>
      </dl>

      <div className="watchlist-card__section">
        <h4>What the official source says</h4>
        <p>{item.editorialSummary}</p>
      </div>

      <div className="watchlist-card__section">
        <h4>Why it is being watched</h4>
        <p>{item.whyTracked}</p>
      </div>

      <div className="watchlist-card__section">
        <h4>Related directives (editorial)</h4>
        <ul className="watchlist-mapping-list">
          {item.directiveLinks.map((link) => {
            const directive = directiveById(link.directiveId);
            return (
              <li key={link.directiveId}>
                {directive ? (
                  <Link href={`/directives/${directive.id}`}>
                    Directive {directive.label}: {directive.title}
                  </Link>
                ) : (
                  link.directiveId
                )}
                <span>{relationshipLabel(link.relationship)}</span>
                <p>{link.rationale}</p>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="watchlist-card__section watchlist-card__exclusion">
        <h4>Why it is outside the evidence layer</h4>
        <p>
          <strong>{boundaryReasonLabel(item.evidenceBoundary.reason)}.</strong>{" "}
          {item.evidenceBoundary.note}
        </p>
      </div>

      <div className="watchlist-card__section">
        <h4>What the next review will look for</h4>
        {review.overdue ? (
          <p className="watchlist-card__overdue-note">
            That review has not happened yet. These statements are what the next
            review will check, not findings.
          </p>
        ) : null}
        <ul>
          {item.watchFor.map((statement) => (
            <li key={statement}>{statement}</li>
          ))}
        </ul>
      </div>

      <details className="watchlist-card__limitations">
        <summary>Limitations</summary>
        <ul>
          {item.limitations.map((limitation) => (
            <li key={limitation}>{limitation}</li>
          ))}
        </ul>
      </details>

      <div className="watchlist-card__links">
        <a href={item.url} rel="noreferrer">
          Open official source <span aria-hidden="true">↗</span>
        </a>
        {item.relatedUrls.map((relatedUrl) => (
          <a key={relatedUrl.url} href={relatedUrl.url} rel="noreferrer">
            {relatedUrl.label} <span aria-hidden="true">↗</span>
          </a>
        ))}
      </div>
    </article>
  );
}
