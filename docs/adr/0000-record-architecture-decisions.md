# 0. Record architecture decisions

## Status

Accepted

## Context

Transit Delivery Atlas makes a small number of consequential, hard-to-reverse
decisions — how source language, reviewed evidence, and analysis are kept
structurally separate; how the canonical records in `data/` are validated
fail-closed and exported; how the static site is built and deployed to AWS.
This is a single-maintainer public-interest project: when the maintainer's
attention moves elsewhere for a while, the reasoning behind a structural choice
must not live only in a commit message or a closed PR thread, or a later change
will either re-litigate a settled question or unknowingly reverse a decision
made for a reason nobody re-reads.

## Decision

We will record architecture decisions in **Architecture Decision Records (ADRs)**
using the format described by Michael Nygard.

- Each ADR is a short Markdown file in `docs/adr/`, numbered sequentially and named
  `NNNN-title-in-kebab-case.md`.
- Each ADR has the sections **Title**, **Status**, **Context**, **Decision**, and
  **Consequences**.
- **Status** is one of *Proposed*, *Accepted*, *Deprecated*, or *Superseded*. A
  superseded ADR is not deleted; it is marked superseded and points to the ADR that
  replaces it, and the replacement points back.
- ADRs are immutable once accepted, except to change their status. A new decision is
  a new ADR, not an edit to an old one.

This ADR is the first record and establishes the practice for all that follow.
Existing structural decisions already documented in prose (`docs/METHODOLOGY.md`,
`docs/EVIDENCE-MODEL.md`, `docs/RELATIONSHIP-MODEL.md`, `docs/AWS-HOSTING.md`)
remain where they are; future consequential changes to those models get an ADR.

## Consequences

- The reasoning behind structural decisions is preserved and versioned alongside
  the records and code it explains.
- Writing an ADR is a small, deliberate friction on consequential change —
  intended, since it makes reversing a load-bearing decision a visible act rather
  than an accident.
- ADRs add a modest maintenance habit. They capture decisions, not the full
  methodology — the evidence and relationship model documents remain the
  authoritative description of how the atlas works.
