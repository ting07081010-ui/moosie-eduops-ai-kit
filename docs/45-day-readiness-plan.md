# 45-Day Application Readiness Cycle

This is a forward-looking evidence cycle for Moosie EduOps AI Kit. It does not
rewrite history or treat a calendar milestone as proof. The application-facing
source of dated facts remains [Application Evidence Pack](application-evidence.md).

## Starting point

| Area | Current local baseline | Evidence boundary |
| --- | --- | --- |
| Runnable example | Mock CLI, deterministic evals, privacy regression, schema compatibility, PII scan, and test suite are present. | A local run proves only the named command and commit. |
| Governance | README, CONTRIBUTING, SECURITY, PRIVACY, AGENTS, workflows, and repo-local skills are present. | Documentation is not proof of human review or production operation. |
| Release history | Public tags v0.1.0, v0.2.0, and v0.2.1 exist. | Do not call a release feedback-driven without a linked source. |
| External proof | Beta testers, independent reviews, downstream use, and upstream work are not recorded. | A template or target never changes this value. |

## Phase 1 — Days 1–14: runnable and safety baseline

| Work | Owner | Required record | Stop condition |
| --- | --- | --- | --- |
| Run the mock-first path on an isolated checkout. | Maintainer | Commit, Node version, exact commands, exit status, duration, and concise output. | Stop release preparation if any required gate fails. |
| Review synthetic fixtures and privacy controls. | Maintainer or independent reviewer | Scan result plus redacted review note; no raw personal data. | Stop if a real identifier, secret, or irreproducible privacy failure appears. |
| Check documentation matches actual scripts. | Maintainer | Linked documentation change and command output. | Do not describe a live API, deployment, or external result that was not tested. |

Required commands for a candidate are:

~~~bash
npm ci
npm run cli:mock
npm test
npm run eval:structural
npm run privacy:regression
npm run schema:compat
npm run scan
~~~

Record an actual command result in the Evidence Pack or eval report only after
the command runs. A passing local run does not prove a GitHub Actions run.

## Phase 2 — Days 15–30: consented external testing and triage

| Work | Owner | Required record | Stop condition |
| --- | --- | --- | --- |
| Invite non-author testers to use only the synthetic CLI scenario. | Beta coordinator | Anonymized feedback record with date, consent, setup outcome, and source type. | Do not accept real student or parent data. |
| Capture friction, defects, and eval failures. | Maintainer | A real issue or redacted eval failure, source, triage decision, priority, and follow-up. | Do not open placeholder issues merely to satisfy a count. |
| Close the feedback loop. | Maintainer | Linked issue, PR, verification result, and later release if one occurs. | Do not claim a fix was feedback-driven until the chain exists. |

Use [Beta Test Guide](beta-test-guide.md) and
[Feedback Template](feedback-template.md). A submitted form is an intake
signal, not evidence of adoption by itself.

## Phase 3 — Days 31–45: reproducible maintenance and adoption proof

| Work | Owner | Required record | Stop condition |
| --- | --- | --- | --- |
| Publish a dated evaluation record. | Maintainer | Commit or release, environment, fixture scope, numerator and denominator, failure categories, and limits. | Do not report structural fixture validity as live-model quality. |
| Update application evidence after real events. | Maintainer | Public URL or consented anonymous record and statistics date. | Preserve historical entries; never overwrite failures. |
| Seek independently verifiable use or contribution. | Maintainer and external participant | Public PR, downstream reference, fork, or consented use-case record. | Do not turn stars, commits, or targets into adoption claims. |

## Weekly evidence rhythm

- Monday: choose only P0/P1 work tied to safety, a real defect, or user value.
- Wednesday: run deterministic checks and classify any failure as privacy, tone,
  schema, runtime, or documentation.
- Friday: update the Evidence Pack only with dated sources that now exist.
- Before a release: run all mandatory gates and seek a non-author review when
  available. During solo maintenance, preserve the checklist and full command
  record instead of claiming independent review.

## Conditional application gate

A submission is conditional on an evidence-backed score of at least 75/100,
with no unresolved P0 issue. The following still require real account actions
or external events and cannot be completed by this document:

- GitHub profile, repository topics, labels, milestones, branch protection, and
  remote CI links.
- Non-author clean installs, beta feedback, external reviews, contributions,
  downstream use, and upstream contributions.
- A release demonstrably linked to real feedback or a verified failure.

See [Application Readiness Evidence Ledger](readiness-evidence.md) for the
scoring worksheet and [Application Evidence Pack](application-evidence.md) for
the dated record.
