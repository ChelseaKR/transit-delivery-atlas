import assert from "node:assert/strict";
import test from "node:test";
import {
  NO_EVIDENCE_LABEL,
  evidenceCell,
  provenanceSentence,
  timingDetail,
} from "../lib/register-labels.ts";

const timing = {
  sourceText: "Within 120 days of this Order",
  derivedDate: "2026-10-24",
  derivation: "120 calendar days after the effective date",
  appliesTo: "directive action",
};

test("absence renders as absence, not as a count of zero", () => {
  const empty = evidenceCell(0, "Directive 1(a)");
  assert.equal(empty.text, "E —");
  assert.equal(empty.hasEvidence, false);
  assert.equal(empty.detail, NO_EVIDENCE_LABEL);
  assert.match(empty.detail, /statement about Atlas coverage/);

  const two = evidenceCell(2, "Directive 5");
  assert.equal(two.text, "E 2");
  assert.equal(two.hasEvidence, true);
  assert.match(two.detail, /2 reviewed public artifacts are linked/);

  assert.match(evidenceCell(1, "Directive 5").detail, /1 reviewed public artifact is linked/);
});

test("a row that cannot be labelled fails instead of rendering", () => {
  assert.throws(
    () => evidenceCell(Number.NaN, "Directive 1(a)"),
    /must not render/,
    "an unusable evidence count must stop the build",
  );
  assert.throws(() => evidenceCell(-1, "Directive 1(a)"), /must not render/);
  assert.throws(() => evidenceCell(1.5, "Directive 1(a)"), /must not render/);
  assert.throws(
    () => provenanceSentence({ label: "", evidenceCount: 0 }),
    /must not render/,
  );
  assert.throws(
    () => timingDetail({ ...timing, derivation: "" }, "Directive 1(a)"),
    /timing derivation is missing/,
  );
  assert.throws(
    () => timingDetail({ ...timing, sourceText: "" }, "Directive 1(a)"),
    /timing source text is missing/,
  );
  assert.throws(
    () => timingDetail({ ...timing, derivedDate: "24 Oct 2026" }, "Directive 1(a)"),
    /not an ISO calendar date/,
  );
});

test("the provenance sentence names all three layers", () => {
  const sentence = provenanceSentence({ label: "1(a)", evidenceCount: 0 });
  assert.match(sentence, /^Directive 1\(a\): source reviewed\./);
  assert.match(sentence, /No reviewed evidence linked in this release/);
  assert.match(sentence, /Independent analysis available\.$/);
  assert.doesNotMatch(
    sentence,
    /0 evidence records/,
    "the old wording asserted a finding the data does not support",
  );
});

test("a calculated date is labelled as calculated, with its derivation", () => {
  const detail = timingDetail(timing, "Directive 1(a)");
  assert.match(detail, /Calculated planning date, not text from the order/);
  assert.match(detail, /Within 120 days of this Order/);
  assert.match(detail, /120 calendar days after the effective date/);
  assert.match(detail, /applies to directive action/);
});
