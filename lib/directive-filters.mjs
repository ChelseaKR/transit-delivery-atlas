/**
 * @typedef {object} DirectiveFilters
 * @property {string} query
 * @property {string} theme
 * @property {string} lead
 * @property {string} timing
 */

const PARAM_KEYS = Object.freeze({
  query: "q",
  theme: "theme",
  lead: "lead",
  timing: "timing",
});

/** @type {Readonly<DirectiveFilters>} */
export const EMPTY_DIRECTIVE_FILTERS = Object.freeze({
  query: "",
  theme: "",
  lead: "",
  timing: "",
});

/**
 * Parse and validate the explorer's public URL contract.
 *
 * @param {URLSearchParams} searchParams
 * @param {{ themeIds: Iterable<string>, leadIds: Iterable<string> }} validValues
 * @returns {DirectiveFilters}
 */
export function parseDirectiveFilters(searchParams, validValues) {
  const themeIds = new Set(validValues.themeIds);
  const leadIds = new Set(validValues.leadIds);
  const theme = searchParams.get(PARAM_KEYS.theme) ?? "";
  const lead = searchParams.get(PARAM_KEYS.lead) ?? "";
  const timing = searchParams.get(PARAM_KEYS.timing) ?? "";

  return {
    query: searchParams.get(PARAM_KEYS.query) ?? "",
    theme: themeIds.has(theme) ? theme : "",
    lead: leadIds.has(lead) ? lead : "",
    timing: timing === "explicit" || timing === "none" ? timing : "",
  };
}

/**
 * Serialize filters in a fixed order while retaining query parameters owned by
 * other features. Empty filter values are intentionally omitted.
 *
 * @param {DirectiveFilters} filters
 * @param {URLSearchParams} [currentSearchParams]
 * @returns {string}
 */
export function serializeDirectiveFilters(
  filters,
  currentSearchParams = new URLSearchParams(),
) {
  const nextSearchParams = new URLSearchParams(currentSearchParams);

  for (const key of Object.values(PARAM_KEYS)) {
    nextSearchParams.delete(key);
  }

  for (const [filter, key] of Object.entries(PARAM_KEYS)) {
    const value = filters[filter];
    if (value) nextSearchParams.set(key, value);
  }

  return nextSearchParams.toString();
}
