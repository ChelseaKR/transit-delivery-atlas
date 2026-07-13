import analysisRaw from "@/data/analysis.json";
import directivesRaw from "@/data/directives.json";
import evidenceRaw from "@/data/evidence.json";
import organizationsRaw from "@/data/organizations.json";
import sourcesRaw from "@/data/sources.json";
import themesRaw from "@/data/themes.json";

export type Organization = (typeof organizationsRaw)[number];
export type Theme = (typeof themesRaw)[number];
export type Source = (typeof sourcesRaw)[number];
export type Directive = (typeof directivesRaw.directives)[number];
export type Analysis = (typeof analysisRaw.analysis)[number];
export type EvidenceRecord = (typeof evidenceRaw.evidence)[number];
export type SourceContext = (typeof directivesRaw.orderMetadata.sourceContexts)[number];
export type SourceNotice = (typeof directivesRaw.orderMetadata.sourceNotices)[number];

export type DirectiveView = Directive & {
  analysis: Analysis;
  leadOrganizations: Organization[];
  collaboratorOrganizations: Organization[];
  mentionedOrganizations: Organization[];
  sourceContexts: SourceContext[];
  themes: Theme[];
  evidence: EvidenceRecord[];
};

const analysisByDirective = new Map<string, Analysis>(
  analysisRaw.analysis.map((item) => [item.directiveId, item] as const),
);
const organizationById = new Map<string, Organization>(
  organizationsRaw.map((item) => [item.id, item] as const),
);
const themeById = new Map<string, Theme>(
  themesRaw.map((item) => [item.id, item] as const),
);
const sourceContextById = new Map<string, SourceContext>(
  directivesRaw.orderMetadata.sourceContexts.map((item) => [item.id, item] as const),
);
const evidenceByDirective = new Map<string, EvidenceRecord[]>();
for (const record of evidenceRaw.evidence) {
  for (const link of record.directiveLinks) {
    const records = evidenceByDirective.get(link.directiveId) ?? [];
    records.push(record);
    evidenceByDirective.set(link.directiveId, records);
  }
}

function required<K, V>(map: Map<K, V>, key: K, context: string): V {
  const value = map.get(key);
  if (!value) throw new Error(`Missing ${context}: ${String(key)}`);
  return value;
}

export const source = sourcesRaw[0];
export const themes = themesRaw;
export const organizations = organizationsRaw;
export const orderMetadata = directivesRaw.orderMetadata;
export const evidenceRecords = evidenceRaw.evidence;
export const evidenceScope = {
  scope: evidenceRaw.scope,
  lastUpdatedOn: evidenceRaw.lastUpdatedOn,
  coverageNote: evidenceRaw.coverageNote,
};

export const directives: DirectiveView[] = directivesRaw.directives.map(
  (directive) => {
    const analysis = required(
      analysisByDirective,
      directive.id,
      "analysis record",
    );
    return {
      ...directive,
      analysis,
      leadOrganizations: directive.leadOrgIds.map((id) =>
        required(organizationById, id, "organization"),
      ),
      collaboratorOrganizations: directive.collaboratorOrgIds.map((id) =>
        required(organizationById, id, "organization"),
      ),
      mentionedOrganizations: directive.mentionedOrgIds.map((id) =>
        required(organizationById, id, "organization"),
      ),
      sourceContexts: directive.sourceContextIds.map((id) =>
        required(sourceContextById, id, "source context"),
      ),
      themes: analysis.themeIds.map((id) =>
        required(themeById, id, "theme"),
      ),
      evidence: evidenceByDirective.get(directive.id) ?? [],
    };
  },
);

export const leadOrganizations = organizationsRaw.filter((organization) =>
  directives.some((directive) => directive.leadOrgIds.includes(organization.id)),
);

export function directiveById(id: string): DirectiveView | undefined {
  return directives.find((directive) => directive.id === id);
}
