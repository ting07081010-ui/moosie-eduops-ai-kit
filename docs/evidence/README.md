# Evidence Records Directory

This directory is intentionally empty until a real, dated, and appropriately
consented evidence record exists. Templates, goals, test plans, and mock
outputs must not be saved here as if they were external proof.

The canonical application index is
[docs/application-evidence.md](../application-evidence.md). Use this directory
only for supporting records that the index links to.

## Allowed record types

- Clean-install record from a named source type, with any public identity
  removed unless consent explicitly covers it.
- Beta feedback summary where public-summary consent is yes.
- Downstream-use record with a public URL or consented anonymous source.
- Redacted evaluation artifact containing no real personal data.

## Required fields

Every record must include:

- As-of date
- Source type
- Consent status
- Related commit, issue, PR, release, or public URL, or not recorded
- What was observed
- Maintainer follow-up status
- A statement that synthetic fixtures were used, when relevant

## Never store

- Student, parent, teacher, or school names
- Contact details, LINE IDs, usernames, account IDs, addresses, grades, health,
  attendance, or payment data
- Raw prompts or screenshots that could identify a minor
- API keys, tokens, cookies, .env files, or terminal history
- A template filled with invented tester, reviewer, or adoption information

Use a neutral filename such as YYYY-MM-DD-source-type-summary.md. Preserve
prior records; append corrections with a new dated entry instead of overwriting
history.
