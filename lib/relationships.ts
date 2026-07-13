import {
  directiveById,
  directives,
  organizations,
  type Organization,
  type Theme,
} from "@/lib/data";

export type SourceRole = "lead" | "collaborator" | "mentioned";

export const sourceRoleLabels: Record<SourceRole, string> = {
  lead: "Explicit lead",
  collaborator: "Explicit collaborator",
  mentioned: "Other named party",
};

export const organizationKindLabels: Record<Organization["kind"], string> = {
  "state-agency": "State agency",
  "state-commission": "State commission",
  "state-program": "State program",
  "state-office": "State office",
  "federal-agency": "Federal agency",
  "role-group": "Named role group",
};

export interface DirectiveSummary {
  id: string;
  label: string;
  title: string;
  order: number;
}

export interface OrganizationOccurrence extends DirectiveSummary {
  role: SourceRole;
}

export interface NamedBodyRecord {
  id: string;
  name: string;
  shortName: string;
  kind: Organization["kind"];
  kindLabel: string;
  occurrences: OrganizationOccurrence[];
}

export interface DependencyRoute {
  id: string;
  directive: DirectiveSummary;
  text: string;
  origin: "inferred";
  confidence: "low" | "medium" | "high";
  themes: Theme[];
  relatedDirectives: DirectiveSummary[];
}

export interface AnalyticalReference {
  fromDirective: DirectiveSummary;
  relatedDirective: DirectiveSummary;
  dependencyText: string;
  origin: "inferred";
  confidence: "low" | "medium" | "high";
  reciprocal: boolean;
}

function directiveSummary({ id, label, title, order }: DirectiveSummary): DirectiveSummary {
  return { id, label, title, order };
}

function analyticalOrigin(value: string): "inferred" {
  if (value !== "inferred") throw new Error(`Unsupported analytical origin: ${value}`);
  return value;
}

function analyticalConfidence(value: string): DependencyRoute["confidence"] {
  if (value === "low" || value === "medium" || value === "high") return value;
  throw new Error(`Unsupported analytical confidence: ${value}`);
}

export const directiveOrganizationAssignments = directives.flatMap((directive) => {
  const summary = directiveSummary(directive);
  return [
    ...directive.leadOrganizations.map((organization) => ({
      ...organization,
      directive: summary,
      role: "lead" as const,
    })),
    ...directive.collaboratorOrganizations.map((organization) => ({
      ...organization,
      directive: summary,
      role: "collaborator" as const,
    })),
    ...directive.mentionedOrganizations.map((organization) => ({
      ...organization,
      directive: summary,
      role: "mentioned" as const,
    })),
  ];
});

export const namedBodies: NamedBodyRecord[] = organizations
  .map((organization) => ({
    ...organization,
    kindLabel: organizationKindLabels[organization.kind],
    occurrences: directiveOrganizationAssignments
      .filter((assignment) => assignment.id === organization.id)
      .map(({ directive, role }) => ({ ...directive, role })),
  }))
  .filter(({ occurrences }) => occurrences.length > 0);

export const dependencyRoutes: DependencyRoute[] = directives.flatMap((directive) =>
  directive.analysis.dependencies.map((dependency, dependencyIndex) => ({
    id: `${directive.id}-dependency-${dependencyIndex + 1}`,
    directive: directiveSummary(directive),
    text: dependency.text,
    origin: analyticalOrigin(dependency.origin),
    confidence: analyticalConfidence(dependency.confidence),
    themes: directive.themes,
    relatedDirectives: dependency.relatedDirectiveIds.map((relatedId) => {
      const related = directiveById(relatedId);
      if (!related) throw new Error(`Missing related directive: ${relatedId}`);
      return directiveSummary(related);
    }),
  })),
);

function hasReverseReference(fromDirectiveId: string, relatedDirectiveId: string): boolean {
  const related = directiveById(relatedDirectiveId);
  return Boolean(
    related?.analysis.dependencies.some((dependency) =>
      dependency.relatedDirectiveIds.includes(fromDirectiveId),
    ),
  );
}

export const analyticalReferences: AnalyticalReference[] = dependencyRoutes.flatMap((route) =>
  route.relatedDirectives.map((relatedDirective) => ({
    fromDirective: route.directive,
    relatedDirective,
    dependencyText: route.text,
    origin: route.origin,
    confidence: route.confidence,
    reciprocal: hasReverseReference(route.directive.id, relatedDirective.id),
  })),
);

export const relationshipTotals = {
  namedBodies: namedBodies.length,
  sourceRoleLinks: directiveOrganizationAssignments.length,
  dependencyStatements: dependencyRoutes.length,
  analyticalReferences: analyticalReferences.length,
};
