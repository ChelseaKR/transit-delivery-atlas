// The cost of the gated question panel, re-derived from the build rather than restated.
//
// `tests/ask-gate.test.mjs` pins what *renders*: with no service configured, no
// directive page shows a panel, a button, or an input. That is the reader-facing
// claim and it is true. What it does not pin is what is *served*, and
// `docs/AI-SERVICE.md` makes a claim about that too — the "known residue"
// paragraph. Nothing read that paragraph back, and it had drifted: it described
// the residue as "the panel's client chunk" at "roughly 16 KB", when the panel
// has no chunk of its own and its own share is closer to 6.7 KB. Both halves of
// a sentence about absence were wrong, which is the failure this repository
// exists to argue against.
//
// So this file measures the residue instead of trusting it, in the same spirit as
// `tests/published-figures.test.mjs`. It asserts the structure — which is stable
// and is what the doc actually claims — and bounds the size loosely rather than
// pinning an exact byte count, because an exact count in a document is a gate that
// a routine dependency bump jams for reasons that have nothing to do with the
// panel. The measured number is printed as a diagnostic so it can be re-read from
// a test run.

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

/** Copy that only the question panel carries. */
const PANEL_MARKER = "Ask about this directive";
/** Copy that only the print-record button carries — live code, in the same chunk. */
const LIVE_MARKER = "print-record-button";

/**
 * The panel's share must stay well under this. It is a regression ceiling, not a
 * measurement: it is meant to catch the panel growing a heavy dependency, and
 * deliberately not to catch a bundler emitting a few hundred bytes differently.
 */
const PANEL_CEILING_BYTES = 12_000;
/**
 * ...and above this, because a module-boundary parse that silently stopped
 * working would otherwise report a tiny share and pass. A number derived from a
 * broken read is the defect this repository is about; it must fail, not round to
 * something reassuring.
 */
const PANEL_FLOOR_BYTES = 1_000;

async function directiveIds() {
  const data = JSON.parse(await readFile(new URL("data/directives.json", root), "utf8"));
  const ids = data.directives.map(({ id }) => id);
  assert.ok(ids.length >= 21, "every directive page is checked, not just one");
  return ids;
}

/** The chunk URLs a built page references, deduplicated and ordered. */
function referencedChunks(html) {
  return [...new Set(html.match(/\/_next\/static\/chunks\/[^"]*\.js/g) ?? [])].sort();
}

/**
 * The byte span of the bundled module that carries `marker`.
 *
 * Turbopack emits `TURBOPACK.push([script, <id>, factory, <id>, factory, ...])`,
 * so a module begins at its id and ends where the next one begins. The failure
 * mode that matters is the format changing under us; each assertion below names
 * what it could not find so that shows up as itself rather than as a wrong number.
 */
function moduleSpanContaining(source, marker) {
  const markerAt = source.indexOf(marker);
  assert.notEqual(markerAt, -1, `the chunk no longer contains ${JSON.stringify(marker)}`);

  const headers = [...source.matchAll(/,(\d{3,6}),(?:\([a-z,\s]*\)|[a-z])\s*=>\s*\{/g)];
  assert.ok(
    headers.length >= 2,
    "no Turbopack module headers were recognised in the chunk; the bundle format changed " +
      "and this measurement is no longer reading what it thinks it is reading",
  );

  const starts = headers.map((match) => match.index);
  let index = -1;
  for (let i = 0; i < starts.length; i += 1) {
    if (starts[i] <= markerAt) index = i;
  }
  assert.notEqual(
    index,
    -1,
    `${JSON.stringify(marker)} appears before the first recognised module header`,
  );

  const start = starts[index];
  const end = index + 1 < starts.length ? starts[index + 1] : source.length;
  return { start, end, size: end - start, id: headers[index][1] };
}

test("the panel's code is served on every directive page, from one shared chunk", async (t) => {
  const ids = await directiveIds();
  const bearers = new Map();

  for (const id of ids) {
    const html = await readFile(new URL(`out/directives/${id}/index.html`, root), "utf8");
    // The rendered claim, restated here so this file fails on its own terms if the
    // gate ever regresses while the bundle stays the same.
    assert.doesNotMatch(html, /data-ask-directive/, `${id} renders a panel without a configured service`);

    const carrying = [];
    for (const chunk of referencedChunks(html)) {
      const source = await readFile(new URL(`out${chunk}`, root), "utf8");
      if (source.includes(PANEL_MARKER)) carrying.push(chunk);
    }
    assert.equal(
      carrying.length,
      1,
      `${id} references ${carrying.length} chunks carrying the panel, expected exactly one: ${carrying.join(", ")}`,
    );
    bearers.set(id, carrying[0]);
  }

  const distinct = new Set(bearers.values());
  assert.equal(
    distinct.size,
    1,
    `the panel is served from more than one chunk across the directive pages: ${[...distinct].join(", ")}`,
  );
  t.diagnostic(`panel-bearing chunk, referenced by all ${ids.length} directive pages: ${[...distinct][0]}`);
});

test("the panel has no chunk of its own, so removing it would shrink and not delete one", async (t) => {
  // This is the half of docs/AI-SERVICE.md that had been wrong. If the panel ever
  // does get a chunk to itself, the paragraph describing a shared chunk stops being
  // true and has to be rewritten — so this fails rather than letting the doc drift.
  const html = await readFile(new URL("out/directives/n-7-26-1a/index.html", root), "utf8");
  const chunk = referencedChunks(html).find((candidate) => candidate.includes("chunks/"));
  assert.ok(chunk, "the directive page references no chunks at all");

  let bearer;
  for (const candidate of referencedChunks(html)) {
    const source = await readFile(new URL(`out${candidate}`, root), "utf8");
    if (source.includes(PANEL_MARKER)) bearer = { path: candidate, source };
  }
  assert.ok(bearer, "no referenced chunk carries the panel");

  assert.ok(
    bearer.source.includes(LIVE_MARKER),
    `${bearer.path} carries the panel but no longer carries ${JSON.stringify(LIVE_MARKER)}. ` +
      "If the panel now sits in a chunk of its own, docs/AI-SERVICE.md is wrong to describe " +
      "a shared chunk and the residue can be dropped outright rather than merely shrunk.",
  );

  const panel = moduleSpanContaining(bearer.source, PANEL_MARKER);
  const share = ((100 * panel.size) / bearer.source.length).toFixed(1);
  t.diagnostic(
    `panel module ${panel.id}: ${panel.size} bytes of the ${bearer.source.length}-byte chunk (${share}%)`,
  );

  assert.ok(
    panel.size > PANEL_FLOOR_BYTES,
    `the panel measured ${panel.size} bytes, below the ${PANEL_FLOOR_BYTES}-byte floor. ` +
      "That is far more likely to mean this measurement stopped working than that the panel shrank.",
  );
  assert.ok(
    panel.size < PANEL_CEILING_BYTES,
    `the panel measured ${panel.size} bytes, over the ${PANEL_CEILING_BYTES}-byte ceiling. ` +
      "Inert code that grows is still downloaded on every directive view; either shrink it or " +
      "revisit the alias declined in the tracking issue.",
  );
});
