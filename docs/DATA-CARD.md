# Data card — Transit Delivery Atlas public exports

This card describes the published dataset as a whole. The machine-readable contract for
every file — column names, types, required-ness, licence and provenance — is
[`public/data/datapackage.json`](../public/data/datapackage.json), a Frictionless Data
Package generated at build from the same values the CSVs are written from, with a
[DCAT-AP record](../public/data/dcat.jsonld) beside it for catalog harvesters.

**No number in this card is copied from the data.** Counts, review dates and the review
commitment all live in the exports themselves, where a build regenerates them; a figure
transcribed here would be a second copy of the truth, free to drift from the first. Where
this card needs to point at a value, it names the field that holds it.

## What this is

An independent, unofficial crosswalk of one signed California transit executive order:
its directive units, the organizations it names, a selective collection of reviewed
public artifacts, and a separately stored analytical layer.

It is **not** an official record, and it is not a compliance or performance assessment.
Nothing in it states whether an obligation has been met.

## Layers, and why they never blur

Every record belongs to exactly one layer, and every column name says which:

| Layer | What it holds | What it may never do |
|---|---|---|
| **Source** | Section locators, independently transcribed excerpts, the timing phrases the instrument uses, the organizations it names by role | Be edited except by a reviewed correction; the signed image controls |
| **Evidence** | Dated public artifacts with publisher, retrieval date, content hash, and their explicit links to directives | Assert that a directive was satisfied |
| **Analysis** | Summaries, themes, cross-references, calculated planning dates | Be presented as something the instrument says |
| **Context** | Non-evidentiary research leads on the watchlist | Enter the evidence layer without a recorded reason |

A calculated planning date is arithmetic on a source phrase, shown with its derivation. A
passed date is published as passed. Neither is a status.

## Classification and personal data

Public information only. The exports contain no personal data: no names of individuals,
no contact details, no user data of any kind. There are no accounts, no analytics and no
trackers on the site the exports are published from, so there is nothing to de-identify.

Organizations are public bodies, identified by their published names.

## Provenance

`datapackage.json`'s `sources` array carries, for each signed instrument: its publisher,
the URL it was retrieved from, the date it was retrieved (`retrievedOn`) and the SHA-256
of the retrieved bytes (`sha256`). The retained copy and its OCR corrections live under
`corpus/`, and every published excerpt is verified against that retained text at build.

The source instrument is a scanned, untagged signed PDF. Excerpts were transcribed
independently and reviewed by hand; where the transcription and the image could differ,
**the image controls**.

The commit a given build came from is published per build at `/version.json`, and
`datapackage.json` points at it rather than embedding it — an embedded commit would
change the package's bytes on every commit and defeat the byte-for-byte comparison that
keeps the package honest.

## Update cadence

Set by the data, not by this card:

- `evidenceScope.reviewCommitment` states what is re-checked and when.
- `evidenceScope.nextReviewOn` is the next planned sweep; every sweep is recorded in
  `evidenceScope.sweeps` whether or not it adds a record.
- `dataReviewedThrough` is the latest manual review date across the directive and
  evidence records, and is what dates the dataset.
- The context watchlist carries its own `nextReviewOn`.

A lapsed review date is published as lapsed and blocks a release after the documented
grace window. It is never quietly renewed.

## Licence

Split, and the split matters:

- This project's original analytical content and the analytical columns derived from it
  are **CC BY 4.0**.
- Source excerpts, government publications, agency names and other third-party material
  are **not relicensed** by that notice and remain under their own terms.
- Code and configuration are Apache 2.0.

`datapackage.json` names CC BY 4.0 in `licenses` and carries the split verbatim in
`licenseNotes`; the DCAT record repeats it in `dct:rights`. See
[`CONTENT-LICENSE.md`](../CONTENT-LICENSE.md).

Attribution: "Transit Delivery Atlas contributors, CC BY 4.0", with a link to the
repository and an indication of whether changes were made.

## Known limitations

- **Coverage is selective.** The evidence collection is not a census of everything
  published about the order. `evidenceScope.scope` and `coverageNote` state the selection
  rule, and they appear on every row of `evidence.csv` so a row read on its own still
  carries it.
- **Organization roles are classified at the directive level.** A compound directive that
  assigns several actions to different bodies records which organizations are named, not
  which one owns which action.
- **Cross-references are undirected.** `directive-relationships.csv` encodes relatedness
  with an origin and a confidence; it does not encode a directional handoff, and a typed
  edge vocabulary does not exist yet.
- **Analytical dependencies identify questions, not official assignments.**
- **One instrument.** The dataset covers a single signed source. A second instrument
  requires a written inclusion policy and namespaced identifiers first.
- **English only.** No locale catalog exists yet; the source language of every excerpt is
  the language it was signed in, and a translation must never replace or blur it.

## Corrections

Errors are corrected in public, against the source that justifies the correction. The
[`/corrections`](https://transit.chelseakr.com/corrections) page is the intake route, and
accepted corrections appear in `CHANGELOG.md`. A source excerpt is never rewritten except
by a reviewed correction.
