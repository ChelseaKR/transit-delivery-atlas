# Expert and usability review guide

This guide turns the Transit Delivery Atlas launch hypotheses and the four-field
TDA/NTD feasibility slice into short, repeatable review sessions. It is a
facilitation script, not evidence that any review has occurred.

## Review goals

1. Confirm that a reader can find a named organization or timing clause in under
   30 seconds.
2. Test whether readers understand the boundary between source language and
   independent analysis.
3. Challenge the TDA/NTD field definitions, feasibility classifications, controls,
   and missing evidence.
4. Collect specific corrections with a source and locator, rather than general
   reactions alone.

Do not collect passwords, production credentials, passenger-level data,
personally identifiable information, protected security information, or
confidential agency records. A reviewer may describe a source system without
sharing its data.

## Suggested reviewers

Recruit at least three people whose experience covers different parts of the
workflow:

- A person who prepares or reviews a California transit-operator Financial
  Transactions Report
- A rural or small-agency NTD preparer, Caltrans/OTGC reporting specialist, or
  consultant who supports that work
- A transit finance, operations-data, audit, or performance-reporting specialist

For the five lightweight usability checks, include people who did not help build
the Atlas. A policy or program reader, journalist or researcher, and transit
advocate would provide useful variation.

## Invitation template

**Subject:** 30-minute review: California transit reporting crosswalk

I built Transit Delivery Atlas, an independent source-linked reading of California
Executive Order N-7-26. I am testing a narrow research slice comparing four fields
in the State Controller's Transit Operator Financial Transactions Report and the
National Transit Database reduced-reporting framework.

Would you be willing to spend 30 minutes reviewing it? I am looking for errors,
missing reporting distinctions, and evidence that would change the automation
boundary—not endorsement. No preparation or nonpublic data is needed. I will send
the public links and a short set of tasks.

## Session A: Atlas usability check — 15 minutes

Give the participant the live home page without demonstrating the interface.
Ask them to share their screen or describe each step. Record completion time,
path, answer, and any hesitation; do not coach until the task ends.

1. Find the directive about automating reporting for rural and small agencies.
2. Identify the organization explicitly named as its lead.
3. Find any directive with an explicit completion clock and state what the Atlas
   says about the calculated date.
4. Explain which content is signed source material and which content is
   independent analysis.
5. Filter to a useful subset, copy the URL, reopen it, and confirm the same subset
   appears.

After the tasks, ask:

- What did you expect to find but could not?
- What looked official even though it was not?
- What would you share with a colleague?
- Which label or explanation should change first?

### Usability capture

| Reviewer | Task | Completed | Seconds | Wrong turns or hesitation | Follow-up |
|---|---:|---|---:|---|---|
|  | 1 |  |  |  |  |
|  | 2 |  |  |  |  |
|  | 3 |  |  |  |  |
|  | 4 |  |  |  |  |
|  | 5 |  |  |  |  |

Calculate the median time for Tasks 2 and 3 after five sessions. Preserve failed
attempts in the calculation; a timeout should be recorded at the chosen limit,
not omitted.

## Session B: TDA/NTD expert review — 30 minutes

Open `/research/tda-ntd` and begin by stating the proposed boundary:

> The prototype would prepare draft values and an audit trail. It would not log
> in, certify, sign, or submit either report.

Ask these questions before walking through individual fields:

1. Which reporter path do you work with: direct urban reduced reporting,
   California rural Section 5311 reporting through Caltrans, both, or neither?
2. What systems or workpapers produce the four values today?
3. At what grain do those systems retain entity, fiscal year, mode, type of
   service, geography, and actual-versus-estimated method?
4. Where does human judgment enter the workflow?
5. Which current Caltrans intake workbook, validation rules, or reporting calendar
   is missing from the public evidence set?

Then review each field:

### Passenger boardings / UPT

- Do current TDA and NTD workpapers start from the same boarding records?
- Which inclusion rules or service types cause different totals?
- Are counts actual, estimated, or mixed? How is that provenance retained?
- What APC, sampling, or benchmarking review is performed?

### Vehicle revenue miles

- Is actual operated service distinguishable from scheduled service?
- How are deadhead, pull-out/pull-in, no-shows, taxi, demand response, and
  purchased transportation represented?
- Can every exclusion be reproduced from retained source records?

### Vehicle revenue hours

- Are running, layover/recovery, deadhead, breaks, interruptions, and
  out-of-service time separate events?
- Can the source produce both mode/type-of-service totals and California day-type
  subtotals?
- Where are manual adjustments made and approved?

### Operating expense

- Is there a maintained chart-of-accounts crosswalk to the State Controller form
  and NTD USOA?
- How are depreciation, amortization, leases, interest, capitalization,
  reconciling items, shared costs, and purchased transportation handled?
- Which figures tie to audited statements, and when are those figures available?
- Who owns and approves the reconciliation?

## Evidence and correction capture

For every proposed change, record:

| Item | Current claim | Proposed change | Primary source | Exact locator | Reviewer confidence | Follow-up owner |
|---|---|---|---|---|---|---|
|  |  |  |  |  |  |  |

Distinguish among:

- **Source correction:** a published definition, field name, form, date, or
  reporting relationship is wrong.
- **Analytical change:** the source is accurate, but the feasibility finding,
  confidence, control, or evidence gap should change.
- **Implementation evidence:** a source system, workpaper, or workflow exists,
  but it may not be public or reusable.

Do not add implementation evidence to the public dataset until its publication,
permission, retention, and review conditions are explicit.

## Prototype entry criteria

Proceed from research to a data prototype only when the review supports all of
the following:

1. The current OTGC rural intake format and validation rules are available for
   review, or the prototype is explicitly limited to direct urban reduced
   reporting.
2. At least two representative agencies can export actual source data at the
   required grain without exposing sensitive records.
3. Each field has a named source, transformation, exception path, reviewer, and
   report-specific validation rule.
4. The operating-expense reconciliation ties to authoritative financial records.
5. The output remains a draft review packet; login, certification, signature, and
   submission stay out of scope.

If evidence contradicts a classification, downgrade it before expanding the
prototype. Record accepted changes in the changelog and advance the research
review date only after the corresponding source and analytical reviews are
complete.
