import assert from "node:assert/strict";
import test from "node:test";
import {
  EMPTY_DEPENDENCY_FILTERS,
  EMPTY_ORGANIZATION_FILTERS,
  parseDependencyFilters,
  parseOrganizationFilters,
  serializeDependencyFilters,
  serializeOrganizationFilters,
} from "../lib/relationship-filters.ts";

const organizationValidValues = { kindIds: ["state-agency", "federal"] };
const dependencyValidValues = {
  themeIds: ["funding-grants", "data-shared-systems"],
};

test("parses valid named-body filters from their namespaced parameters", () => {
  const filters = parseOrganizationFilters(
    new URLSearchParams("bq=federal&btype=federal&brole=lead"),
    organizationValidValues,
  );

  assert.deepEqual(filters, {
    query: "federal",
    kind: "federal",
    role: "lead",
  });
});

test("ignores unknown named-body select values while keeping the query", () => {
  const filters = parseOrganizationFilters(
    new URLSearchParams("bq=ctc&btype=unknown&brole=chair"),
    organizationValidValues,
  );

  assert.deepEqual(filters, { query: "ctc", kind: "", role: "" });
});

test("serializes named-body filters and preserves the other explorer's parameters", () => {
  const current = new URLSearchParams("dq=data&dconf=high&bq=old&btype=old");
  const search = serializeOrganizationFilters(
    { query: "shared systems", kind: "state-agency", role: "collaborator" },
    current,
  );

  assert.equal(
    search,
    "dq=data&dconf=high&bq=shared+systems&btype=state-agency&brole=collaborator",
  );
  // The source object is not mutated.
  assert.equal(current.toString(), "dq=data&dconf=high&bq=old&btype=old");
});

test("omits empty named-body filters when serializing a reset", () => {
  assert.equal(
    serializeOrganizationFilters(
      EMPTY_ORGANIZATION_FILTERS,
      new URLSearchParams("bq=old&brole=lead&dq=keep"),
    ),
    "dq=keep",
  );
});

test("parses valid dependency filters from their namespaced parameters", () => {
  const filters = parseDependencyFilters(
    new URLSearchParams(
      "dq=permitting&dtheme=funding-grants&dconf=medium&dconn=linked",
    ),
    dependencyValidValues,
  );

  assert.deepEqual(filters, {
    query: "permitting",
    theme: "funding-grants",
    confidence: "medium",
    connection: "linked",
  });
});

test("ignores unknown dependency select values while keeping the query", () => {
  const filters = parseDependencyFilters(
    new URLSearchParams("dq=rail&dtheme=unknown&dconf=certain&dconn=maybe"),
    dependencyValidValues,
  );

  assert.deepEqual(filters, {
    query: "rail",
    theme: "",
    confidence: "",
    connection: "",
  });
});

test("serializes dependency filters and preserves the other explorer's parameters", () => {
  const current = new URLSearchParams("bq=ctc&dq=old&dtheme=old");
  const search = serializeDependencyFilters(
    {
      query: "shared data",
      theme: "data-shared-systems",
      confidence: "high",
      connection: "unlinked",
    },
    current,
  );

  assert.equal(
    search,
    "bq=ctc&dq=shared+data&dtheme=data-shared-systems&dconf=high&dconn=unlinked",
  );
  assert.equal(current.toString(), "bq=ctc&dq=old&dtheme=old");
});

test("omits empty dependency filters when serializing a reset", () => {
  assert.equal(
    serializeDependencyFilters(
      EMPTY_DEPENDENCY_FILTERS,
      new URLSearchParams("dq=old&dconn=linked&bq=keep"),
    ),
    "bq=keep",
  );
});

test("the two explorers never collide on a shared URL", () => {
  // A URL carrying both explorers' filters parses each independently.
  const params = new URLSearchParams(
    "bq=federal&btype=federal&brole=lead&dq=data&dtheme=funding-grants&dconf=high&dconn=linked",
  );

  assert.deepEqual(parseOrganizationFilters(params, organizationValidValues), {
    query: "federal",
    kind: "federal",
    role: "lead",
  });
  assert.deepEqual(parseDependencyFilters(params, dependencyValidValues), {
    query: "data",
    theme: "funding-grants",
    confidence: "high",
    connection: "linked",
  });
});
