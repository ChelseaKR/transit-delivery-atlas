export interface OrganizationFilterRecord {
  name: string;
  shortName: string;
  kind: string;
  kindLabel: string;
  occurrences: Array<{
    label: string;
    title: string;
    role: "lead" | "collaborator" | "mentioned";
  }>;
}

export interface OrganizationFilterState {
  query: string;
  kind: string;
  role: "" | "lead" | "collaborator" | "mentioned";
}

export interface DependencyFilterRecord {
  directive: { label: string; title: string };
  text: string;
  confidence: string;
  themes: Array<{ id: string; name: string }>;
  relatedDirectives: Array<{ label: string; title: string }>;
}

export interface DependencyFilterState {
  query: string;
  theme: string;
  confidence: string;
  connection: string;
}

const sourceRoleSearchLabels = {
  lead: "Explicit lead",
  collaborator: "Explicit collaborator",
  mentioned: "Other named party",
};

export function filterNamedBodies<T extends OrganizationFilterRecord>(
  records: T[],
  { query, kind, role }: OrganizationFilterState,
): T[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  return records.filter((record) => {
    const searchable = [
      record.name,
      record.shortName,
      record.kindLabel,
      ...record.occurrences.flatMap((occurrence) => [
        occurrence.label,
        occurrence.title,
        sourceRoleSearchLabels[occurrence.role],
      ]),
    ]
      .join(" ")
      .toLocaleLowerCase();

    return (
      (!normalizedQuery || searchable.includes(normalizedQuery)) &&
      (!kind || record.kind === kind) &&
      (!role || record.occurrences.some((occurrence) => occurrence.role === role))
    );
  });
}

export function filterDependencyRoutes<T extends DependencyFilterRecord>(
  routes: T[],
  { query, theme, confidence, connection }: DependencyFilterState,
): T[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  return routes.filter((route) => {
    const searchable = [
      route.directive.label,
      route.directive.title,
      route.text,
      route.confidence,
      ...route.themes.map((item) => item.name),
      ...route.relatedDirectives.flatMap((directive) => [
        directive.label,
        directive.title,
      ]),
    ]
      .join(" ")
      .toLocaleLowerCase();

    return (
      (!normalizedQuery || searchable.includes(normalizedQuery)) &&
      (!theme || route.themes.some((item) => item.id === theme)) &&
      (!confidence || route.confidence === confidence) &&
      (!connection ||
        (connection === "linked"
          ? route.relatedDirectives.length > 0
          : route.relatedDirectives.length === 0))
    );
  });
}

// -- Shareable URL contract for the two /handoffs explorers ------------------
//
// Both explorers live on one page, so their query parameters are namespaced
// (`b*` for the named-bodies view, `d*` for the inferred-dependency view) and
// never collide. Each parser validates against the values actually present in
// the data, dropping anything unknown while keeping the free-text query, and
// each serializer preserves parameters owned by the other explorer or by
// unrelated features. Empty values are omitted so a reset produces a clean URL.

type SourceRoleValue = OrganizationFilterState["role"];

const ORGANIZATION_PARAM_KEYS = Object.freeze({
  query: "bq",
  kind: "btype",
  role: "brole",
});

const DEPENDENCY_PARAM_KEYS = Object.freeze({
  query: "dq",
  theme: "dtheme",
  confidence: "dconf",
  connection: "dconn",
});

const SOURCE_ROLE_VALUES: readonly string[] = ["lead", "collaborator", "mentioned"];
const CONFIDENCE_VALUES: readonly string[] = ["high", "medium", "low"];
const CONNECTION_VALUES: readonly string[] = ["linked", "unlinked"];

export const EMPTY_ORGANIZATION_FILTERS: Readonly<OrganizationFilterState> = Object.freeze({
  query: "",
  kind: "",
  role: "",
});

export const EMPTY_DEPENDENCY_FILTERS: Readonly<DependencyFilterState> = Object.freeze({
  query: "",
  theme: "",
  confidence: "",
  connection: "",
});

export function parseOrganizationFilters(
  searchParams: URLSearchParams,
  validValues: { kindIds: Iterable<string> },
): OrganizationFilterState {
  const kindIds = new Set(validValues.kindIds);
  const kind = searchParams.get(ORGANIZATION_PARAM_KEYS.kind) ?? "";
  const role = searchParams.get(ORGANIZATION_PARAM_KEYS.role) ?? "";

  return {
    query: searchParams.get(ORGANIZATION_PARAM_KEYS.query) ?? "",
    kind: kindIds.has(kind) ? kind : "",
    role: SOURCE_ROLE_VALUES.includes(role) ? (role as SourceRoleValue) : "",
  };
}

export function serializeOrganizationFilters(
  filters: OrganizationFilterState,
  currentSearchParams: URLSearchParams = new URLSearchParams(),
): string {
  const next = new URLSearchParams(currentSearchParams);
  for (const key of Object.values(ORGANIZATION_PARAM_KEYS)) next.delete(key);
  if (filters.query) next.set(ORGANIZATION_PARAM_KEYS.query, filters.query);
  if (filters.kind) next.set(ORGANIZATION_PARAM_KEYS.kind, filters.kind);
  if (filters.role) next.set(ORGANIZATION_PARAM_KEYS.role, filters.role);
  return next.toString();
}

export function parseDependencyFilters(
  searchParams: URLSearchParams,
  validValues: { themeIds: Iterable<string> },
): DependencyFilterState {
  const themeIds = new Set(validValues.themeIds);
  const theme = searchParams.get(DEPENDENCY_PARAM_KEYS.theme) ?? "";
  const confidence = searchParams.get(DEPENDENCY_PARAM_KEYS.confidence) ?? "";
  const connection = searchParams.get(DEPENDENCY_PARAM_KEYS.connection) ?? "";

  return {
    query: searchParams.get(DEPENDENCY_PARAM_KEYS.query) ?? "",
    theme: themeIds.has(theme) ? theme : "",
    confidence: CONFIDENCE_VALUES.includes(confidence) ? confidence : "",
    connection: CONNECTION_VALUES.includes(connection) ? connection : "",
  };
}

export function serializeDependencyFilters(
  filters: DependencyFilterState,
  currentSearchParams: URLSearchParams = new URLSearchParams(),
): string {
  const next = new URLSearchParams(currentSearchParams);
  for (const key of Object.values(DEPENDENCY_PARAM_KEYS)) next.delete(key);
  if (filters.query) next.set(DEPENDENCY_PARAM_KEYS.query, filters.query);
  if (filters.theme) next.set(DEPENDENCY_PARAM_KEYS.theme, filters.theme);
  if (filters.confidence) next.set(DEPENDENCY_PARAM_KEYS.confidence, filters.confidence);
  if (filters.connection) next.set(DEPENDENCY_PARAM_KEYS.connection, filters.connection);
  return next.toString();
}
