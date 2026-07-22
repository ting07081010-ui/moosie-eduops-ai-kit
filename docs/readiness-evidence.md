# Application Readiness Evidence Ledger

**Ledger status date:** 2026-07-22

**Repository:** `moosie-eduops-ai-kit`

**Evidence standard:** link every claim to a dated, reproducible source. Do not
use this file to convert an intention, template, mock, local configuration, or
unverified statement into a readiness claim.

For the application-facing, continuously updated evidence index, use
[`application-evidence.md`](application-evidence.md). Keep this ledger as the
policy and scoring reference; do not duplicate event records across both files.

## How to use this ledger

- **Verified local evidence** is a source-tree fact or a command result recorded
  with its commit, date, command, exit status, and meaningful output.
- **External evidence** requires an independently reachable source such as a
  public GitHub URL, a consented and anonymized feedback record, or a dated
  tester/use-case record. A maintainer-created placeholder is not external
  evidence.
- Keep the categories separate. A passing local check can prove only the check
  that ran; it cannot prove public visibility, adoption, review, or production
  readiness.
- Update `as of` dates whenever a numeric count, score, or timeline changes.

## Verified local evidence snapshot

The rows below were checked from the source tree on 2026-07-22. They are not
claims about a deployed service, GitHub state, or external adoption.

| Readiness area | Local evidence | Scope limit |
| --- | --- | --- |
| Project explanation | [`README.md`](../README.md) is the local source for problem statement, users, architecture, and quick-start instructions. | Presence and documentation content do not prove clean-install success. |
| License | [`LICENSE`](../LICENSE) is present and identifies the repository license. | Local file inspection does not prove a published repository's visibility. |
| Privacy and maintainer policy | [`PRIVACY.md`](../PRIVACY.md), [`SECURITY.md`](../SECURITY.md), [`CONTRIBUTING.md`](../CONTRIBUTING.md), [`AGENTS.md`](../AGENTS.md), and the docs/skills referenced below provide the current policy surface. | Policy text alone does not prove runtime enforcement or legal compliance. |
| Architecture and workflow documentation | [`architecture.md`](architecture.md), [`privacy-and-minors.md`](privacy-and-minors.md), [`maintainer-workflows.md`](maintainer-workflows.md), [`line-bot-workflow.md`](line-bot-workflow.md), and [`codex-workflows.md`](codex-workflows.md) are present. | Documentation must be reconciled with tests and implementation on each relevant change. |
| Synthetic-data convention | [`examples/fake-data/`](../examples/fake-data/) is the designated fake-data location; the maintainer policy requires synthetic fixtures only. | Requires `npm run scan` and human review for each changed fixture. |
| Offline smoke command | `npm run cli:mock` is the documented fake-data smoke command. | Record an actual command result before claiming clean-install or ten-minute success. |
| Deterministic gates | `npm run privacy:regression` and `npm run schema:compat` are the documented privacy and compatibility gates. | Record actual result, CI run, and commit before claiming a gate passed. |

## Verified external evidence snapshot

The facts below were checked against public GitHub pages on 2026-07-22. They
are intentionally narrow: neither repository visibility nor a release record
proves an applicant's identity, external adoption, external review, or that a
release was driven by external feedback.

| Readiness area | Verified external evidence | Scope limit |
| --- | --- | --- |
| Repository visibility | [GitHub repository](https://github.com/ting07081010-ui/moosie-eduops-ai-kit) was publicly reachable on 2026-07-22. | Public visibility does not by itself verify the applicant's identity or current access control. |
| Release history | [v0.1.0](https://github.com/ting07081010-ui/moosie-eduops-ai-kit/releases/tag/v0.1.0) (2026-05-31), [v0.2.0](https://github.com/ting07081010-ui/moosie-eduops-ai-kit/releases/tag/v0.2.0) (2026-06-12), and [v0.2.1](https://github.com/ting07081010-ui/moosie-eduops-ai-kit/releases/tag/v0.2.1) (2026-06-13) are published release records. | This establishes a version timeline only. It does not establish that a release fixed external feedback. |

## External evidence still required

None of the following are asserted as complete by this ledger. Add a dated URL
or consented, anonymized record only after it exists.

| Readiness requirement | Evidence still needed | Minimum record |
| --- | --- | --- |
| Maintainer identity for an application | A verifiable connection between the applicant, GitHub profile, and repository control | profile/repository URL, checked date, and accountable maintainer |
| External issue / eval-failure evidence | At least two real issues originating from external testing or a documented eval failure, each with triage | issue URL, source type, redacted reproduction/eval, labels, priority, triage date, follow-up PR/release |
| PR review and traceability | PRs that link a real issue and record command results; external contribution only when it actually occurs | PR URL, `Closes #…`, reviewer/source, command results, merge date |
| Feedback-driven release | A release whose fix is traceable to actual feedback or a verified failure | release URL, issue/PR URL, release date, source attribution |
| Adoption | Three to five non-author beta testers **or** at least two verifiable external use cases | consented anonymized tester/use-case record, date, scope, evidence link |
| Public eval / install evidence | Reproducible eval report and clean-install/mock-CLI result | commit, command, exit status, duration, artifact or URL |
| Monthly maintenance metrics | Dated count of reviews, eval runs, failed regressions, triaged issues, releases, contributors, repair time, and Codex credits | source URL or log reference, `as of` date, calculation method |

## Release and maintenance timeline template

Add one row for an event only after it happened. Do not prefill future releases,
external feedback, or reviewer names.

| Date (YYYY-MM-DD) | Event | Linked issue / PR / release | Verification or source | Result / follow-up |
| --- | --- | --- | --- | --- |
| _enter date_ | _triage, PR review, eval run, release, or feedback follow-up_ | _URL or `#number`_ | _command + exit status, public URL, or anonymized evidence ID_ | _actual outcome_ |

## Command evidence template

Use this for a candidate commit, a PR, or a release. Preserve failures and
their remediation links; they are useful maintenance evidence.

```text
As of: YYYY-MM-DD
Commit: <full SHA>
Environment: <OS, Node version, clean-install or existing checkout>

Command: npm test
Exit status: <0 | non-zero>
Result: <concise factual output>

Command: npm run eval:structural
Exit status: <0 | non-zero>
Result: <concise factual output>

Command: npm run privacy:regression
Exit status: <0 | non-zero>
Result: <concise factual output>

Command: npm run schema:compat
Exit status: <0 | non-zero>
Result: <concise factual output>

Command: npm run cli:mock
Exit status: <0 | non-zero>
Duration: <minutes and seconds>
Result: <concise factual output; no personal data>

Command: npm run scan
Exit status: <0 | non-zero>
Result: <concise factual output>
```

## Readiness-score worksheet

Do not calculate a score until every non-zero value has a linked, dated source.
Leave a category unscored when evidence is missing rather than awarding partial
credit by assumption.

| Dimension | Weight | Verified score | Evidence link and `as of` date |
| --- | ---: | ---: | --- |
| Maintainer identity and repository control | 20 | _unscored_ | _required_ |
| Executability: clean install, tests, CI, mock mode | 20 | _unscored_ | _required_ |
| Maintenance: releases, issue triage, PR review | 20 | _unscored_ | _required_ |
| External use or adoption | 20 | _unscored_ | _required_ |
| Ecosystem importance: zh-TW PII and education safety differentiation | 15 | _unscored_ | _required_ |
| Data consistency and dated claims | 5 | _unscored_ | _required_ |
| **Total** | **100** | **_unscored_** | Do not claim the 75/100 submission threshold without evidence. |

## Evidence boundary

The LINE demo remains a non-production roadmap/reference implementation. A
passing mock CLI, static eval, documentation review, or Codex report does not
prove a live LINE deployment, external adoption, or that parent-facing AI
content has passed human approval.
