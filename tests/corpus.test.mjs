import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  applyCorrections,
  loadCorpus,
  normalizeForQuote,
  pageOfQuote,
  quoteIsVerbatim,
  sha256,
} from "../lib/corpus.mjs";

const root = new URL("../", import.meta.url);

async function readJson(path) {
  return JSON.parse(await readFile(new URL(path, root), "utf8"));
}

test("the retained PDF is byte-identical to the source record's hash", async () => {
  const [{ manifest, pdf }, sources] = await Promise.all([loadCorpus(), readJson("data/sources.json")]);
  const source = sources.find(({ id }) => id === manifest.id);
  assert.ok(source, "the corpus names a source record");
  assert.equal(manifest.files.pdf.sha256, source.sha256);
  assert.equal(sha256(pdf), source.sha256);
  assert.equal(manifest.url, source.url);
  assert.equal(manifest.files.pdf.textLayer, false, "a scanned order has no text layer to trust");
  assert.match(manifest.authority, /image controls/);
});

test("the corrected text is exactly the raw OCR with the reviewed corrections applied", async () => {
  const { ocr, text, corrections } = await loadCorpus();
  assert.equal(applyCorrections(ocr, corrections), text);
  assert.ok(corrections.length >= 20);
  for (const correction of corrections) {
    assert.ok(correction.basis.length > 10, "every correction states its basis");
    assert.notEqual(correction.ocr, correction.corrected);
    // A correction restores what the scan shows; it never changes wording.
    const before = normalizeForQuote(correction.ocr).split(" ");
    const after = normalizeForQuote(correction.corrected).split(" ");
    assert.ok(Math.abs(before.length - after.length) <= 1, JSON.stringify(correction));
  }
});

test("a drifted corpus file fails loudly", async () => {
  const { ocr, corrections } = await loadCorpus();
  assert.throws(
    () => applyCorrections(ocr.replace("Notity", "Notify"), corrections),
    /matched 0 time\(s\), expected exactly one/,
  );
});

/**
 * Every string `data/directives.json` publishes as the order's own words.
 *
 * The four `excerpt` fields carry a page locator, so their page can be checked
 * too. `qualifiers[].text` and `timing[].sourceText` do not: they are short
 * phrases lifted from inside a section, and the schema gives them no locator.
 * They are still quotations — the directive page renders qualifiers under
 * "Qualifiers preserved from the source" and timing as what the order says —
 * so they are verified verbatim even though their page cannot be.
 */
function publishedQuotations(directiveData) {
  const located = [
    ...directiveData.directives.map(({ id, excerpt, locator }) => ({ id, quote: excerpt, pages: locator.pages })),
    ...directiveData.orderMetadata.sourceContexts.map(({ id, excerpt, locator }) => ({ id, quote: excerpt, pages: locator.pages })),
    ...directiveData.orderMetadata.sourceNotices.map(({ id, excerpt, locator }) => ({ id, quote: excerpt, pages: locator.pages })),
    ...directiveData.orderMetadata.administrativeDirectives.map(({ excerpt, locator }, index) => ({ id: `administrative-${index}`, quote: excerpt, pages: locator.pages })),
  ];

  const unlocated = [];
  for (const directive of directiveData.directives) {
    for (const [index, qualifier] of (directive.qualifiers ?? []).entries()) {
      unlocated.push({ id: `${directive.id} qualifier ${index}`, quote: qualifier.text });
    }
    for (const [index, timing] of (directive.timing ?? []).entries()) {
      if (timing.sourceText) unlocated.push({ id: `${directive.id} timing ${index}`, quote: timing.sourceText });
    }
  }

  return { located, unlocated };
}

test("every reviewed excerpt in the source layer is verbatim in the corrected text", async () => {
  const [{ text }, directiveData] = await Promise.all([loadCorpus(), readJson("data/directives.json")]);
  const { located } = publishedQuotations(directiveData);

  assert.equal(located.length, 24);
  for (const quote of located) {
    const result = quoteIsVerbatim(quote.quote, text);
    assert.ok(result.verbatim, `${quote.id}: ${result.reason}`);
    const page = pageOfQuote(quote.quote, text);
    assert.ok(quote.pages.includes(page), `${quote.id} is on page ${page}, locator says ${quote.pages}`);
  }
});

test("every other string published as the order's own words is verbatim too", async () => {
  // The excerpt check above covered 24 strings. The directive page also
  // publishes 35 qualifiers under "Qualifiers preserved from the source" and 8
  // timing phrases as what the order states, and nothing verified any of them:
  // a fabricated qualifier passed validation, the corpus check, the data
  // integrity suite, and the runtime verifier, and shipped under a heading
  // promising it came from the source.
  const [{ text }, directiveData] = await Promise.all([loadCorpus(), readJson("data/directives.json")]);
  const { unlocated } = publishedQuotations(directiveData);

  const qualifierCount = directiveData.directives.reduce(
    (total, directive) => total + (directive.qualifiers ?? []).length,
    0,
  );
  const timingCount = directiveData.directives.reduce(
    (total, directive) => total + (directive.timing ?? []).filter(({ sourceText }) => sourceText).length,
    0,
  );

  // Derived from the data, so a new qualifier is covered the day it lands, and
  // asserted non-empty, because a check that verifies nothing passes forever.
  assert.equal(unlocated.length, qualifierCount + timingCount);
  assert.ok(qualifierCount >= 35, `expected every qualifier, found ${qualifierCount}`);
  assert.ok(timingCount >= 8, `expected every timing phrase, found ${timingCount}`);

  for (const { id, quote } of unlocated) {
    const result = quoteIsVerbatim(quote, text);
    assert.ok(result.verbatim, `${id} is published as the order's words but is not in the corrected text: ${result.reason} (${JSON.stringify(quote)})`);
  }
});

test("the verifier rejects paraphrase, reordering, and trivially short fragments", async () => {
  const { text } = await loadCorpus();
  assert.equal(
    quoteIsVerbatim("develop a list of transit priority projects statewide that can be updated regularly", text).verbatim,
    true,
  );
  assert.equal(
    quoteIsVerbatim("develop a statewide list of transit priority projects that can be updated regularly", text).verbatim,
    false,
    "paraphrase is not a quotation",
  );
  assert.equal(
    quoteIsVerbatim("Caltrans is directed to create real time dashboards ... within 120 days of this Order", text).verbatim,
    false,
    "fragments out of document order are not a quotation",
  );
  assert.equal(
    quoteIsVerbatim("Within 120 days of this Order ... Caltrans is directed to create real time dashboards", text).verbatim,
    true,
  );
  const short = quoteIsVerbatim("transit ... funding", text);
  assert.equal(short.verbatim, false);
  assert.match(short.reason, /shorter than/);
  assert.equal(quoteIsVerbatim("", text).verbatim, false);
  assert.equal(
    quoteIsVerbatim("Caltrans has complied with this directive", text).verbatim,
    false,
    "a verdict is not in the order",
  );
});

test("normalisation survives the punctuation the scan gets wrong", () => {
  assert.equal(normalizeForQuote("first- and last-mile"), "first and last mile");
  assert.equal(normalizeForQuote("Statutes.of 2023"), "statutes of 2023");
  assert.equal(normalizeForQuote("“Order”—now"), "order now");
  assert.equal(normalizeForQuote("portfolio—spanning"), "portfolio spanning");
});
