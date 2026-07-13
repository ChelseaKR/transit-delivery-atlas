# Relationship model

The handoff view is a navigational index over two different kinds of
relationships. It does not create a workflow graph.

## Layer 1: relationships stated in the signed source

The body-and-group index is derived only from three directive fields:

- `leadOrgIds` becomes **Explicit lead**
- `collaboratorOrgIds` becomes **Explicit collaborator**
- `mentionedOrgIds` becomes **Other named party**

The current dataset contains 50 such links across 23 body and role-group
records. The label “body or group” is deliberate: some records identify a
class of participants, such as local agencies or grantees, rather than one
incorporated organization.

These are directive-level classifications. Sections 5 and 6 contain compound
actions, so a card must not be read as evidence that every named party has the
same role in every clause. The Section 3 preamble remains shared source context
and is not multiplied into ten directive-level assignments.

## Layer 2: relationships stated in independent analysis

Each analysis record has one or more inferred dependency statements. A
dependency can list `relatedDirectiveIds`. The handoff view presents:

- every current dependency statement;
- its originating analytical record;
- the exact dependency text, origin, and confidence label;
- any related directive IDs already stored with that statement.

The current analytical layer contains 21 dependency statements and 27
cross-references. Those references form 15 unique directive pairs, 12 of which
are reciprocal.

The data does not define a controlled workflow direction. Therefore:

- a reference is not labeled upstream, downstream, blocking, or prerequisite;
- a reciprocal reference means two analytical records point to each other, not
  that work officially moves both ways;
- confidence describes the independent interpretation and does not rank
  importance, effort, risk, priority, or progress;
- the absence of a related directive ID does not mean a directive is
  independent in practice.

## Normalized exports

Two generated CSVs make the embedded arrays easier to inspect:

- `directive-organizations.csv` contains one row per explicit source-role link;
- `directive-relationships.csv` contains one row per analytical
  cross-reference.

Both files carry the canonical JSON schema version. In the analytical export,
`record_directive_id` identifies the record containing the dependency
statement. It is provenance, not a claim about delivery direction.

Product and data-contract versions are independent. Product release 0.3 adds
the relationship interface and normalized derivatives without changing the
canonical JSON shape, so the public JSON schema remains at version 0.2.0.

The normalized tables are deterministic derivatives. Canonical edits still
belong in `data/directives.json`, `data/analysis.json`, or the referenced
registries; generated CSV files should not be edited directly.

## Accessibility approach

The primary representation is semantic text in ordered lists, headings, links,
and native filter controls. Decorative rails and node shapes duplicate the
written layer and role labels, are hidden from assistive technology, and are
not required to discover any relationship. The view does not use a draggable
canvas, hover-only graph, or color-only legend.

## Review rules

Relationship changes must preserve the source/analysis boundary:

1. Verify source-role corrections against the signed source and its locator.
2. Review analytical dependency text and related IDs separately.
3. Reject self-links, duplicate role assignments, orphan references, and
   status-like fields.
4. Regenerate exports and verify that the UI and CSV counts match canonical
   records.
5. Document any future controlled edge types before presenting directional
   handoffs.
