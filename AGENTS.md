# Moosie EduOps AI Kit — Maintainer Agent Contract

This repository is a reusable education-workflow kit, not a production student
information system. Work from synthetic fixtures only and keep real student,
parent, teacher, school, credential, and account data out of the repository.

## Non-negotiable safety rules

- All fixtures, examples, evals, screenshots, logs, and PR output must use
  synthetic minor-data fixtures. Opaque IDs such as `S-001` are allowed; real
  names, phone numbers, LINE IDs, email addresses, addresses, health details,
  payment data, and school-identifying records are not.
- Treat every AI-generated parent-facing message as a draft. AI content must
  not bypass the human approval gate: an authorized teacher or staff member
  must review and approve it before it is sent or relied on.
- Do not put secrets in the repository, issue bodies, PR descriptions, logs,
  screenshots, or fixtures. Use local environment variables for credentials.
- The LINE webhook example is a non-production reference and roadmap item. Do
  not describe it as production-ready, deploy it with real minor data, or use
  it as evidence of a deployed LINE service.

## Mandatory change gates

### Prompt changes

1. Review the diff against the five-section prompt contract: Role, Task,
   Input, Output, and Safety.
2. Add or update a relevant eval case when behavior changes.
3. Run `npm run privacy:regression` and `npm run eval:structural`.
4. Record the commands and results in the pull request. A failed privacy
   regression blocks merge until it is understood and fixed.

### Schema changes

1. State whether the change is backward compatible and why.
2. Run `npm run schema:compat` to verify backward compatibility against the
   versioned fixtures.
3. Run `npm test` and record the result. If a breaking change is intentional,
   document the migration impact and obtain maintainer approval before merge.

### Example or fake-data changes

1. Confirm the change contains synthetic data only.
2. Run `npm run cli:mock` with the fake-data example; this is the required
   offline smoke check and must not need an API key.
3. Run `npm run scan` and record the command output or result in the PR.

### Release changes

1. Run the `release-readiness` skill before proposing a release.
2. Run and record: `npm test`, `npm run eval:structural`,
   `npm run privacy:regression`, `npm run schema:compat`, `npm run cli:mock`,
   and `npm run scan`.
3. Link release notes to merged PRs and their real issues. Do not label a
   release as driven by external feedback unless the source issue or consented,
   anonymized feedback record is publicly verifiable.

### Documentation changes

Run the `docs-sync` skill when a change affects user behavior, data handling,
workflow requirements, or a public readiness claim. Keep claims limited to
evidence that is linked and dated in
[`docs/readiness-evidence.md`](docs/readiness-evidence.md) and the
application-facing [`docs/application-evidence.md`](docs/application-evidence.md).

## Pull request and issue policy

- Every pull request must link a real issue using `Closes #123`, explain the
  change, and include command-level verification evidence and results.
- Triage reports, eval failures, and feedback must identify their source
  truthfully. Do not create placeholder "external" issues, reviewers, testers,
  adoption numbers, or feedback.
- Use the procedures in [`workflows/`](workflows/) and the maintainer map in
  [`docs/maintainer-workflows.md`](docs/maintainer-workflows.md). The local
  skills in [`.agents/skills/`](.agents/skills/) make the required checks
  repeatable; they do not substitute for review or deployment authorization.

## Completion report

For every change, report the files changed, commands run with their outcomes,
known gaps, and the next required human decision. A passing local check is
evidence for that check only; it is not proof of external adoption, production
readiness, legal compliance, or a complete de-identification solution.
