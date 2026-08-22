/**
 * The words this project never publishes about a directive.
 *
 * The site is independent analysis. It records what the order says, who it
 * names, what it times, and which public artifacts cite it. It never says
 * whether a body is complying, on track, late, done, or idle. This lexicon is
 * the single list shared by the verifier that screens model output, the
 * pre-classifier that refuses verdict questions, the evaluation harness, and
 * the tests, so no surface can carry a different idea of "verdict".
 */

/**
 * Patterns that make a sentence a verdict when they appear in output.
 * Case-insensitive; each is matched as a whole phrase inside a sentence.
 */
export const VERDICT_OUTPUT_PATTERNS = [
  /\b(?:non-?)?compli(?:ed|es|ant|ance|ing)\b/i,
  /\bin compliance\b/i,
  /\bon (?:track|schedule|pace)\b/i,
  /\bbehind (?:schedule|on)\b/i,
  /\b(?:is|are|was|were|runs?|running) late\b/i,
  /\boverdue\b/i,
  /\bmissed (?:the|its|their|a) (?:deadline|date|target)\b/i,
  /\bmet (?:the|its|their|this|that) (?:deadline|date|target|directive|requirement)\b/i,
  /\bhas (?:not )?(?:been )?(?:met|satisfied|fulfilled|completed|delivered|implemented|achieved)\b/i,
  /\b(?:have|has) (?:not )?(?:yet )?(?:acted|complied|delivered|implemented|responded|begun|started)\b/i,
  /\bno (?:action|progress|work|activity) (?:has been|was|is being) (?:taken|made|done)\b/i,
  /\bnothing has (?:happened|been done|changed)\b/i,
  /\bno progress\b/i,
  /\bfail(?:ed|s|ing|ure) to (?:meet|comply|deliver|act|implement)\b/i,
  /\b(?:will|won't|will not|is likely to|is unlikely to|should|may well) (?:make|meet|miss|hit) (?:the|its|their|this) (?:deadline|date|target)\b/i,
  /\b(?:is|are|looks?|seems?|appears?) (?:to be )?(?:complete|completed|finished|done|implemented|in progress|underway|stalled|delayed|ahead|behind)\b/i,
  /\b(?:grade|score|rating) (?:of|for|is)\b/i,
  /\b[A-F][+-]? grade\b/,
  /\bout of compliance\b/i,
];

/**
 * Patterns that make a question a request for a verdict. Broader than the
 * output list: a reader may ask in any phrasing, and every phrasing is refused.
 */
export const VERDICT_QUESTION_PATTERNS = [
  ...VERDICT_OUTPUT_PATTERNS,
  /\bcompl(?:y|ying|iance|iant)\b/i,
  /\bon track\b/i,
  /\bon time\b/i,
  /\btimely\b/i,
  /\b(?:is|are|was|were|has|have|had|did|does|do|will|would|should|can|could)\b[^.?!]{0,80}\b(?:done|complete|completed|finish|finished|finishes|met|satisfied|fulfilled|implemented|delivered|achieved|started|begun|underway|late|delayed|behind|ahead|succeed(?:ed|ing)?|fail(?:ed|ing)?|happening|happened|moving|stalled)\b/i,
  /\b(?:anything|something|nothing|much|little) (?:actually |really |even )?(?:happening|happened|going on|been done|done|moving|changed)\b/i,
  /\b(?:grade|score|rate|rank|assess|evaluate|judge)\b[^.?!]{0,60}\b(?:implementation|progress|performance|compliance|delivery|effort|response|caltrans|calsta|the state|the agency|ctc)\b/i,
  /\bhow (?:well|badly|far along|much progress)\b/i,
  /\b(?:make|meet|hit|miss|blow)\b[^.?!]{0,30}\b(?:deadline|date|target|timeline)\b/i,
  /\bprogress\b/i,
  /\bstatus\b/i,
  /\bperform(?:ance|ing|ed)\b/i,
  /\b(?:doing|done) (?:its|their|the) (?:job|part|work)\b/i,
  /\b(?:living|live|lived) up to\b/i,
  /\b(?:follow(?:ed|ing)? through|followed up)\b/i,
  /\b(?:dropped the ball|ignor(?:ed|ing)|blow(?:n|ing)? off|slow-?walk)/i,
  /\bverdict\b/i,
  /\bto blame\b/i,
  /\bat fault\b/i,
  /\bhow (?:is|are|was|were|has|have)\b[^.?!]{0,60}\b(?:doing|done|faring|going|coming along|getting on|performing)\b/i,
  /\b(?:meet|met|meets|meeting|satisfy|satisfied|fulfil(?:l|led|ls)?)\b[^.?!]{0,40}\b(?:requirement|obligation|directive|order|mandate|commitment)s?\b/i,
  /\b(?:kept?|keeping|honou?r(?:ed|ing)?|break|broke|broken) (?:its|their|the|his|her|any) (?:promises?|word|commitments?|obligations?)\b/i,
  /\bachieved? (?:its|their|the) (?:goals?|aims?|objectives?)\b/i,
];

/** Split prose into sentences conservatively. */
export function splitSentences(text) {
  return text
    .split(/(?<=[.!?])\s+(?=[A-Z“"(\[])/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);
}

/**
 * @param {string} sentence
 * @returns {RegExp | null} the first output pattern the sentence trips, or null
 */
export function verdictPatternIn(sentence) {
  for (const pattern of VERDICT_OUTPUT_PATTERNS) {
    if (pattern.test(sentence)) return pattern;
  }
  return null;
}

/**
 * Does the question ask for a verdict? Conservative by design: a false
 * positive costs a redirect to the directive's record; a false negative
 * publishes a compliance finding.
 *
 * @param {string} question
 * @returns {boolean}
 */
export function asksForVerdict(question) {
  return VERDICT_QUESTION_PATTERNS.some((pattern) => pattern.test(question));
}

/**
 * Remove the sentences that carry a verdict, and report them.
 *
 * @param {string} text
 * @returns {{ kept: string, withheld: string[] }}
 */
export function withholdVerdictSentences(text) {
  const kept = [];
  const withheld = [];
  for (const sentence of splitSentences(text)) {
    if (verdictPatternIn(sentence)) withheld.push(sentence);
    else kept.push(sentence);
  }
  return { kept: kept.join(" "), withheld };
}
