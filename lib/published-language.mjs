/**
 * The verdict lexicon, applied to what the site actually publishes.
 *
 * `lib/verdict-language.mjs` is described there as "the single list shared by
 * the verifier that screens model output, the pre-classifier that refuses
 * verdict questions, the evaluation harness, and the tests, so no surface can
 * carry a different idea of 'verdict'". Every one of those consumers screens
 * the optional question-answering service. None of them screened the static
 * site, which is the surface almost every reader actually gets, and which is
 * built from hand-written prose in `data/analysis.json`, `data/evidence.json`,
 * `data/watchlist.json` and the page components.
 *
 * AGENTS.md states the rule as: "'Complied', 'compliant', 'on track',
 * 'behind', 'late', 'missed', 'met', 'nothing has happened', 'no progress' are
 * not [allowed], anywhere a reader can see them, including AI output." The
 * words "including AI output" mean the AI layer was the extension of the rule,
 * not the whole of it. This module supplies the missing half.
 *
 * The site legitimately prints some of these words while disclaiming them:
 * "it does not establish completion, compliance, or agency performance" trips
 * the lexicon and must. Rather than weaken the patterns, every such sentence is
 * registered below with a reason, and anything unregistered fails the gate. The
 * registry is exhaustive in both directions: an unregistered verdict sentence
 * fails, and a registered sentence the site no longer publishes fails too, so
 * exemptions cannot quietly outlive the prose that earned them.
 */

import { VERDICT_OUTPUT_PATTERNS } from "./verdict-language.mjs";

/**
 * Tags that sit inside a sentence. Removing them joins the text they split;
 * every other tag ends the run of text a sentence can span.
 */
const INLINE_TAGS =
  "a|abbr|b|bdi|bdo|br|cite|code|dfn|em|i|kbd|mark|q|s|samp|small|span|strong|sub|sup|time|u|var|wbr";

const INLINE_TAG_PATTERN = new RegExp(`</?(?:${INLINE_TAGS})(?:\\s[^>]*)?>`, "gi");

/** Attributes a reader reaches through assistive technology or a tooltip. */
const READER_FACING_ATTRIBUTES = ["aria-label", "aria-description", "alt", "title"];

const HTML_ENTITIES = [
  [/&#x27;|&#39;|&apos;/gi, "'"],
  [/&quot;|&#34;/gi, '"'],
  [/&lt;|&#60;/gi, "<"],
  [/&gt;|&#62;/gi, ">"],
  [/&nbsp;|&#160;/gi, " "],
  [/&#x2F;/gi, "/"],
  [/&hellip;/gi, "..."],
  [/&mdash;/gi, "—"],
  [/&amp;|&#38;/gi, "&"],
];

/**
 * Dates the site prints relative to the build. They change on every build, so
 * a registry keyed on the raw sentence would expire overnight. Only dates are
 * normalised, and only into a placeholder, so no other word can drift past the
 * comparison.
 */
const DATE_PATTERNS = [
  /\b[0-9]{4}-[0-9]{2}-[0-9]{2}\b/g,
  /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s+[0-9]{1,2},\s+[0-9]{4}\b/gi,
  /\b[0-9]{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s+[0-9]{4}\b/gi,
];

function decode(text) {
  let decoded = text;
  for (const [pattern, replacement] of HTML_ENTITIES) {
    decoded = decoded.replace(pattern, replacement);
  }
  return decoded;
}

/** Collapse whitespace and straighten quotes so a registry entry is typable. */
function normaliseWhitespace(text) {
  return decode(text)
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * The comparison key for the registry: normalised text with build-relative
 * dates replaced by a placeholder.
 *
 * @param {string} sentence
 * @returns {string}
 */
export function registryKey(sentence) {
  let key = normaliseWhitespace(sentence);
  for (const pattern of DATE_PATTERNS) key = key.replace(pattern, "<date>");
  return key;
}

/** Split prose the way the shared lexicon does, on sentence boundaries. */
function splitIntoSentences(text) {
  return text
    .split(/(?<=[.!?])\s+(?=[A-Z"(\[])/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

/**
 * Every run of reader-facing text in an exported page, as sentences.
 *
 * Script and style contents are excluded because a reader does not read them.
 * Everything else a browser paints, plus the attributes assistive technology
 * announces, is in scope.
 *
 * @param {string} html
 * @returns {string[]}
 */
export function publishedSentences(html) {
  const sentences = [];

  for (const attribute of READER_FACING_ATTRIBUTES) {
    const pattern = new RegExp(`\\b${attribute}="([^"]*)"`, "gi");
    for (const [, value] of html.matchAll(pattern)) {
      const text = normaliseWhitespace(value);
      if (text) sentences.push(...splitIntoSentences(text));
    }
  }

  const runs = html
    .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, "\n")
    .replaceAll("<!-- -->", "")
    .replace(/<!--[\s\S]*?-->/g, "\n")
    .replace(INLINE_TAG_PATTERN, " ")
    .replace(/<[^>]+>/g, "\n")
    .split("\n");

  for (const run of runs) {
    const text = normaliseWhitespace(run);
    if (text) sentences.push(...splitIntoSentences(text));
  }

  return sentences;
}

/**
 * Sentences the site publishes that trip the verdict lexicon while disclaiming
 * it, quoting the order's own subject matter, or describing the Atlas's own
 * arithmetic. Each carries the reason it is not a verdict about a directive.
 *
 * Adding a line here is a review decision, not a formality: the question to
 * answer is whether a reader could take the sentence as a finding about
 * whether a body has complied, delivered, or fallen behind. If they could, the
 * prose is wrong, not the lexicon.
 */
export const PERMITTED_VERDICT_SENTENCES = Object.freeze([
  {
    sentence:
      "Calculated date passed means only that the date the Atlas calculated is behind this build (<date>).",
    reason:
      "The register key explaining that a passed date is arithmetic against the build, not a finding. 'behind this build' describes the build clock, not a body.",
  },
  {
    sentence:
      "It is arithmetic on the order's own language, not a finding that a directive is late, incomplete, or out of compliance.",
    reason: "States the non-finding directly; the verdict words appear inside the denial.",
  },
  {
    sentence:
      "Editorial relevance does not establish causation, implementation activity, progress, completion, compliance, or performance.",
    reason: "The watchlist evidence boundary, disclaiming each term it names.",
  },
  {
    sentence:
      "Inclusion documents a reviewed source relationship; it does not establish completion, compliance, success, or agency performance.",
    reason: "Methodology page limitation, disclaiming each term it names.",
  },
  {
    sentence:
      "Inclusion documents a source relationship; it does not establish implementation status, completion, compliance, or activity beyond the cited record.",
    reason: "The per-directive relationship limitation, disclaiming each term it names.",
  },
  {
    sentence:
      "Inclusion documents a source relationship; it does not establish implementation status, completion, compliance, or performance.",
    reason: "The evidence index limitation, disclaiming each term it names.",
  },
  {
    sentence:
      "It does not establish implementation status, completion, compliance, success, or agency performance.",
    reason: "The evidence index limitation, disclaiming each term it names.",
  },
  {
    sentence:
      "It does not address the Local Partnership Competitive Program (a separate book item), ATP, TIRCP, or Caltrans's federal-funding-identification clause, and it does not establish completion, compliance, or agency performance.",
    reason: "A reviewed evidence record's limitations field, disclaiming each term it names.",
  },
  {
    sentence:
      "It does not address the SCCP (a separate book item), the Local Partnership Formulaic Program, ATP, TIRCP, or Caltrans's federal-funding-identification clause, and it does not establish completion, compliance, or agency performance.",
    reason: "A reviewed evidence record's limitations field, disclaiming each term it names.",
  },
  {
    sentence:
      "It does not cover ATP, TIRCP, other programs, or Caltrans's federal-funding-identification clause, and it does not establish adoption, completion, compliance, or agency performance.",
    reason: "A reviewed evidence record's limitations field, disclaiming each term it names.",
  },
  {
    sentence:
      "The presentation documents proposals discussed in one workshop; it is not a final guideline, adoption record, completion finding, compliance determination, or performance measure.",
    reason: "A reviewed evidence record's limitations field, disclaiming each term it names.",
  },
  {
    sentence:
      "It is not an official interpretation, compliance determination, system design, or finding about any agency's current data readiness.",
    reason: "The TDA/NTD research boundary, disclaiming each term it names.",
  },
  {
    sentence:
      "Eligible-jurisdiction register, recipient-readiness controls, and federal compliance procedures",
    reason:
      "A labelled inferred delivery dependency for directive 1(c). 'federal compliance procedures' is the name of a process the order's subject matter involves, not a claim that anyone complied.",
  },
  {
    sentence:
      "Eligible-jurisdiction register, recipient-readiness controls, and federal compliance procedures Inference · medium confidence",
    reason:
      "The same labelled dependency where the directive page renders its inference label immediately after it.",
  },
  {
    sentence: "Q2 How do compliance duties and reversibility work after an election?",
    reason:
      "A labelled open question about how the order's compliance duties are defined. It asks what the duties are; it does not answer whether they were met.",
  },
  {
    sentence:
      "Until the pending reviews are complete and exceptions are documented, the project does not claim WCAG or Section 508 conformance.",
    reason:
      "The accessibility page describing the Atlas's own review backlog. 'complete' refers to the Atlas's reviews, not to a directive.",
  },
]);

const PERMITTED_BY_KEY = new Map(
  PERMITTED_VERDICT_SENTENCES.map((entry) => [registryKey(entry.sentence), entry]),
);

/**
 * Verdict sentences an exported page publishes without a registered reason.
 *
 * @param {string} html
 * @returns {{ sentence: string, key: string, pattern: string }[]}
 */
export function unregisteredVerdictSentences(html) {
  const unregistered = [];
  const seen = new Set();

  for (const sentence of publishedSentences(html)) {
    const pattern = VERDICT_OUTPUT_PATTERNS.find((candidate) => candidate.test(sentence));
    if (!pattern) continue;

    const key = registryKey(sentence);
    if (PERMITTED_BY_KEY.has(key) || seen.has(key)) continue;

    seen.add(key);
    unregistered.push({ sentence, key, pattern: String(pattern) });
  }

  return unregistered;
}

/**
 * Registry keys an exported page accounts for, so the caller can prove no
 * exemption outlives the sentence it was written for.
 *
 * @param {string} html
 * @returns {Set<string>}
 */
export function registryKeysUsed(html) {
  const used = new Set();
  for (const sentence of publishedSentences(html)) {
    const key = registryKey(sentence);
    if (PERMITTED_BY_KEY.has(key)) used.add(key);
  }
  return used;
}
