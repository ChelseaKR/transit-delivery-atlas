import {
  directives,
  evidenceRecords,
  organizations,
  watchlistItems,
  type DirectiveView,
  type EvidenceRecord,
  type Organization,
  type WatchlistItem,
} from "@/lib/data";
import {
  organizationKindLabels,
  sourceRoleLabels,
  type SourceRole,
} from "@/lib/relationships";

/**
 * One organization's record, assembled from committed data at build time.
 *
 * The handoff view indexes bodies but gives none of them a permalink, so the
 * three things a reader of a single body needs — what the order says about it,
 * what public artifacts its own name is on, and what the analytical layer says
 * near it — have nowhere to meet without blurring. They meet here, each under
 * its own label, in the order the directive page uses: source, then evidence,
 * then analysis, then context.
 *
 * Two rules keep the assembly honest.
 *
 * A source-role appearance is exactly the directive-level field it came from,
 * carried with the locator and excerpt that support it. Nothing is inferred
 * about which action inside a compound directive a named body owns; the
 * methodology says in terms that action-level responsibility records do not
 * exist, and a page per body is precisely where inventing one would be easiest.
 *
 * Evidence and watchlist attribution is by exact publisher string against the
 * registry name, never by substring, prefix, or short name. A loose match is
 * how "the FTA" acquires a document the Federal Highway Administration
 * published, and a body with nothing attributed to it renders as a body with
 * nothing attributed to it: the page says so in words rather than showing an
 * empty list that reads as a zero.
 */
export interface SourceRoleAppearance {
  directiveId: string;
  label: string;
  title: string;
  order: number;
  section: string;
  pages: number[];
  excerpt: string;
}

export interface AnalyticalMention {
  directiveId: string;
  label: string;
  title: string;
  text: string;
  confidence: string;
  origin: string;
}

export interface OrganizationRecord {
  id: string;
  name: string;
  shortName: string;
  kind: Organization["kind"];
  kindLabel: string;
  roles: { role: SourceRole; label: string; appearances: SourceRoleAppearance[] }[];
  sourceRoleLinks: number;
  directiveCount: number;
  ledDirectiveIds: string[];
  analyticalMentions: AnalyticalMention[];
  evidence: EvidenceRecord[];
  watchlist: WatchlistItem[];
}

const ROLE_FIELDS: { role: SourceRole; idsOf: (directive: DirectiveView) => string[] }[] = [
  { role: "lead", idsOf: (directive) => directive.leadOrgIds },
  { role: "collaborator", idsOf: (directive) => directive.collaboratorOrgIds },
  { role: "mentioned", idsOf: (directive) => directive.mentionedOrgIds },
];

function appearance(directive: DirectiveView): SourceRoleAppearance {
  return {
    directiveId: directive.id,
    label: directive.label,
    title: directive.title,
    order: directive.order,
    section: directive.locator.section,
    pages: directive.locator.pages,
    excerpt: directive.excerpt,
  };
}

function rolesFor(organizationId: string) {
  return ROLE_FIELDS.map(({ role, idsOf }) => ({
    role,
    label: sourceRoleLabels[role],
    appearances: directives
      .filter((directive) => idsOf(directive).includes(organizationId))
      .map(appearance),
  })).filter(({ appearances }) => appearances.length > 0);
}

/**
 * Dependency statements on the directives this body explicitly leads.
 *
 * Analysis, and labelled as analysis wherever it renders. It is attached to the
 * body only through the source-role field, so the page never implies that an
 * analyst's dependency statement is something the body said or agreed to.
 */
function analyticalMentionsFor(organizationId: string): AnalyticalMention[] {
  return directives
    .filter((directive) => directive.leadOrgIds.includes(organizationId))
    .flatMap((directive) =>
      directive.analysis.dependencies.map((dependency) => ({
        directiveId: directive.id,
        label: directive.label,
        title: directive.title,
        text: dependency.text,
        confidence: dependency.confidence,
        origin: dependency.origin,
      })),
    );
}

/** Exact publisher match against the registry name. Never a substring. */
function publishedBy<T extends { publisher: string }>(records: T[], name: string): T[] {
  return records.filter((record) => record.publisher === name);
}

export const organizationRecords: OrganizationRecord[] = organizations
  .map((organization) => {
    const roles = rolesFor(organization.id);
    return {
      ...organization,
      kindLabel: organizationKindLabels[organization.kind],
      roles,
      sourceRoleLinks: roles.reduce((total, { appearances }) => total + appearances.length, 0),
      // Distinct directive units, not appearances: a body named as both lead and
      // collaborator on one unit is named in one unit, and counting it twice would
      // widen its footprint without anything in the order having widened.
      directiveCount: new Set(
        roles.flatMap(({ appearances }) => appearances.map((item) => item.directiveId)),
      ).size,
      ledDirectiveIds: directives
        .filter((directive) => directive.leadOrgIds.includes(organization.id))
        .map((directive) => directive.id),
      analyticalMentions: analyticalMentionsFor(organization.id),
      evidence: publishedBy(evidenceRecords, organization.name),
      watchlist: publishedBy(watchlistItems, organization.name),
    };
  })
  .sort((a, b) => a.name.localeCompare(b.name, "en"));

export function organizationById(id: string): OrganizationRecord | undefined {
  return organizationRecords.find((record) => record.id === id);
}

/**
 * Totals the index page prints, derived rather than typed.
 *
 * `sourceRoleLinks` is the sum over the pages themselves, so the figure the
 * index states is the figure the pages between them contain. A hand-maintained
 * count would keep reading correctly after the data moved underneath it.
 */
export const organizationTotals = {
  organizations: organizationRecords.length,
  sourceRoleLinks: organizationRecords.reduce(
    (total, record) => total + record.sourceRoleLinks,
    0,
  ),
  withoutSourceRoleLinks: organizationRecords.filter((record) => record.sourceRoleLinks === 0)
    .length,
};
