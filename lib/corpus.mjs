import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

/**
 * The retained corpus: the signed order's official PDF, a machine OCR of it,
 * and the OCR with reviewed corrections applied.
 *
 * Everything that quotes the order at runtime is checked against the corrected
 * text here. The check is mechanical and the text is derived, so the rule in
 * `corpus/eo-n-7-26/manifest.json` stands: where the text and the signed image
 * differ, the image controls.
 */

const root = new URL("../", import.meta.url);

export const CORPUS_DIR = new URL("corpus/eo-n-7-26/", root);

/** @param {Uint8Array | string} bytes */
export function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

/**
 * Normalise text so that a quotation can be compared to an OCR'd page without
 * being defeated by line breaks, curly quotes, dash variants, or OCR spacing
 * around punctuation. Letters, digits, and single spaces survive; nothing else.
 *
 * @param {string} text
 * @returns {string}
 */
export function normalizeForQuote(text) {
  return text
    .normalize("NFKC")
    .replace(/[‘’‚′]/g, "'")
    .replace(/[“”„″]/g, '"')
    .replace(/[‐-―−]/g, "-")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Split a quotation on ellipses so an elided excerpt ("A ... B") verifies as
 * its fragments in order.
 *
 * @param {string} quote
 * @returns {string[]}
 */
export function quoteFragments(quote) {
  return quote
    .split(/\s*(?:\.\.\.|…)\s*/)
    .map((fragment) => normalizeForQuote(fragment))
    .filter((fragment) => fragment.length > 0);
}

/**
 * Does `quote` appear verbatim in `text`? An elided quote must have every
 * fragment present, in order, each after the previous one. A fragment shorter
 * than `minimumFragmentLength` normalised characters is rejected outright: a
 * two-word match proves nothing about provenance.
 *
 * @param {string} quote
 * @param {string} text
 * @param {{ minimumFragmentLength?: number }} [options]
 * @returns {{ verbatim: boolean, fragments: number, reason?: string }}
 */
export function quoteIsVerbatim(quote, text, options = {}) {
  const minimumFragmentLength = options.minimumFragmentLength ?? 12;
  const fragments = quoteFragments(quote);
  if (fragments.length === 0) {
    return { verbatim: false, fragments: 0, reason: "empty quotation" };
  }
  // Page markers are ours, not the order's; a quotation that runs across a
  // page break must still verify.
  const haystack = normalizeForQuote(text.replace(/=== PAGE \d ===/g, " "));
  let cursor = 0;
  for (const fragment of fragments) {
    if (fragment.length < minimumFragmentLength) {
      return {
        verbatim: false,
        fragments: fragments.length,
        reason: `fragment shorter than ${minimumFragmentLength} characters: "${fragment}"`,
      };
    }
    const index = haystack.indexOf(fragment, cursor);
    if (index === -1) {
      return {
        verbatim: false,
        fragments: fragments.length,
        reason: `fragment not found in order: "${fragment.slice(0, 60)}"`,
      };
    }
    cursor = index + fragment.length;
  }
  return { verbatim: true, fragments: fragments.length };
}

/**
 * Apply the reviewed corrections, in order, to the raw OCR. Each correction
 * must match exactly once, so a drift in either file is loud.
 *
 * @param {string} ocr
 * @param {Array<{ page: number, ocr: string, corrected: string }>} corrections
 * @returns {string}
 */
export function applyCorrections(ocr, corrections) {
  let text = ocr;
  for (const correction of corrections) {
    const occurrences = text.split(correction.ocr).length - 1;
    if (occurrences !== 1) {
      throw new Error(
        `Correction on page ${correction.page} matched ${occurrences} time(s), expected exactly one: ${JSON.stringify(correction.ocr)}`,
      );
    }
    text = text.replace(correction.ocr, correction.corrected);
  }
  return text;
}

/**
 * Page number (1-based) at which a normalised fragment first appears, from the
 * `=== PAGE n ===` markers in the text files. `null` when not found.
 *
 * @param {string} quote
 * @param {string} text
 * @returns {number | null}
 */
export function pageOfQuote(quote, text) {
  const fragments = quoteFragments(quote);
  if (fragments.length === 0) return null;
  // Build one normalised haystack while remembering where each page starts,
  // so a quotation that begins on one page and runs onto the next is placed
  // on the page it begins on.
  const parts = text.split(/=== PAGE (\d) ===/).slice(1);
  const pageStarts = [];
  let haystack = "";
  for (let index = 0; index < parts.length; index += 2) {
    pageStarts.push({ page: Number(parts[index]), offset: haystack.length });
    haystack += `${normalizeForQuote(parts[index + 1])} `;
  }
  const position = haystack.indexOf(fragments[0]);
  if (position === -1) return null;
  let page = null;
  for (const start of pageStarts) {
    if (start.offset <= position) page = start.page;
  }
  return page;
}

/**
 * Load the corpus and check the manifest's hashes against the files on disk.
 *
 * @returns {Promise<{ manifest: any, pdf: Uint8Array, ocr: string, text: string, corrections: any[] }>}
 */
export async function loadCorpus() {
  const manifest = JSON.parse(await readFile(new URL("manifest.json", CORPUS_DIR), "utf8"));
  const corrections = JSON.parse(
    await readFile(new URL("corrections.json", CORPUS_DIR), "utf8"),
  ).corrections;
  const pdf = await readFile(new URL(manifest.files.pdf.path, CORPUS_DIR));
  const ocr = await readFile(new URL(manifest.files.ocr.path, CORPUS_DIR), "utf8");
  const text = await readFile(new URL(manifest.files.text.path, CORPUS_DIR), "utf8");

  const problems = [];
  if (sha256(pdf) !== manifest.files.pdf.sha256) problems.push("pdf hash differs from manifest");
  if (sha256(ocr) !== manifest.files.ocr.sha256) problems.push("ocr hash differs from manifest");
  if (sha256(text) !== manifest.files.text.sha256) problems.push("text hash differs from manifest");
  if (applyCorrections(ocr, corrections) !== text) {
    problems.push("text is not the ocr with corrections.json applied");
  }
  if (problems.length > 0) {
    throw new Error(`Corpus integrity failure: ${problems.join("; ")}`);
  }
  return { manifest, pdf, ocr, text, corrections };
}
