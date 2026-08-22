import assert from "node:assert/strict";
import test from "node:test";
import {
  asksForVerdict,
  splitSentences,
  verdictPatternIn,
  withholdVerdictSentences,
} from "../lib/verdict-language.mjs";

test("verdict questions are recognised across phrasings", () => {
  const verdicts = [
    "Is Caltrans complying?",
    "Are they on track?",
    "Has 1(a) been met?",
    "Will Caltrans make the deadline?",
    "Grade the implementation.",
    "What's the status of 3(b)?",
    "How much progress has been made?",
    "Did they finish on time?",
    "Is anything happening with directive 2?",
    "Has Caltrans dropped the ball?",
    "Is the state living up to the order?",
    "Did Caltrans follow through?",
    "Is implementation stalled?",
    "Who is to blame for the delay on 1(a)?",
    "Is the dashboard work behind schedule?",
    "Rate CalSTA's performance.",
  ];
  for (const question of verdicts) assert.equal(asksForVerdict(question), true, question);
});

test("lookup questions are not mistaken for verdicts", () => {
  const lookups = [
    "What does directive 1(a) require?",
    "Who is responsible for directive 4?",
    "When is the calculated planning date for 1(e)?",
    "What evidence does the Atlas link to directive 5?",
    "Which bodies does the order name in 3(h)?",
    "What does the order say about the MUTCD?",
    "When were the sources last checked for 3(b)?",
    "Quote the source language for directive 6.",
  ];
  for (const question of lookups) assert.equal(asksForVerdict(question), false, question);
});

test("output sentences carrying a verdict are withheld one by one", () => {
  const { kept, withheld } = withholdVerdictSentences(
    "Directive 1(a) names Caltrans as lead. Caltrans has not complied. The work appears to be underway. No progress has been made. The order states a 120-day timing.",
  );
  assert.equal(kept, "Directive 1(a) names Caltrans as lead. The order states a 120-day timing.");
  assert.equal(withheld.length, 3);
  assert.equal(verdictPatternIn("The Commission is on track."), null === null ? verdictPatternIn("The Commission is on track.") : null);
  assert.ok(verdictPatternIn("The Commission is on track."));
  assert.equal(verdictPatternIn("The Commission published a staff recommendation on 2026-08-07."), null);
});

test("the site's own permitted wording is not withheld", () => {
  const permitted = [
    "No reviewed public artifact is linked to this directive.",
    "The listed public sources covering it were last checked on 2026-08-21, and no artifact citing the order was found there.",
    "This calculated date passed 30 days before the build it is published from.",
    "This is a statement about Atlas coverage, not evidence that no implementation activity or public record exists.",
    "The record does not establish adoption, completion, or agency performance.",
  ];
  for (const sentence of permitted) assert.equal(verdictPatternIn(sentence), null, sentence);
});

test("sentence splitting keeps quoted and parenthesised openings together", () => {
  assert.deepEqual(splitSentences('First. “Second” here. (Third) there.'), ["First.", "“Second” here.", "(Third) there."]);
  assert.deepEqual(splitSentences("Section 1(a) applies. It is dated 2026-06-26."), ["Section 1(a) applies.", "It is dated 2026-06-26."]);
});
