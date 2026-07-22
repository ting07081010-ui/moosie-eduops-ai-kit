## Summary

What does this PR change?

## Linked issue (required)

Closes #123

Replace `#123` with the real issue number before requesting review. If there is
no real issue, open and triage one first; do not use a placeholder merely to
pass this checklist.

## Type of change

- [ ] Prompt
- [ ] Schema
- [ ] Fake data
- [ ] Eval
- [ ] CLI
- [ ] LINE demo
- [ ] Docs
- [ ] Privacy / security
- [ ] Maintainer workflow

## Why this matters

Explain the education workflow or maintainer problem this improves.

## Verification evidence / results (required)

Record the exact command or review performed, its exit status, and a concise
factual result. A checked box without results is not verification evidence.

| Command or review | Exit status / result | Evidence or relevant output |
| --- | --- | --- |
| `npm test` |  |  |
| `npm run eval:structural` |  |  |
| `npm run privacy:regression` |  |  |
| `npm run schema:compat` (schema changes) |  |  |
| `npm run cli:mock` (example/fake-data changes) |  |  |
| `npm run scan` (privacy-sensitive changes) |  |  |
| Docs-only review: linked source of truth |  |  |

If a required command does not apply, write `not applicable` and explain why.

## Privacy checklist

- [ ] No real student data
- [ ] No real parent messages
- [ ] No full names
- [ ] No phone numbers
- [ ] No addresses
- [ ] No school-identifiable records
- [ ] No diagnosis or medical claims
- [ ] No cross-student leakage
- [ ] Parent-facing AI output remains a draft and does not bypass human approval
- [ ] LINE demo is not represented as production-ready or as an adoption claim

## Screenshots / output samples

Paste fake-data output only.
