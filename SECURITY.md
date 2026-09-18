# Security policy

## Supported versions

Security fixes apply to the current deployed release and the `main` branch.

## Reporting a vulnerability

Please use GitHub’s private vulnerability-reporting feature rather than a public
issue when a report could expose users or infrastructure. Include affected
paths, reproduction steps, impact, and any suggested mitigation.

This project has no accounts, persistent user data, or application database.
Its pages load Google Analytics 4 under the guards in `lib/analytics.ts`
([ADR-0003](docs/adr/0003-google-analytics-4.md)); the measurement ID in that
file is public configuration, not a secret. Its primary security boundary is the integrity of published source,
dependencies, generated exports, and deployment configuration.
