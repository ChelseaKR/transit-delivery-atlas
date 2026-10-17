# Review worksheet: planned review dates, October 2026

**Prepared 2026-10-17. This is not a review.** No source was read by a person for
this document, no record was re-dated, and nothing under `data/` was edited. It lists
what a reviewer needs to do so that a real review can be done quickly and recorded
honestly. Anything under "Upstream pointers" is unreviewed and must not be copied into
a record, an excerpt or a limitation until a person has read the source.

Moving a `nextReviewOn` without re-reviewing the source is the one thing
[`AGENTS.md`](../AGENTS.md) treats as dishonest. A release that is blocked stays blocked
until the review is genuine.

## 1. Where the dates stand

Measured with `node scripts/validate-data.mjs` on 2026-10-17 (build date 2026-10-17).
The gate's grace window is 14 days (`REVIEW_GRACE_DAYS`, `lib/watchlist-review.mjs`);
an item fails the release when it is more than 14 days past its planned date.

| Item | File | Planned review | Last reviewed | Days past planned | Release blocked since |
|---|---|---|---|---|---|
| `evidence-collection` | `data/evidence.json` | 2026-09-18 | 2026-08-21 | 29 | 2026-10-03 |
| `fta-2026-07-27-bus-low-no-nofo` | `data/watchlist.json` | 2026-09-21 | 2026-07-28 | 26 | 2026-10-06 |
| `ctc-2026-08-03-sccp-north-hearing` | `data/watchlist.json` | 2026-10-16 | 2026-08-21 | 1 | blocks from 2026-10-31 |
| `ctc-2026-08-20-21-meeting-materials-watch` | `data/watchlist.json` | 2026-10-16 | 2026-08-21 | 1 | blocks from 2026-10-31 |
| `caltrans-2026-07-17-d4-transit-needs-assessment` | `data/watchlist.json` | 2026-10-24 | 2026-07-28 | not yet | would block from 2026-11-08 |
| `caltrans-transit-project-database-watch` | `data/watchlist.json` | 2026-10-24 | 2026-07-28 | not yet | would block from 2026-11-08 |

The first two are beyond the grace window. The two 2026-10-16 items passed their
planned date yesterday and are inside it; they are listed because the same visit to the
Commission's pages covers them. The two 2026-10-24 items are listed because
that date is also the calculated planning date below.

The 2026-10-24 planning date. Directives 1(a) through 1(g) each say "Within 120 days of
this Order", which the Atlas calculates as 2026-10-24 (120 calendar days after the
effective date). `data/evidence.json` `reviewCommitment` promises a further sweep "in the
week after" that date, so 2026-10-25 to 2026-10-31. After the date the Atlas says it has
passed, with the arithmetic. It does not say anything about whether a directive was met.
That sweep is a second review, separate from the ones below.

The two Commission watchlist items and the evidence collection draw on the same
Commission pages, so one visit to those pages serves all three. The FTA item needs its own.

## 2. How to do the review

1. Run `npm run sweep -- --write-draft` from a machine that can reach the sources. It
   fetches every `reviewSources[]` and watchlist URL twice, writes `.sweep/worksheet.md`
   and `.sweep/draft.json` (both untracked), and edits nothing in `data/`.
2. Read each page yourself. The sweep says what moved; it does not say what it means.
3. Apply changes by hand, as listed in section 5, then `npm run data:export` and
   `npm run check`.

A source that cannot be retrieved is recorded `retrieval-failed` and its
`lastCheckedOn` does not move. That is correct and it still counts as a review of the
other sources.

## 3. The evidence collection (`data/evidence.json`)

Seven committed review sources. For each one the reviewer confirms whether any artifact
now cites Executive Order N-7-26 (or "Order 5", etc.) for the listed directives, and
whether anything new qualifies as an evidence record under
[`docs/EVIDENCE-MODEL.md`](EVIDENCE-MODEL.md).

| Source id | URL | Covers | Last outcome | What the reviewer checks |
|---|---|---|---|---|
| `ctc-commission-meetings` | https://catc.ca.gov/meetings-events/commission-meetings | 5 | checked 2026-08-21 | Meetings and books after the August 20-21 meeting; any item citing N-7-26. Minutes or resolutions for the August items. |
| `ctc-workshops` | https://catc.ca.gov/meetings-events/workshops | 5 | checked 2026-08-21 | Workshop entries after the July 15 Efficient Land Use and Housing workshop. |
| `calsta-press-releases` | https://calsta.ca.gov/press-releases | 4, 5 | checked 2026-08-21 | Releases after August 12, 2026 that cite the order. |
| `caltrans-news-releases` | https://dot.ca.gov/news-releases | 1(a)-1(g), 2, 3(a)-3(j), 5, 6 | checked 2026-08-21 | Releases after August 18, 2026 that cite the order. |
| `caltrans-rail-and-mass-transportation` | https://dot.ca.gov/programs/rail-and-mass-transportation | 1(a)-1(d), 2, 3(b), 6 | checked 2026-08-21 | Whether the page text now refers to N-7-26 or an executive order. |
| `governor-newsroom` | https://www.gov.ca.gov/newsroom/ | all 21 (1(a) to 6) | checked 2026-08-21 | Entries after August 21; only page one was read last time, so say how far back this review went. |
| `chsra-newsroom` | https://hsr.ca.gov/about/newsroom/ | 4 | **retrieval-failed** 2026-08-21 | Bot protection blocked the last sweep. Directive 4 is "not yet reviewed" at this source until a person reads it. Try in a browser. |

If a person records `checked` here, `lib/evidence-coverage.mjs` may move a directive from
`not-yet-reviewed` to `checked-none-found`. That is a fact about the Atlas's search with a
date and a source list, not a status. Do not record `checked` for a page you did not read.

The four existing evidence records were last reviewed 2026-07-22 and 2026-08-21. They are
not past a planned date. If you have network access, `npm run evidence:verify` compares
each artifact's served bytes with its recorded SHA-256.

## 4. The context watchlist (`data/watchlist.json`)

### `fta-2026-07-27-bus-low-no-nofo` (past its date, beyond grace)

- URL: https://www.transit.dot.gov/notices-funding/fy-2026-notice-funding-opportunity-grants-buses-and-bus-facilities-infrastructure
- Source date: 2026-07-27, kind `published`. The record says applications are due
  September 21, 2026, which is also its `nextReviewOn`. That date has passed.
- Boundary on record: `no-explicit-order-citation`, checked 2026-07-28.
- The reviewer checks: (a) the page still says what the summary says, and whether it was
  amended or closed; (b) the two `watchFor` items: Caltrans or CalSTA applicant guidance
  tying this program to N-7-26, and a later California funding crosswalk or award record
  with an explicit directive citation; (c) whether the page now cites N-7-26 itself,
  which would move this out of the watchlist.

### `ctc-2026-08-03-sccp-north-hearing` (1 day past)

- URL: https://catc.ca.gov/-/media/ctc-media/documents/programs/sccp/final-north-sccp-hearing-agenda-a11y.pdf
- Related: https://catc.ca.gov/meetings-events/commission-meetings
- Source date: 2026-08-03, `scheduled-event`. Already reviewed after that date.
- The reviewer checks: minutes, a hearing record, a recording or an adopted resolution for
  the 2026 SCCP guidelines that explicitly cites N-7-26; whether the July 15 transit-priority
  and first- and last-mile proposals appear in the adopted guidelines.

### `ctc-2026-08-20-21-meeting-materials-watch` (1 day past)

- URL: https://catc.ca.gov/meetings-events/commission-meetings/2026-08-20-21
- Source date: 2026-08-20, `scheduled-event`.
- The reviewer checks: minutes or adopted resolutions G-26-60 and G-26-64 that explicitly
  cite N-7-26; an adoption date and an exact locator for any Order 5 guideline language in
  the final guidelines. If such language is found it is a new evidence record with hash,
  locator and limitations, and this watchlist item is removed or narrowed.

### `caltrans-2026-07-17-d4-transit-needs-assessment` (due 2026-10-24)

- URL: https://dot.ca.gov/caltrans-near-me/district-4/d4-news/2026-07-17-district-transit-plan
- The reviewer checks: a statewide Caltrans methodology, project list or design package that
  cites N-7-26 and incorporates the district work; a public crosswalk explaining how District 4
  materials feed the Section 1 deliverables. Relevant to the directive 1(a) planning date.

### `caltrans-transit-project-database-watch` (due 2026-10-24)

- URL: https://dot.ca.gov/programs/transportation-planning/division-of-transportation-planning/office-of-transit-planning
- No source date is stored (the page is undated and `retrievedOn` is never substituted).
- The reviewer checks: whether the Transit Project Database and Transit Policy Implementation
  Branch are still "coming soon"; if launched, documented statewide coverage, fields, update
  cadence and official purpose; any explicit N-7-26 citation or published link to the
  directive 1(a) priority-project list.

## 5. Exact fields to update after a real review

Update these together, and only for sources a person actually read. A field not listed here
is not to be touched by a review.

### Evidence collection, `data/evidence.json`

| Field | Update |
|---|---|
| `reviewSources[].lastCheckedOn` | The date the source was read, for each source actually read. |
| `reviewSources[].lastCheckOutcome` | `checked` only for a page that returned content a person read; otherwise `retrieval-failed`. |
| `reviewSources[].note` | What was read and how far back (at least 30 characters, per schema). Say if only page one was read. |
| `reviewSources[].lastObservation` | Optional. `{sha256, basis, mentionsOrder, observedOn}` copied from `.sweep/draft.json`; this becomes the next sweep's baseline. |
| `sweeps[]` | Append `{sweptOn, sourceIds, addedEvidenceIds, note}`. Record a sweep even if it adds nothing. |
| `evidence[]` | Add a full record only for an artifact that explicitly cites the order, with hash, locator and limitations. |
| `lastUpdatedOn` | The latest sweep date (the model ties it to the latest sweep). |
| `nextReviewOn` | The date of the next planned sweep, chosen by the reviewer. |
| `reviewCommitment` | Only if the commitment itself changes. |

### Watchlist item, `data/watchlist.json`

| Field | Update |
|---|---|
| `items[].lastReviewedOn` | The date the source was read. |
| `items[].evidenceBoundary.checkedOn` | Same date; and re-state `note` if the finding changed. |
| `items[].nextReviewOn` | The next planned check, chosen by the reviewer. |
| `items[].editorialSummary`, `whyTracked`, `watchFor`, `limitations` | Only if the source now says something different. Rewrite from the source, in the Atlas's own words. |
| `items[].sourceDate` | Only if the publisher shows a date; never substitute `retrievedOn`. |
| `items[].retrievedOn` | The date the page was fetched, if it was. |
| `lastUpdatedOn` (top of file) | The review date. |
| Item removal or `sourceDate` change | A source that now cites the order is promoted to `evidence.json` and the watchlist item removed or narrowed, with a changelog entry. |

### Then

- `npm run data:export` to regenerate `public/data/` (committed; CI diffs it).
- `npm run check`, which runs the same date check.
- A `CHANGELOG.md` entry that says what was read and what changed, in the Atlas's wording
  rules (no "late", "missed", "on track", "overdue" in anything a reader can see).
- Land the data change on its own, separate from code, because source, evidence, analysis
  and watchlist changes are reviewed separately.

## 6. Upstream pointers (UNREVIEWED)

**Read this as a lead list.** Direct fetches of the review sources were not possible from
the machine this worksheet was prepared on: `npm run sweep` reported that none of the 12
sources produced a response, and the sandbox's egress policy denied the hosts, so there is
no digest, no `lastObservation`, and no first-hand comparison. The lines below come from a
general web search summary on 2026-10-17. No person has read the sources behind them.
They have no standing as evidence or as watchlist content.

- **CTC adoption of the 2026 SCCP guidelines.** The search summary indicates the Commission
  adopted the 2026 SCCP guidelines under Resolution G-26-60 at its August 20-21, 2026
  meeting, with a fifth-cycle call for projects (applications due November 19, 2026).
  If a person confirms this on the Commission's pages, it bears on
  `ctc-2026-08-20-21-meeting-materials-watch` and on the existing evidence record
  `ctc-2026-08-20-sccp-guidelines-adoption-item`.
  Pointer: https://catc.ca.gov/programs/sb1/solutions-for-congested-corridors-program
- **FTA FY 2026 Buses and Low-No NOFO.** The search summary agrees with the record on the
  published date and the September 21, 2026 application deadline, and found no announcement
  of selections from this NOFO. Whether FTA has since posted selections is not known here.
  Pointer: https://www.transit.dot.gov/notices-funding/fy-2026-notice-funding-opportunity-grants-buses-and-bus-facilities-infrastructure
- No searches were run for the other sources. Absence of a pointer here means nothing.

## 7. What this worksheet does not change

- No `nextReviewOn`, `lastReviewedOn`, `lastCheckedOn`, `lastObservation` or `sweeps[]` entry.
- No record added, removed or reworded; no exports regenerated.
- The release gate stays red until a person completes sections 3 and 4.
