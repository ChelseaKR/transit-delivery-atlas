import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  CHANGE_KINDS,
  changeEntry,
  changesForDirective,
  deriveChanges,
  escapeXml,
  renderAtom,
} from "../lib/changes.mjs";
import { verdictPatternIn } from "../lib/verdict-language.mjs";

const root = new URL("../", import.meta.url);

async function readJson(path) {
  return JSON.parse(await readFile(new URL(path, root), "utf8"));
}

const [directiveData, evidence, watchlist, verification, committed] = await Promise.all([
  readJson("data/directives.json"),
  readJson("data/evidence.json"),
  readJson("data/watchlist.json"),
  readJson("data/evidence-verification.json"),
  readJson("data/changes.json"),
]);

const inputs = {
  directives: directiveData.directives,
  evidence,
  watchlist,
  verification,
  changes: committed,
};

/** The build date the committed data was written against; nothing here reads a clock. */
const AT_BUILD = "2026-09-07";

/** After every calculated planning date in the dataset and every planned review. */
const LATER = "2027-07-01";

function entries(buildDate = AT_BUILD, overrides = {}) {
  return deriveChanges({ ...inputs, ...overrides, buildDate });
}

/**
 * A deliberately small XML well-formedness check.
 *
 * Node ships no XML parser, and pulling one in to test a file this project
 * writes itself would move the question rather than answer it. This walks the
 * document, requires every tag to close in order, and requires the text between
 * tags to carry no unescaped `<` or bare `&`. A feed that passes this is one a
 * reader can parse; a feed that fails it is one no reader can.
 */
function wellFormed(xml) {
  const stack = [];
  const problems = [];
  const pattern = /<([!?/]?)([A-Za-z][\w:-]*)?([^>]*?)(\/?)>/g;
  let cursor = 0;
  let match;
  while ((match = pattern.exec(xml)) !== null) {
    const text = xml.slice(cursor, match.index);
    if (text.includes("<")) problems.push(`unescaped "<" in text: ${text.slice(0, 40)}`);
    for (const [, entity] of text.matchAll(/&(#?\w*;?)/g)) {
      if (!/^(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);$/.test(entity)) {
        problems.push(`bare "&" in text: ${text.slice(0, 40)}`);
      }
    }
    cursor = pattern.lastIndex;
    const [, prefix, name, , selfClosing] = match;
    if (prefix === "?" || prefix === "!") continue;
    if (prefix === "/") {
      if (stack.pop() !== name) problems.push(`</${name}> does not close the open element`);
      continue;
    }
    if (selfClosing !== "/") stack.push(name);
  }
  if (stack.length > 0) problems.push(`unclosed: ${stack.join(", ")}`);
  return problems;
}

function feed(buildDate = AT_BUILD, list = entries(buildDate)) {
  return renderAtom(list, {
    siteUrl: "https://transit.chelseakr.com",
    selfPath: "/changes.xml",
    title: "Transit Delivery Atlas — record changes",
    subtitle: "Dated, record-level events.",
    buildDate,
  });
}

test("the feed is well-formed Atom 1.0 and carries what RFC 4287 requires", () => {
  const xml = feed();

  assert.deepEqual(wellFormed(xml), []);
  assert.ok(xml.startsWith('<?xml version="1.0" encoding="utf-8"?>\n<feed xmlns="http://www.w3.org/2005/Atom">'));
  for (const required of ["<id>", "<title>", "<updated>"]) {
    assert.ok(xml.includes(`  ${required}`), `the feed must carry ${required}`);
  }
  const blocks = xml.split("  <entry>").slice(1);
  assert.ok(blocks.length > 0, "an empty feed proves nothing about entry structure");
  for (const block of blocks) {
    for (const required of ["<id>", "<title>", "<updated>", "<summary"]) {
      assert.ok(block.includes(required), `every entry must carry ${required}`);
    }
  }
});

test("the feed lists every evidence record with the date it was last reviewed", () => {
  const reviewed = entries().filter(({ kind }) => kind === "evidence-reviewed");

  assert.equal(reviewed.length, evidence.evidence.length);
  for (const record of evidence.evidence) {
    const found = reviewed.find((item) => item.recordId === record.id);
    assert.ok(found, `${record.id} has no review entry`);
    assert.equal(found.date, record.lastReviewedOn);
    assert.ok(feed().includes(escapeXml(found.title)));
  }
});

test("the artifact re-hash log is reused rather than reimplemented", () => {
  const rechecked = entries().filter(({ kind }) => kind === "evidence-artifact-rechecked");

  assert.equal(rechecked.length, verification.records.length);
  for (const record of verification.records) {
    const found = rechecked.find((item) => item.recordId === record.id);
    assert.ok(found, `${record.id} has no re-check entry`);
    assert.equal(found.date, record.checkedOn);
    assert.ok(
      found.detail.includes(record.artifact.outcome),
      "the outcome word must travel through unchanged, not be reworded into a judgement",
    );
  }
});

test("every entry resolves to a record the dataset holds", () => {
  const known = new Set([
    ...evidence.evidence.map(({ id }) => id),
    ...watchlist.items.map(({ id }) => id),
    ...(evidence.sweeps ?? []).map(({ sweptOn }) => `sweep-${sweptOn}`),
    ...directiveData.directives.flatMap((directive) =>
      (directive.timing ?? []).map((timing) => `${directive.id}:${timing.derivedDate}`),
    ),
    "evidence-collection",
  ]);

  for (const item of entries(LATER)) {
    assert.ok(known.has(item.recordId), `${item.id} names a record nothing holds`);
    assert.ok(item.path.startsWith("/"), `${item.id} has no site path`);
  }
});

test("an event naming a record the dataset does not hold fails the derivation", () => {
  assert.throws(
    () =>
      entries(AT_BUILD, {
        changes: {
          events: [
            {
              kind: "source-correction-applied",
              date: "2026-08-01",
              recordId: "no-such-record",
              note: "a correction naming a record that is not in the dataset",
            },
          ],
        },
      }),
    /not a record in the dataset/,
  );
  assert.throws(
    () =>
      entries(AT_BUILD, {
        evidence: {
          ...evidence,
          sweeps: [{ sweptOn: "2026-08-21", sourceIds: [], addedEvidenceIds: ["ghost-record"] }],
        },
      }),
    /not a record in the dataset/,
  );
});

test("a watchlist item promoted to evidence produces two linked entries and no verdict", () => {
  const item = watchlist.items[0];
  // A record the sweep log actually added: the evidence half of a promotion is
  // derived from the sweep, so a record that entered the dataset another way
  // would make this test pass or fail for a reason that has nothing to do with
  // promotions.
  const promotedId = evidence.sweeps[0].addedEvidenceIds[0];
  const promoted = evidence.evidence.find(({ id }) => id === promotedId);
  const derived = entries(AT_BUILD, {
    changes: {
      events: [
        {
          kind: "watchlist-narrowed",
          date: "2026-08-21",
          recordId: item.id,
          promotedToEvidenceId: promoted.id,
          note: "The awaited artifact was published and meets the Atlas evidence rule.",
        },
      ],
    },
  });

  const narrowed = derived.find((change) => change.kind === "watchlist-narrowed");
  const added = derived.find(
    (change) => change.kind === "evidence-added" && change.recordId === promoted.id,
  );
  assert.ok(narrowed, "the narrowing must be published");
  assert.ok(added, "the evidence record's addition must be published");
  assert.ok(
    narrowed.detail.includes(promoted.id),
    "the narrowing must name the evidence record that replaced it",
  );
  assert.equal(narrowed.recordId, item.id);
  for (const change of [narrowed, added]) {
    assert.equal(verdictPatternIn(`${change.title} ${change.detail}`), null);
    assert.doesNotMatch(`${change.title} ${change.detail}`, /\bcomplet/i);
  }
});

test("no entry publishes a verdict about a directive or a body", () => {
  const offences = [];
  for (const item of entries(LATER)) {
    const pattern = verdictPatternIn(`${item.title} ${item.detail}`);
    if (pattern) offences.push(`${item.id}\n    ${pattern}\n    ${item.title} ${item.detail}`);
  }

  assert.deepEqual(offences, [], `change entries carrying verdict language:\n  ${offences.join("\n  ")}`);
});

test("a lapsed review date is dated to the build that observed it", () => {
  const before = entries(AT_BUILD).filter(({ kind }) => kind === "review-date-lapsed");
  const after = entries(LATER).filter(({ kind }) => kind === "review-date-lapsed");

  assert.equal(before.length, 0, "nothing in the committed data is overdue at the build date");
  assert.equal(
    after.length,
    watchlist.items.length + 1,
    "every watchlist item and the evidence collection lapse once the build date passes them",
  );
  for (const item of after) {
    assert.equal(item.date, LATER);
    assert.equal(item.observedBy, "build");
  }
});

test("rebuilding an unchanged dataset adds only what the later build date justifies", () => {
  const early = entries(AT_BUILD);
  const late = entries(LATER);
  const ids = new Set(early.map(({ id }) => id));
  const added = late.filter((item) => !ids.has(item.id));

  assert.ok(added.length > 0, "the later date must reach something, or this proves nothing");
  for (const item of added) {
    assert.ok(
      item.kind === "review-date-lapsed" || item.kind === "planning-date-passed",
      `${item.id} appeared on a later build without a date to justify it`,
    );
  }
  // And nothing that was published at the earlier date disappeared at the later one.
  const lateIds = new Set(late.map(({ id }) => id));
  for (const item of early) {
    if (item.observedBy === "build") continue;
    assert.ok(lateIds.has(item.id), `${item.id} was published and then withdrawn`);
  }
});

test("a calculated planning date is dated to the date, not to the build that passed it", () => {
  const passed = entries(LATER).filter(({ kind }) => kind === "planning-date-passed");
  const expected = directiveData.directives.flatMap((directive) =>
    (directive.timing ?? []).map((timing) => timing.derivedDate),
  );

  assert.equal(passed.length, expected.length);
  for (const item of passed) {
    assert.notEqual(item.date, LATER);
    assert.equal(item.observedBy, "data");
    assert.match(item.detail, /arithmetic on the order's own language/);
  }
});

test("the ordering is total, so two builds of the same commit agree byte for byte", () => {
  const first = entries(LATER);
  const second = deriveChanges({ ...inputs, buildDate: LATER });

  assert.deepEqual(first, second);
  for (let index = 1; index < first.length; index += 1) {
    const previous = first[index - 1];
    const current = first[index];
    const ordered =
      previous.date > current.date ||
      (previous.date === current.date &&
        (previous.kind < current.kind ||
          (previous.kind === current.kind && previous.recordId <= current.recordId)));
    assert.ok(ordered, `${previous.id} and ${current.id} are not in a total order`);
  }
});

test("a per-directive feed carries only that directive's entries", () => {
  const all = entries(LATER);
  let nonEmpty = 0;

  for (const directive of directiveData.directives) {
    const filtered = changesForDirective(all, directive.id);
    if (filtered.length > 0) nonEmpty += 1;
    for (const item of filtered) {
      assert.ok(item.directiveIds.includes(directive.id));
    }
    assert.deepEqual(wellFormed(feed(LATER, filtered)), []);
  }

  assert.ok(nonEmpty > 1, "at least two directives must have entries for the filter to mean anything");
});

test("every kind the module emits is categorised into a published layer", () => {
  const emitted = new Set(entries(LATER).map(({ kind }) => kind));

  assert.ok(emitted.size >= 6, `only ${emitted.size} kinds were exercised; widen the fixture`);
  for (const kind of emitted) {
    assert.ok(Object.hasOwn(CHANGE_KINDS, kind), `${kind} has no layer`);
  }
  for (const item of entries(LATER)) {
    assert.equal(item.layer, CHANGE_KINDS[item.kind]);
  }
});

test("an uncategorised kind is refused rather than published without a layer", () => {
  // Nothing in the committed data can reach this: every call site inside the
  // module passes a literal kind. It is the contract for whoever adds the next
  // kind, and a guard nothing exercises is a guard nobody knows works.
  const fields = {
    date: "2026-01-01",
    recordId: "x",
    path: "/evidence/",
    directiveIds: [],
    title: "t",
    detail: "d",
    observedBy: "data",
  };

  assert.throws(() => changeEntry({ ...fields, kind: "invented" }), /not a change kind/);
  assert.throws(() => changeEntry({ ...fields, kind: "evidence-added", date: "2026-02-30" }), /ISO calendar date/);
  assert.equal(changeEntry({ ...fields, kind: "evidence-added" }).layer, "evidence");
});

test("a record with no directive links produces an entry with an empty, sorted link list", () => {
  const sweep = entries().find(({ kind }) => kind === "sweep-recorded");

  assert.deepEqual(sweep.directiveIds, []);
  assert.equal(
    changeEntry({
      kind: "evidence-added",
      date: "2026-01-01",
      recordId: "x",
      path: "/evidence/",
      directiveIds: ["n-7-26-5", "n-7-26-1a"],
      title: "t",
      detail: "d",
      observedBy: "data",
    }).directiveIds.join(","),
    "n-7-26-1a,n-7-26-5",
  );
});

test("a missing outcome or boundary reason is stated as missing, never as a fact", () => {
  const withoutDetail = entries(AT_BUILD, {
    verification: { records: [{ id: evidence.evidence[0].id, checkedOn: "2026-09-06", artifact: {} }] },
  }).find(({ kind }) => kind === "evidence-artifact-rechecked");
  const withoutReason = entries(AT_BUILD, {
    watchlist: {
      ...watchlist,
      items: [{ ...watchlist.items[0], evidenceBoundary: undefined }],
    },
  }).find(({ kind }) => kind === "watchlist-reviewed");

  assert.match(withoutDetail.detail, /unrecorded/);
  assert.match(withoutDetail.detail, /no detail recorded/);
  assert.match(withoutReason.detail, /no reason recorded/);
});

test("an absent verification log yields no re-check entries rather than empty ones", () => {
  const derived = deriveChanges({ ...inputs, verification: undefined, buildDate: AT_BUILD });

  assert.equal(derived.filter(({ kind }) => kind === "evidence-artifact-rechecked").length, 0);
  assert.ok(derived.length > 0);
});

test("the five predefined XML entities are all escaped, in text and in attributes", () => {
  assert.equal(escapeXml(`& < > " '`), "&amp; &lt; &gt; &quot; &apos;");

  const xml = feed(AT_BUILD, [
    {
      id: "tag:example,2026:changes/x",
      date: "2026-01-01",
      kind: "evidence-added",
      layer: "evidence",
      recordId: "x",
      path: "/evidence/?a=1&b=2",
      directiveIds: [],
      title: 'Ampersands & "quotes" <angles>',
      detail: "A publisher's title & its locator <p. 11>",
      observedBy: "data",
    },
  ]);

  assert.deepEqual(wellFormed(xml), []);
  assert.ok(xml.includes("Ampersands &amp; &quot;quotes&quot; &lt;angles&gt;"));
  assert.ok(xml.includes("/evidence/?a=1&amp;b=2"));
});

test("the feed's updated stamp is the build date, never the moment it ran", () => {
  assert.ok(feed("2026-05-04").includes("<updated>2026-05-04T00:00:00Z</updated>"));
  assert.throws(() => feed("not-a-date"), /ISO calendar date/);
  assert.throws(() => entries("2026-13-40"), /ISO calendar date/);
});

test("a watchlist item whose rule check and review dates disagree is refused", () => {
  // The release gate holds the two equal. If it ever stops, the change log must
  // not silently publish one date for both: it says so and fails.
  assert.throws(
    () =>
      entries(AT_BUILD, {
        watchlist: {
          ...watchlist,
          items: [
            {
              ...watchlist.items[0],
              evidenceBoundary: { ...watchlist.items[0].evidenceBoundary, checkedOn: "2026-01-01" },
            },
            ...watchlist.items.slice(1),
          ],
        },
      }),
    /change log states one date for both/,
  );
});

test("the committed event register is validated even while it is empty", () => {
  assert.equal(committed.schemaVersion, "0.1.0");
  assert.deepEqual(committed.events, []);
  assert.ok(
    committed.note.includes("promotedToEvidenceId"),
    "the register must say what belongs in it, since nothing in it demonstrates that",
  );
});

test("the build writes the feed and the log into the export", async () => {
  const log = JSON.parse(await readFile(new URL("out/changes.json", root), "utf8"));
  const xml = await readFile(new URL("out/changes.xml", root), "utf8");

  assert.ok(log.entries.length > 0);
  assert.equal(log.entries.length, xml.split("  <entry>").length - 1);
  assert.deepEqual(wellFormed(xml), []);
  for (const directive of directiveData.directives) {
    const perDirective = await readFile(
      new URL(`out/directives/${directive.id}/changes.xml`, root),
      "utf8",
    );
    assert.deepEqual(wellFormed(perDirective), []);
  }
});

test("every exported page points a reader at the feed", async () => {
  const html = await readFile(new URL("out/index.html", root), "utf8");
  const directivePage = await readFile(
    new URL(`out/directives/${directiveData.directives[0].id}/index.html`, root),
    "utf8",
  );

  for (const page of [html, directivePage]) {
    assert.match(page, /type="application\/atom\+xml"/);
    assert.match(page, /href="\/changes\.xml"/);
  }
});
