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
