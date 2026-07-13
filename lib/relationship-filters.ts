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
