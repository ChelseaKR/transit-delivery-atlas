import type { Intent } from "./schemas.ts";

/**
 * The canonical refusal texts. They are written once, here, and never by the
 * model, so every refusal a reader sees says the same thing in the same words.
 */

export const NOTICE =
  "AI-generated, unofficial. Transit Delivery Atlas is independent analysis, not an official State of California website, and nothing here is a compliance determination or an implementation status.";

export interface Pointer {
  label: string;
  href: string;
}

export interface Refusal {
  reason: Exclude<Intent, "directive-lookup" | "evidence-lookup">;
  text: string;
  pointers: Pointer[];
}

export function complianceRefusal(pointers: Pointer[]): Refusal {
  return {
    reason: "compliance-verdict",
    text:
      "The Atlas does not say whether a body is complying, on track, late, or finished, and this layer will not either. What it can give you is the directive's source language, the bodies the order names, the timing the order states and its arithmetic, and the reviewed public evidence that cites the order, or the statement that none is linked and when the listed sources were last checked. Ask for any of those.",
    pointers,
  };
}

export function outOfScopeRefusal(pointers: Pointer[]): Refusal {
  return {
    reason: "out-of-scope",
    text:
      "That question is outside what the Atlas records. This layer answers only about the twenty-one actionable directives of Executive Order N-7-26: their source language, the bodies the order names, the timing the order states, and the reviewed public evidence that cites the order. It does not cover general transit policy, funding politics, other orders, or anything the crosswalk does not record.",
    pointers,
  };
}

export function unknownDirectiveRefusal(pointers: Pointer[]): Refusal {
  return {
    reason: "unknown-directive",
    text:
      "The Atlas does not record a directive matching that reference. The order's actionable directives are 1(a) through 1(g), 2, 3(a) through 3(j), 4, 5, and 6; the filing clause and the non-enforceability notice are recorded separately as order metadata. Name one of those, or describe the subject, and the answer will come from that record.",
    pointers,
  };
}

export function tooVagueRefusal(pointers: Pointer[]): Refusal {
  return {
    reason: "too-vague",
    text:
      "The question does not say which directive or which part of its record it is about, and this layer will not guess. Name a directive (for example 1(a) or 3(b)), a body (Caltrans, CalSTA, the CTC), or a subject, and say whether you want the source language, the named bodies, the timing, or the reviewed evidence.",
    pointers,
  };
}

export function refusalFor(intent: Refusal["reason"], pointers: Pointer[]): Refusal {
  switch (intent) {
    case "compliance-verdict":
      return complianceRefusal(pointers);
    case "out-of-scope":
      return outOfScopeRefusal(pointers);
    case "unknown-directive":
      return unknownDirectiveRefusal(pointers);
    case "too-vague":
      return tooVagueRefusal(pointers);
  }
}
