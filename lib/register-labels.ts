/**
 * Provenance labelling for the directive register.
 *
 * The register on `/` is the one surface most readers see, and it was the one
 * surface where the layer discipline the rest of the site enforces was dropped:
 * a bare `E 0` on 20 of 21 rows (which reads as "nothing is happening on 20 of
 * 21 directives", the inference the methodology exists to refuse), and a
 * calculated planning date sitting under an aria label that said it came from
 * the signed order.
 *
 * These builders are the only way a row gets a label, and they throw rather
 * than return a partial one, so a row that cannot be labelled fails the build
 * instead of rendering unlabelled.
 */

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export interface RegisterTiming {
  sourceText: string;
  derivedDate: string;
  derivation: string;
  appliesTo: string;
}

/** Absence, stated as absence rather than as a count of zero. */
export const NO_EVIDENCE_LABEL =
  "No reviewed evidence linked in this release. This is a statement about Atlas coverage, not evidence that no implementation activity or public record exists.";

function requireText(value: unknown, field: string, context: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(
      `${context} cannot be labelled: ${field} is missing. A register row without its provenance labels must not render.`,
    );
  }
  return value;
}

/**
 * The evidence cell: the digit where there is evidence, an em dash where there
 * is none. `E 0` is a count; `E —` is an empty state.
 */
export function evidenceCell(
  evidenceCount: number,
  context: string,
): { text: string; detail: string; hasEvidence: boolean } {
  if (!Number.isInteger(evidenceCount) || evidenceCount < 0) {
    throw new Error(
      `${context} cannot be labelled: evidence count ${JSON.stringify(evidenceCount)} is not a record count. A register row without its provenance labels must not render.`,
    );
  }

  return evidenceCount === 0
    ? { text: "E —", detail: NO_EVIDENCE_LABEL, hasEvidence: false }
    : {
        text: `E ${evidenceCount}`,
        detail: `${evidenceCount} reviewed public ${evidenceCount === 1 ? "artifact is" : "artifacts are"} linked to this directive in the current Atlas release.`,
        hasEvidence: true,
      };
}

/**
 * The row's provenance sentence, carrying the same three layers the detail page
 * names in full.
 */
export function provenanceSentence(directive: {
  label: string;
  evidenceCount: number;
}): string {
  const label = requireText(directive.label, "label", "A directive register row");
  const evidence = evidenceCell(directive.evidenceCount, `Directive ${label}`);

  return `Directive ${label}: source reviewed. ${evidence.detail} Independent analysis available.`;
}

/**
 * What a derived planning date is, said where the date is shown.
 *
 * The register renders `derivedDate`, which is the Atlas's arithmetic, not
 * text from the order. The export column is named `calculated_planning_dates`
 * and the detail page labels it that way; the register has to as well.
 */
export function timingDetail(timing: RegisterTiming, context: string): string {
  const sourceText = requireText(timing.sourceText, "timing source text", context);
  const derivation = requireText(timing.derivation, "timing derivation", context);
  const appliesTo = requireText(timing.appliesTo, "timing applies-to", context);
  const derivedDate = requireText(timing.derivedDate, "timing derived date", context);

  if (!ISO_DATE_PATTERN.test(derivedDate)) {
    throw new Error(
      `${context} cannot be labelled: derived date ${JSON.stringify(derivedDate)} is not an ISO calendar date. A register row without its provenance labels must not render.`,
    );
  }

  return `Calculated planning date, not text from the order: “${sourceText}” · applies to ${appliesTo} · ${derivation}.`;
}

/** Named once so the list label and the column header cannot drift apart. */
export const TIMING_LIST_LABEL = "Planning dates calculated from the order";

/**
 * What a passed calculated date is, and — just as important — what it is not.
 *
 * The register renders arithmetic the Atlas performed on the order's own
 * language. Once that date is behind the build, a bare date reads as a
 * forward-looking plan the markup cannot keep, and the obvious replacement
 * words ("overdue", "missed", "late") would turn a subtraction into the
 * accountability finding this project exists to refuse. This is the wording
 * that says the date has passed without saying anything about delivery.
 */
export const TIMING_PASSED_LABEL = "Calculated date passed";

/** The register's short marker for a date that is still ahead of the build. */
export const TIMING_UPCOMING_LABEL = "Calculated date upcoming";

export interface TimingCurrencyView {
  referenceDate: string;
  derivedDate: string;
  passed: boolean;
  daysUntil: number;
  daysSince: number;
}

/**
 * The sentence appended wherever a calculated planning date is shown, stating
 * the date's currency against the build and refusing the delivery inference.
 *
 * Returned as a separate string rather than folded into {@link timingDetail} so
 * the derivation label and the currency label can be asserted independently,
 * and so a caller that has no reference date cannot accidentally publish a
 * currency claim it did not compute.
 */
export function timingCurrencyNote(
  currency: TimingCurrencyView,
  context: string,
): string {
  const referenceDate = requireText(
    currency?.referenceDate,
    "timing reference date",
    context,
  );

  if (!currency.passed) {
    const days = currency.daysUntil;
    return `This calculated date is ${days} day${days === 1 ? "" : "s"} after the build it is published from (${referenceDate}).`;
  }

  const days = currency.daysSince;
  // The typographic apostrophe is load-bearing, not decorative: React escapes a
  // straight quote to `&#x27;` in the static export, which would stop the
  // rendered-HTML assertions from matching the string built here.
  return `This calculated date passed ${days} day${days === 1 ? "" : "s"} before the build it is published from (${referenceDate}). That is arithmetic on the order’s own language, not a finding that this directive is late, incomplete, or out of compliance, and it says nothing about work outside the reviewed public record.`;
}
