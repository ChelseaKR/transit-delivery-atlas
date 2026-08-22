#!/usr/bin/env node --experimental-strip-types
import { execFileSync } from "node:child_process";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { answerQuestion } from "../service/answer.ts";
import { loadConfig } from "../service/config.ts";
import { loadKnowledge } from "../service/knowledge.ts";
import { createProvider } from "../service/provider.ts";
import { PROMPT_VERSION } from "../service/schemas.ts";
import { preclassify } from "../service/structure.ts";
import { verdictPatternIn } from "../lib/verdict-language.mjs";

/**
 * The evaluation harness.
 *
 *   node --experimental-strip-types evals/run.mjs --suite all --provider bedrock
 *   node --experimental-strip-types evals/run.mjs --suite compliance-refusal --dry-run
 *
 * A live run writes one result file per suite under evals/results/, carrying
 * the provider, model, prompt version, commit, and date that produced the
 * numbers. `--dry-run` runs the cases through a scripted provider to check the
 * harness itself and writes nothing: a number that did not come from a model
 * is not a result.
 */

const root = new URL("../", import.meta.url);
const args = new Map();
for (let index = 2; index < process.argv.length; index += 1) {
  const arg = process.argv[index];
  if (!arg.startsWith("--")) continue;
  const next = process.argv[index + 1];
  if (next && !next.startsWith("--")) {
    args.set(arg.slice(2), next);
    index += 1;
  } else {
    args.set(arg.slice(2), "true");
  }
}

const suiteArg = args.get("suite") ?? "all";
const dryRun = args.get("dry-run") === "true";
const providerName = args.get("provider");

async function readJson(path) {
  return JSON.parse(await readFile(new URL(path, root), "utf8"));
}

function gitCommit() {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { cwd: new URL(".", root), encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

/** A scripted provider for dry runs: structures by the pre-classifier's hint and narrates minimally. */
function dryProvider(knowledge) {
  let turn = 0;
  return {
    name: "fake",
    model: "dry-run",
    async complete(request) {
      turn += 1;
      const usage = { inputTokens: 0, outputTokens: 0, cacheReadInputTokens: 0, cacheCreationInputTokens: 0 };
      if (request.user.startsWith("FACTS:")) {
        const ids = [...request.user.matchAll(/^DIRECTIVE (n-7-26-[0-9a-z]+)/gm)].map((m) => m[1]);
        const segments = [];
        for (const id of ids) {
          segments.push({ kind: "quote", ref: `quote:${id}`, text: null });
          if (new RegExp(`NO LINKED EVIDENCE: emit an empty-state segment with ref "${id}"`).test(request.user)) {
            segments.push({ kind: "empty-state", ref: id, text: null });
          }
          for (const m of request.user.matchAll(/evidence record ([a-z0-9-]+):/g)) {
            segments.push({ kind: "evidence", ref: m[1], text: null });
          }
        }
        return { parsed: { segments }, usage, model: "dry-run" };
      }
      const question = request.user.replace(/^.*Question: /s, "");
      // The dry provider can only read explicit labels; subject questions
      // ("which directive covers the MUTCD?") are what the live model is for.
      const ids = preclassify(question, knowledge).directiveIds;
      const evidence = /evidence|artifact|published|documented|record|checked/i.test(question);
      const intent = ids.length === 0 ? (/transit|order/i.test(question) ? "too-vague" : "out-of-scope") : evidence ? "evidence-lookup" : "directive-lookup";
      return {
        parsed: { intent, directiveIds: ids, fields: evidence ? ["evidence"] : ["source-language", "responsible-bodies", "timing"], rationale: `dry run turn ${turn}` },
        usage,
        model: "dry-run",
      };
    },
  };
}

const scorers = {
  "compliance-refusal": (c, r) => {
    const refused = r.kind === "refusal" && r.refusal?.reason === "compliance-verdict";
    return { pass: refused, observed: { kind: r.kind, reason: r.refusal?.reason ?? null, modelCalls: r.modelCalls } };
  },
  "empty-state": (c, r) => {
    const empty = r.blocks.find((b) => b.type === "empty-state" && b.directiveId === c.expect.directiveId);
    const publishedVerdict = r.blocks.some((b) => b.type === "text" && verdictPatternIn(b.text));
    // What the model tried before the verifier: its raw text segments.
    const rawText = (r.debug?.rawNarration?.segments ?? []).filter((s) => s.kind === "text").map((s) => s.text ?? "").join(" ");
    const absenceInProse = /\b(?:no|not any|zero|without any) (?:reviewed |public |linked )?(?:evidence|artifacts?|records?)\b|\bnothing\b|\bhas(?:n't| not)\b|\bhave(?:n't| not)\b/i.test(rawText);
    const modelAttemptedStatus = r.withheld.items.filter((w) => w.kind === "verdict").length + (verdictPatternIn(rawText) ? 1 : 0);
    const pass = r.kind === "answer" && Boolean(empty) && !publishedVerdict && /last checked on \d{4}-\d{2}-\d{2}|not yet|successfully checked/.test(empty?.statement ?? "");
    return {
      pass,
      observed: { kind: r.kind, emptyStatePresent: Boolean(empty), publishedVerdict, absenceDescribedInProse: absenceInProse, modelAttemptedStatus, withheld: r.withheld.count },
    };
  },
  "citation-grounding": (c, r) => {
    const quotes = r.blocks.filter((b) => b.type === "quote");
    const evidence = r.blocks.filter((b) => b.type === "evidence");
    const withheldCitations = r.withheld.items.filter((w) => ["quote", "evidence", "text-quotation"].includes(w.kind)).length;
    const allQuotesVerified = quotes.every((q) => q.verified === "verbatim-in-retained-corpus");
    const expectedDirectives = c.expect.directiveIds ?? [];
    const coversExpected = expectedDirectives.every((id) => r.question.directiveIds.includes(id));
    const needsQuote = c.expect.quote !== false;
    const needsEvidence = Boolean(c.expect.evidence);
    const pass = r.kind === "answer" && coversExpected && allQuotesVerified && (!needsQuote || quotes.length > 0) && (!needsEvidence || evidence.length > 0);
    return { pass, observed: { kind: r.kind, directiveIds: r.question.directiveIds, quotes: quotes.length, evidence: evidence.length, withheldCitations, withheld: r.withheld.count } };
  },
  freshness: (c, r) => {
    const freshness = r.blocks.find((b) => b.type === "freshness");
    const evidenceBlocks = r.blocks.filter((b) => b.type === "evidence");
    const everyRecordDated = evidenceBlocks.every((b) => /^\d{4}-\d{2}-\d{2}$/.test(b.lastReviewedOn));
    const everyItemDated = Boolean(freshness) && freshness.items.every((i) => (i.sourcesLastCheckedOn !== null || i.coverageState === "not-yet-reviewed") && /^\d{4}-\d{2}-\d{2}$/.test(i.nextReviewOn));
    const pass = r.kind === "answer" && Boolean(freshness) && everyRecordDated && everyItemDated;
    return { pass, observed: { kind: r.kind, freshnessPresent: Boolean(freshness), evidenceBlocks: evidenceBlocks.length, everyRecordDated, everyItemDated } };
  },
  structuring: (c, r) => {
    const intentOk = r.question.intent === c.expect.intent;
    const directivesOk = (c.expect.directiveIds ?? []).every((id) => r.question.directiveIds.includes(id));
    const refusedToGuess = ["too-vague", "out-of-scope", "unknown-directive", "compliance-verdict"].includes(c.expect.intent) ? r.kind === "refusal" : true;
    return { pass: intentOk && directivesOk && refusedToGuess, observed: { intent: r.question.intent, directiveIds: r.question.directiveIds, kind: r.kind, refusedToGuess } };
  },
};

async function runSuite(name, knowledge, provider, config) {
  const suite = await readJson(`evals/cases/${name}.json`);
  const results = [];
  for (const c of suite.cases) {
    let response;
    let error = null;
    try {
      response = await answerQuestion({ question: c.question, directiveId: c.directiveId }, { knowledge, provider, config });
    } catch (caught) {
      error = caught instanceof Error ? caught.message : String(caught);
    }
    const scored = error ? { pass: false, observed: { error } } : scorers[name](c, response);
    const rawText = response?.debug?.rawNarration?.segments?.filter((s) => s.kind === "text").map((s) => s.text).join(" | ") ?? null;
    results.push({ id: c.id, question: c.question, directiveId: c.directiveId ?? null, expect: c.expect ?? null, ...scored, rawModelText: rawText, publishedText: response?.blocks?.filter((b) => b.type === "text").map((b) => b.text).join(" | ") ?? null, withheld: response?.withheld?.items ?? [] });
    process.stdout.write(scored.pass ? "." : "F");
  }
  process.stdout.write("\n");
  const passed = results.filter((r) => r.pass).length;
  const metrics = { cases: results.length, passed, failed: results.length - passed, passRate: results.length === 0 ? 0 : passed / results.length };
  if (name === "empty-state") {
    metrics.modelAttemptedStatusCases = results.filter((r) => (r.observed.modelAttemptedStatus ?? 0) > 0).length;
    metrics.absenceDescribedInProseCases = results.filter((r) => r.observed.absenceDescribedInProse).length;
    metrics.publishedVerdictCases = results.filter((r) => r.observed.publishedVerdict).length;
  }
  if (name === "citation-grounding") {
    metrics.withheldCitations = results.reduce((sum, r) => sum + (r.observed.withheldCitations ?? 0), 0);
    metrics.verifiedQuotes = results.reduce((sum, r) => sum + (r.observed.quotes ?? 0), 0);
  }
  if (name === "compliance-refusal") {
    metrics.zeroTolerance = passed === results.length;
    metrics.refusedWithoutModelCall = results.filter((r) => r.observed.modelCalls === 0).length;
  }
  return { suite: name, description: suite.description, zeroTolerance: suite.zeroTolerance ?? false, metrics, cases: results };
}

async function main() {
  const knowledge = await loadKnowledge();
  const env = { ...process.env };
  if (providerName) env.ASK_PROVIDER = providerName;
  env.ASK_DEBUG = "1";
  const config = loadConfig(env);
  const provider = dryRun ? dryProvider(knowledge) : createProvider(config);
  const names = suiteArg === "all" ? (await readdir(new URL("evals/cases/", root))).filter((f) => f.endsWith(".json")).map((f) => f.replace(/\.json$/, "")).sort() : suiteArg.split(",");
  const date = new Date().toISOString().slice(0, 10);
  const commit = gitCommit();
  let allPassed = true;
  for (const name of names) {
    console.log(`\n== ${name} (${dryRun ? "dry run, nothing written" : `${provider.name} ${provider.model}`})`);
    const result = await runSuite(name, knowledge, provider, config);
    console.log(JSON.stringify(result.metrics));
    if (result.zeroTolerance && result.metrics.failed > 0) allPassed = false;
    if (dryRun) continue;
    const file = {
      suite: name,
      ran: true,
      live: true,
      provenance: { provider: provider.name, model: provider.model, promptVersion: PROMPT_VERSION, commit, date },
      description: result.description,
      zeroTolerance: result.zeroTolerance,
      metrics: result.metrics,
      cases: result.cases,
    };
    await mkdir(new URL("evals/results/", root), { recursive: true });
    const path = new URL(`evals/results/${name}.json`, root);
    await writeFile(path, `${JSON.stringify(file, null, 2)}\n`);
    console.log(`wrote ${path.pathname}`);
  }
  if (!allPassed) {
    console.error("\nA zero-tolerance suite did not pass every case.");
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
