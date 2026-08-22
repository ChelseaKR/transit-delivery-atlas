import assert from "node:assert/strict";
import test from "node:test";
import { answerQuestion } from "../service/answer.ts";
import { loadConfig } from "../service/config.ts";
import { loadKnowledge } from "../service/knowledge.ts";
import { factsDocument } from "../service/narrate.ts";
import { preclassify, finalize } from "../service/structure.ts";
import { verifyNarration } from "../service/verify.ts";

/**
 * The pipeline with a scripted provider. Nothing here calls a model; these
 * tests prove what the service does with what a model returns, which is where
 * the trust rules live.
 */

const knowledge = await loadKnowledge();
const config = loadConfig({ BUILD_SHA: "test-commit" });
const usage = { inputTokens: 10, outputTokens: 5, cacheReadInputTokens: 0, cacheCreationInputTokens: 0 };

/** A provider that answers the structuring call, then the narration call, from a script. */
function scripted(structured, narration) {
  const calls = [];
  return {
    calls,
    provider: {
      name: "anthropic",
      model: "scripted-model",
      async complete(request) {
        calls.push(request);
        const parsed = calls.length === 1 ? structured : narration;
        return { parsed, usage, model: "scripted-model" };
      },
    },
  };
}

function deps(provider) {
  return { knowledge, provider, config, now: () => new Date("2026-08-21T12:00:00Z") };
}

const text = (t) => ({ kind: "text", text: t, ref: null });
const quote = (ref) => ({ kind: "quote", text: null, ref });
const evidence = (ref) => ({ kind: "evidence", text: null, ref });
const emptyState = (ref) => ({ kind: "empty-state", text: null, ref });

test("a verdict question is refused before any model call, in many phrasings", async () => {
  const phrasings = [
    "Is Caltrans complying with directive 1(a)?",
    "Is the state on track?",
    "Has directive 3(b) been met?",
    "Grade Caltrans's implementation of the order.",
    "Will they make the October deadline?",
    "How much progress has CalSTA made on directive 4?",
    "What's the status of the dashboards in directive 2?",
    "Has Caltrans done its job on 1(c)?",
    "Is anything actually happening with 3(g)?",
    "Rate the state's performance on directive 5.",
  ];
  for (const question of phrasings) {
    const { provider, calls } = scripted(null, null);
    const result = await answerQuestion({ question }, deps(provider));
    assert.equal(result.kind, "refusal", question);
    assert.equal(result.refusal.reason, "compliance-verdict", question);
    assert.equal(calls.length, 0, `no model call for: ${question}`);
    assert.equal(result.modelCalls, 0);
    assert.match(result.refusal.text, /does not say whether a body is complying/);
    assert.ok(result.refusal.pointers.some(({ href }) => href === "/evidence/"));
    assert.equal(result.labels.notAComplianceDetermination, true);
  }
});

test("a verdict the model missed is still refused after structuring", async () => {
  // The lexicon is the last word: even if the model classified it as a lookup.
  const { provider } = scripted(
    { intent: "directive-lookup", directiveIds: ["n-7-26-1a"], fields: ["timing"], rationale: "" },
    { segments: [text("ok")] },
  );
  const structured = finalize(
    { intent: "directive-lookup", directiveIds: ["n-7-26-1a"], fields: ["timing"], rationale: "" },
    "Did Caltrans finish the project list on time?",
    knowledge,
  );
  assert.equal(structured.intent, "compliance-verdict");
  assert.equal(provider.name, "anthropic");
});

test("an unknown directive reference is refused deterministically", async () => {
  for (const question of ["What does directive 7 require?", "Who is responsible for 1(h)?", "Explain section 3(k)."]) {
    const { provider, calls } = scripted(null, null);
    const result = await answerQuestion({ question }, deps(provider));
    assert.equal(result.kind, "refusal", question);
    assert.equal(result.refusal.reason, "unknown-directive", question);
    assert.equal(calls.length, 0);
    assert.match(result.refusal.text, /1\(a\) through 1\(g\), 2, 3\(a\) through 3\(j\), 4, 5, and 6/);
  }
});

test("the pre-classifier reads explicit references and ignores bare numbers", () => {
  assert.deepEqual(preclassify("What does 1(a) require, and who leads 3(b)?", knowledge).directiveIds, ["n-7-26-1a", "n-7-26-3b"]);
  assert.deepEqual(preclassify("Tell me about directive 4 and Section 5.", knowledge).directiveIds, ["n-7-26-4", "n-7-26-5"]);
  assert.deepEqual(preclassify("Which directives mention Section 5307 funding within 120 days?", knowledge).directiveIds, []);
  assert.equal(preclassify("Is it on track?", knowledge).intent, "compliance-verdict");
  assert.deepEqual(preclassify("When is the first report due?", knowledge, "n-7-26-1f").directiveIds, ["n-7-26-1f"]);
});

test("out-of-scope and too-vague structuring become refusals with pointers", async () => {
  for (const [intent, pattern] of [
    ["out-of-scope", /outside what the Atlas records/],
    ["too-vague", /will not guess/],
  ]) {
    const { provider, calls } = scripted({ intent, directiveIds: [], fields: [], rationale: "" }, null);
    const result = await answerQuestion({ question: "Tell me about transit." }, deps(provider));
    assert.equal(result.kind, "refusal");
    assert.equal(result.refusal.reason, intent);
    assert.match(result.refusal.text, pattern);
    assert.equal(calls.length, 1, "structuring only; no narration for a refusal");
    assert.equal(result.modelCalls, 1);
  }
});

test("a lookup with no resolvable directive and no hint is too vague; with a hint it proceeds", async () => {
  const vague = finalize({ intent: "directive-lookup", directiveIds: [], fields: [], rationale: "" }, "When is it due?", knowledge);
  assert.equal(vague.intent, "too-vague");
  const hinted = finalize({ intent: "directive-lookup", directiveIds: [], fields: ["timing"], rationale: "" }, "When is it due?", knowledge, "n-7-26-1a");
  assert.equal(hinted.intent, "directive-lookup");
  assert.deepEqual(hinted.directiveIds, ["n-7-26-1a"]);
  const capped = finalize({ intent: "directive-lookup", directiveIds: knowledge.directives.map(({ id }) => id), fields: [], rationale: "" }, "Everything Caltrans must do", knowledge);
  assert.equal(capped.directiveIds.length, 7);
});

test("quotes are substituted from the reviewed excerpt and verified against the corpus", async () => {
  const { provider } = scripted(
    { intent: "directive-lookup", directiveIds: ["n-7-26-1a"], fields: ["source-language", "responsible-bodies", "timing"], rationale: "" },
    { segments: [text("Directive 1(a) directs Caltrans to:"), quote("quote:n-7-26-1a"), text("The order says it applies within 120 days.")] },
  );
  const result = await answerQuestion({ question: "What does 1(a) require of Caltrans?" }, deps(provider));
  assert.equal(result.kind, "answer");
  const quoted = result.blocks.find((block) => block.type === "quote");
  assert.ok(quoted);
  assert.equal(quoted.text, knowledge.directiveById.get("n-7-26-1a").excerpt);
  assert.equal(quoted.verified, "verbatim-in-retained-corpus");
  assert.match(quoted.sourceUrl, /#page=2$/);
  assert.equal(result.withheld.count, 0);
  assert.equal(result.provenance.promptVersion.length > 0, true);
  assert.equal(result.provenance.commit, "test-commit");
  assert.equal(result.provenance.corpusSha256, knowledge.corpusSha256);
  assert.equal(result.modelCalls, 2);
  assert.equal(result.usage.inputTokens, 20);
});

test("a quotation the model invents inside free text is withheld", async () => {
  const { provider } = scripted(
    { intent: "directive-lookup", directiveIds: ["n-7-26-1a"], fields: ["source-language"], rationale: "" },
    {
      segments: [
        text('The order says Caltrans must “publish a comprehensive statewide transit priority list every quarter”.'),
        quote("quote:n-7-26-1a"),
      ],
    },
  );
  const result = await answerQuestion({ question: "What does 1(a) say?" }, deps(provider));
  assert.equal(result.withheld.count, 1);
  assert.equal(result.withheld.items[0].kind, "text-quotation");
  assert.ok(!result.blocks.some((block) => block.type === "text" && /every quarter/.test(block.text)));
  assert.ok(result.blocks.some((block) => block.type === "quote"));
});

test("an unknown quote ref, a quote for another directive, and an unknown evidence ID are withheld", async () => {
  const { provider } = scripted(
    { intent: "evidence-lookup", directiveIds: ["n-7-26-5"], fields: ["evidence"], rationale: "" },
    {
      segments: [
        quote("quote:n-7-26-99"),
        quote("quote:n-7-26-1a"),
        evidence("made-up-record"),
        evidence("ctc-2026-07-15-order-5-reference-material"),
      ],
    },
  );
  const result = await answerQuestion({ question: "What evidence is there for directive 5?" }, deps(provider));
  assert.equal(result.withheld.count, 3);
  assert.deepEqual(
    result.withheld.items.map(({ kind }) => kind),
    ["quote", "quote", "evidence"],
  );
  const record = result.blocks.find((block) => block.type === "evidence");
  assert.equal(record.id, "ctc-2026-07-15-order-5-reference-material");
  assert.equal(record.lastReviewedOn, "2026-07-22");
  assert.ok(record.limitations.length > 0);
});

test("verdict sentences in free text are withheld sentence by sentence", async () => {
  const { provider } = scripted(
    { intent: "evidence-lookup", directiveIds: ["n-7-26-5"], fields: ["evidence"], rationale: "" },
    {
      segments: [
        text("Two Commission artifacts cite Order 5. Caltrans has complied with this directive. The Commission appears to be on track. Both are dated July 15, 2026."),
        evidence("ctc-2026-07-15-order-5-workshop-presentation"),
      ],
    },
  );
  const result = await answerQuestion({ question: "What evidence is there for 5?" }, deps(provider));
  const verdicts = result.withheld.items.filter(({ kind }) => kind === "verdict");
  assert.equal(verdicts.length, 2);
  const kept = result.blocks.find((block) => block.type === "text");
  assert.equal(kept.text, "Two Commission artifacts cite Order 5. Both are dated July 15, 2026.");
});

test("empty-state fidelity: the site's own wording is inserted and model prose about absence cannot replace it", async () => {
  const { provider } = scripted(
    { intent: "evidence-lookup", directiveIds: ["n-7-26-1a"], fields: ["evidence"], rationale: "" },
    { segments: [text("Nothing has happened on this directive and no action has been taken.")] },
  );
  const result = await answerQuestion({ question: "What evidence is there for 1(a)?" }, deps(provider));
  const empty = result.blocks.find((block) => block.type === "empty-state");
  assert.ok(empty, "an empty-state block is present by construction");
  assert.equal(empty.directiveId, "n-7-26-1a");
  assert.match(empty.statement, /No reviewed public artifact is linked to this directive\./);
  assert.match(empty.statement, /last checked on 2026-08-21/);
  assert.match(empty.statement, /next planned check of the listed sources is 2026-09-18/);
  assert.match(empty.statement, /not evidence that no implementation activity or public record exists/);
  assert.equal(result.withheld.items.filter(({ kind }) => kind === "verdict").length, 1);
  assert.ok(!result.blocks.some((block) => block.type === "text" && /Nothing has happened/.test(block.text)));
  // The withheld model prose left nothing substantive, so the record is shown directly.
  assert.match(result.blocks[0].text, /withheld by the verifier/);
  assert.ok(result.blocks.some((block) => block.type === "quote" && block.ref === "quote:n-7-26-1a"));
});

test("an empty state claimed for a linked directive is withheld, and is not duplicated", async () => {
  const { provider } = scripted(
    { intent: "evidence-lookup", directiveIds: ["n-7-26-5", "n-7-26-2"], fields: ["evidence"], rationale: "" },
    { segments: [emptyState("n-7-26-5"), emptyState("n-7-26-2"), emptyState("n-7-26-2"), text("See above.")] },
  );
  const result = await answerQuestion({ question: "Evidence for 5 and 2?" }, deps(provider));
  assert.equal(result.withheld.items.filter(({ kind }) => kind === "empty-state").length, 1);
  assert.equal(result.blocks.filter((block) => block.type === "empty-state").length, 1);
});

test("freshness: every evidence answer carries review dates for every directive asked about", async () => {
  const { provider } = scripted(
    { intent: "evidence-lookup", directiveIds: ["n-7-26-5", "n-7-26-4"], fields: ["evidence"], rationale: "" },
    { segments: [text("Here is what is linked."), evidence("ctc-2026-08-20-sccp-guidelines-adoption-item")] },
  );
  const result = await answerQuestion({ question: "Evidence for 5 and 4?" }, deps(provider));
  const freshness = result.blocks.find((block) => block.type === "freshness");
  assert.ok(freshness);
  assert.deepEqual(freshness.items.map(({ directiveId }) => directiveId), ["n-7-26-5", "n-7-26-4"]);
  const five = freshness.items[0];
  assert.equal(five.coverageState, "linked");
  assert.ok(five.evidence.every(({ lastReviewedOn }) => /^\d{4}-\d{2}-\d{2}$/.test(lastReviewedOn)));
  assert.equal(five.sourcesLastCheckedOn, "2026-08-21");
  const four = freshness.items[1];
  assert.equal(four.coverageState, "checked-none-found");
  assert.match(four.statement, /could not be retrieved/);
  assert.equal(four.nextReviewOn, "2026-09-18");
});

test("a directive-only answer carries no freshness block and no empty state", async () => {
  const { provider } = scripted(
    { intent: "directive-lookup", directiveIds: ["n-7-26-4"], fields: ["responsible-bodies"], rationale: "" },
    { segments: [text("CalSTA is the explicit lead and the order names CHSRA, FRA, and the Caltrans Division of Rail.")] },
  );
  const result = await answerQuestion({ question: "Who is responsible for directive 4?" }, deps(provider));
  assert.ok(!result.blocks.some((block) => block.type === "freshness" || block.type === "empty-state"));
});

test("the facts document never contains status words and marks interpretation as such", () => {
  const facts = ["n-7-26-1a", "n-7-26-5"].map((id) => knowledge.factsFor(id));
  const document = factsDocument(facts, ["source-language", "timing", "evidence", "analysis-summary", "open-questions"], knowledge);
  assert.doesNotMatch(document, /\b(?:on track|behind schedule|overdue|complied|compliant|no progress)\b/i);
  assert.match(document, /NO LINKED EVIDENCE: emit an empty-state segment with ref "n-7-26-1a"/);
  assert.match(document, /Atlas analysis \(interpretation\)/);
  assert.match(document, /calculated planning date 2026-10-24/);
  assert.match(document, /evidence record ctc-2026-08-20-sccp-guidelines-adoption-item/);
});

test("input limits are enforced before any model call", async () => {
  const { provider, calls } = scripted(null, null);
  await assert.rejects(answerQuestion({ question: "   " }, deps(provider)), /empty/);
  await assert.rejects(answerQuestion({ question: "x".repeat(601) }, deps(provider)), /longer than 600/);
  assert.equal(calls.length, 0);
});

test("verifyNarration is pure: the same narration verifies the same way twice", () => {
  const facts = [knowledge.factsFor("n-7-26-5")];
  const narration = { segments: [quote("quote:n-7-26-5"), evidence("ctc-2026-07-15-order-5-reference-material"), text("Both cite Order 5.")] };
  const first = verifyNarration(narration, facts, ["evidence"], knowledge);
  const second = verifyNarration(narration, facts, ["evidence"], knowledge);
  assert.deepEqual(first, second);
  assert.equal(first.withheld.length, 0);
});
