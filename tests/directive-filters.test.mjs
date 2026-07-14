import assert from "node:assert/strict";
import test from "node:test";
import {
  parseDirectiveFilters,
  serializeDirectiveFilters,
} from "../lib/directive-filters.mjs";

const validValues = {
  themeIds: ["funding-grants", "data-shared-systems"],
  leadIds: ["caltrans", "calsta"],
};

test("parses valid directive filters from their stable query parameters", () => {
  const filters = parseDirectiveFilters(
    new URLSearchParams(
      "q=grant&theme=funding-grants&lead=caltrans&timing=explicit",
    ),
    validValues,
  );

  assert.deepEqual(filters, {
    query: "grant",
    theme: "funding-grants",
    lead: "caltrans",
    timing: "explicit",
  });
});

test("ignores unknown select values while retaining the free-text query", () => {
  const filters = parseDirectiveFilters(
    new URLSearchParams(
      "q=rail&theme=unknown&lead=unknown&timing=sometime",
    ),
    validValues,
  );

  assert.deepEqual(filters, {
    query: "rail",
    theme: "",
    lead: "",
    timing: "",
  });
});

test("serializes non-empty filters in a stable order and preserves unrelated parameters", () => {
  const current = new URLSearchParams(
    "ref=newsletter&q=old&theme=old&lead=old&timing=none",
  );
  const search = serializeDirectiveFilters(
    {
      query: "bus rapid transit",
      theme: "funding-grants",
      lead: "caltrans",
      timing: "explicit",
    },
    current,
  );

  assert.equal(
    search,
    "ref=newsletter&q=bus+rapid+transit&theme=funding-grants&lead=caltrans&timing=explicit",
  );
  assert.equal(
    current.toString(),
    "ref=newsletter&q=old&theme=old&lead=old&timing=none",
  );
});

test("omits empty filters when serializing a reset", () => {
  assert.equal(
    serializeDirectiveFilters(
      { query: "", theme: "", lead: "", timing: "" },
      new URLSearchParams("q=old&theme=old&ref=shared"),
    ),
    "ref=shared",
  );
});
