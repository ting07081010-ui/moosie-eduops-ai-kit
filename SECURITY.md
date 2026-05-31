# Security Policy

## Reporting a Vulnerability

Email security@moosie-edu.com with details. **Do not open a public issue for security reports.** We aim to respond within 5 business days.

## Scope

This toolkit handles data about minors. We treat the following as security issues:

- Any path that could log, store, or transmit real student PII
- Hardcoded API keys or secrets
- Prompts that could leak one student's data into another's message
- Schema bypasses that allow unvalidated data through

## Secrets

- All secrets go in `.env` (gitignored). Never commit keys.
- CI scans for hardcoded keys on every PR.
- If you find a leaked key, report it immediately — we will rotate it.

## Supported Versions

| Version | Supported |
|---|---|
| 0.1.x | ✅ |
| < 0.1 | ❌ |

## Security Review Workflow

See [workflows/security-review.md](workflows/security-review.md) for our Codex-powered security review process.
