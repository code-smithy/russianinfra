# Security Policy

## Supported Versions

This project is maintained from the current mainline only. Security fixes should be made against the latest version of the repository unless a maintainer explicitly creates a release branch.

## Reporting Vulnerabilities

Please do not disclose suspected vulnerabilities publicly before they have been reviewed.

If this repository is hosted on GitHub, report security issues through GitHub private vulnerability reporting or a private security advisory when available. If no private reporting channel is configured, contact the repository owner directly with a minimal, non-public report.

Useful reports include:

- A short description of the issue and affected files.
- Steps to reproduce.
- The expected and actual behavior.
- Any proof of concept needed to confirm impact.
- Whether the issue affects local use only, generated data, or a deployed copy of the web app.

Please avoid including sensitive coordinates, private source material, credentials, or unrelated personal data in a report.

## In Scope

Security issues in scope include:

- Path traversal or unsafe file serving in `web/server.mjs`.
- Cross-site scripting or unsafe HTML rendering in the web viewer.
- Unsafe parsing of source data that could execute code or overwrite unintended files.
- Dependency, CDN, or supply-chain weaknesses that materially affect the app.
- Accidental inclusion of secrets, credentials, or private data in committed files.
- Problems that could corrupt generated outputs in a way that misleads users about source provenance or record identity.

## Out of Scope

The following are usually out of scope unless they demonstrate a concrete security impact:

- Disagreements about source accuracy, classification, or completeness.
- Requests to remove data that is already public in upstream sources, unless the repository has added private or unsafe context.
- Denial-of-service reports based only on very large local datasets.
- Vulnerabilities requiring full local filesystem access by a trusted user who already controls the working tree.

## Data Safety

This repository handles infrastructure and military-related geospatial data. Even when data originates from public, open, or archived sources, contributors should apply extra care.

Do not add:

- Classified or restricted information.
- Credentials, API keys, session tokens, or private service URLs.
- Non-public personal data.
- Real-time operational observations that are not already published by an appropriate public source.
- Instructions or annotations intended to enable harm.

Generated CSV, GeoJSON, and exported radius results may contain coordinates, company identifiers, source URLs, and derived classifications. Review these files before sharing them outside the project.

## Local App Security

The web app is a static local analysis tool. The included server is for local development and review, not hardened production hosting.

When running or deploying the app:

- Prefer binding the development server to `127.0.0.1`.
- Do not expose the local server directly to the public internet.
- Use a proper static host, TLS, access controls, and security headers for any shared deployment.
- Review CDN usage in `web/index.html` and pin or self-host browser dependencies if operating in a restricted environment.
- Treat the DeepState live overlay as an external network dependency.

The app stores user interface preferences and estimator assumptions in browser local storage. It does not intentionally collect user analytics or send local generated data to a backend service.

## Secrets

No secrets are required to run the current local pipeline or web app. If future work introduces credentials, store them outside the repository and document required environment variables without committing real values.
