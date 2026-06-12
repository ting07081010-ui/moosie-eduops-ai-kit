# Security Policy

## Reporting a Vulnerability

Email security@moosie-edu.com with details.
Do not open a public issue for security reports.
We aim to respond within 5 business days.

## Scope

This toolkit handles education workflows that may involve minors in real-world deployments.
We treat the following as security or safety issues:

- Any path that could log, store, or transmit real student PII
- Hardcoded API keys or secrets
- Prompts that could leak one student's data into another student's message
- Schema bypasses that allow unvalidated data through
- Unsafe generated claims about learning ability, health, psychology, or diagnosis

## Secrets

- All secrets go in `.env`
- `.env` must stay gitignored
- Never commit API keys
- Run `npm run scan` before opening a PR

## Supported Versions

| Version | Supported |
|---|---|
| 0.2.x | ✅ |
| 0.1.x | Limited |
| < 0.1 | ❌ |

## Security Review Workflow

See [workflows/security-review.md](workflows/security-review.md).