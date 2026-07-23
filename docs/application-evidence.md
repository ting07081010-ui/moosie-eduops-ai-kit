# Application Evidence Pack

This is the application-facing evidence index for `moosie-eduops-ai-kit`.
It complements the repository-level [readiness evidence ledger](readiness-evidence.md):
the ledger defines the rules, while this pack records dated, attributable
evidence for an application.

**As of:** 2026-07-22

**Repository:** [ting07081010-ui/moosie-eduops-ai-kit](https://github.com/ting07081010-ui/moosie-eduops-ai-kit)

**Implementation evidence base:** `13aec97` on `chore/readiness-gate` (not pushed or released)

## Evidence rules

- Link every factual claim to a public URL, a local commit and command result,
  or a consented anonymized record.
- Use **not recorded** when a source does not exist. Do not substitute a
  template, mock, intent, or self-reported estimate for evidence.
- Keep real student, parent, teacher, school, account, and credential data out
  of this file. Feedback entries must be anonymous and consented.
- Refresh the `As of` date whenever a count, permission, release, or status
  changes.

## Evidence collection protocol

- [45-Day Application Readiness Cycle](45-day-readiness-plan.md) separates
  future work from historical evidence.
- [Beta Test Guide](beta-test-guide.md) and
  [Feedback Template](feedback-template.md) define the synthetic-only intake
  path; a submitted template is not adoption evidence by itself.
- [Evaluation Report Protocol](eval-report.md) and
  [versioned result records](../evals/results/README.md) define how to retain
  reproducible command evidence after it actually runs.
- [Threat Model](threat-model.md) documents implemented controls and residual
  risk. It is not a production deployment approval.

## Maintainer role and repository control

| Item | Evidence | Status and limit |
| --- | --- | --- |
| Public repository | [Repository metadata](https://github.com/ting07081010-ui/moosie-eduops-ai-kit) | Verified public on 2026-07-22. |
| Repository owner handle | `ting07081010-ui` in the public repository URL | Public ownership is visible; it does not prove the applicant's real-world identity. |
| Maintainer control | Connected GitHub App reported `admin` permission on 2026-07-22. | Verified for the connected account only; record the applicant profile URL and application role before submitting. |
| Applicant role statement | **not recorded** | Add a dated statement naming the applicant's maintainer role and responsibility for releases, issue triage, and privacy review. |

## Release timeline and important changes

| Date | Release or change | Source | Important-change evidence | Status |
| --- | --- | --- | --- | --- |
| 2026-05-31 | [v0.1.0](https://github.com/ting07081010-ui/moosie-eduops-ai-kit/releases/tag/v0.1.0) | Published GitHub release | **not recorded** in this pack; add linked PRs or release notes before describing the change. | Published timeline only. |
| 2026-06-12 | [v0.2.0](https://github.com/ting07081010-ui/moosie-eduops-ai-kit/releases/tag/v0.2.0) | Published GitHub release | **not recorded** in this pack; do not call it feedback-driven without a linked source. | Published timeline only. |
| 2026-06-13 | [v0.2.1](https://github.com/ting07081010-ui/moosie-eduops-ai-kit/releases/tag/v0.2.1) | Published GitHub release | **not recorded** in this pack; do not call it feedback-driven without a linked source. | Published timeline only. |
| 2026-07-22 | `13aec97` readiness-gate candidate | Local git commit | Adds deterministic privacy, mock CLI, schema compatibility, PR traceability, and evidence workflows. | Local only; not a public release. |

## Merged pull requests, reviews, and issue triage

| Record | Linked source | Evidence observed on 2026-07-22 | Application interpretation |
| --- | --- | --- | --- |
| Eval issue | [Issue #3](https://github.com/ting07081010-ui/moosie-eduops-ai-kit/issues/3) | Closed `eval` issue; author is repository owner; zero comments. | A historical eval-work item, **not** a verified external failure or a triage-record example. |
| Merged PR traceability | [PR #14](https://github.com/ting07081010-ui/moosie-eduops-ai-kit/pull/14) | The merged PR body links `Closes #3` and records structural-eval checks. | A traceability example only; do not represent it as independently reviewed. |
| Review evidence | [PR #14 reviews](https://github.com/ting07081010-ui/moosie-eduops-ai-kit/pull/14) | Connected GitHub App returned no submitted reviews on 2026-07-22. | **not recorded** as independent review evidence. |
| External contribution | **not recorded** | No verified external contributor PR is recorded in this pack. | Do not claim an external contribution until a linked PR and contributor source exist. |

## Beta testers, adopters, and anonymized feedback

| Measure | Verified value | Data source | Status |
| --- | --- | --- | --- |
| Non-author beta testers | **not recorded** | No consented anonymized tester record linked. | Do not report `0`, an estimate, or a target as a result. |
| External use cases | **not recorded** | No independently verifiable use-case record linked. | Required before claiming adoption. |
| Anonymized feedback | **not recorded** | No consented feedback record linked. | Store only anonymized summary, date, source type, consent status, and follow-up link. |

Use this minimal record for each future feedback item:

```text
As of: YYYY-MM-DD
Source type: beta tester | adopter | external evaluator
Consent to summarize publicly: yes | no
Anonymized finding: <no direct identifiers>
Related issue / PR / release: <URL or not recorded>
Follow-up status: triaged | fixed | deferred | not reproducible
```

## Eval coverage, pass rate, and regression history

Use the [Evaluation Report Protocol](eval-report.md) for new dated artifacts.
The following rows are an index of existing local evidence, not a substitute
for a versioned result file or live-model evaluation.

| As of | Scope | Result | Source and interpretation |
| --- | --- | --- | --- |
| 2026-07-22 | Structural eval fixtures | 34/34 valid (100%): 10 parent-message, 12 privacy-risk, 3 progress-diagnosis, 6 quality, 3 irregular-verb cases. | `npm run eval:structural` on local commit `13aec97`; validates fixture structure, not live-model output quality. |
| 2026-07-22 | Repository tests | 32/32 passed. | `npm test` on local commit `13aec97`. |
| 2026-07-22 | Deterministic privacy regression | 4/4 passed. | `npm run privacy:regression` on local commit `13aec97`; covers the supported phone, email, Taiwan-ID, core-LLM fail-closed, and direct-call-site gates. |
| 2026-07-22 | Schema compatibility | 1/1 passed. | `npm run schema:compat` on local commit `13aec97`, using the v0.2.1 synthetic fixture. |
| Historical regression failures | **not recorded** | No dated failure-and-fix series has been imported into this pack. | Do not calculate a regression rate until failures and reruns have dated sources. |
| Live-model evaluation | **not recorded** | The live eval remains optional and was not run for this evidence entry. | Do not extrapolate structural results into model-quality pass rate. |

## Clean-install evidence

For future non-author results, use the synthetic-only
[Beta Test Guide](beta-test-guide.md) and retain only consented, anonymized
supporting records under [docs/evidence](evidence/README.md).

| As of | Environment | Command | Result | Duration and limit |
| --- | --- | --- | --- | --- |
| 2026-07-22 | Isolated macOS worktree, Node.js 22.23.1 | `npm ci --no-audit` | Exit 0; npm reported 91 packages added. | 447 ms reported by npm; cache and machine conditions affect the time, so rerun on a clean CI runner before claiming a cross-environment duration. |
| 2026-07-22 | Same isolated worktree, no `OPENAI_API_KEY` | `npm run cli:mock` | Exit 0; deterministic fake-data pipeline completed without network access. | This demonstrates the documented local path, not a deployment or live-model test. |

## External contributions, forks, and downstream use

| Evidence type | Status | Required source before claiming it |
| --- | --- | --- |
| External contributor | **not recorded** | Contributor PR URL, contributor attribution, review/merge date, and scope. |
| Fork or downstream project | **not recorded** | Public fork or downstream URL plus a dated statement of relevant use. |
| Downstream education use case | **not recorded** | Consented anonymized use-case record or a public project reference. |

## Upstream contribution status

| Upstream target | Contribution status | Source |
| --- | --- | --- |
| Relevant OSS project or standards body | **not recorded** | Add issue or PR URL only after an upstream contribution is opened. |

## Codex maintenance workflow and CI

| Surface | Source | Current evidence limit |
| --- | --- | --- |
| Maintainer rules | [`AGENTS.md`](../AGENTS.md) | Local policy; not evidence that a human review occurred. |
| Codex workflow | [`codex-workflows.md`](codex-workflows.md) | Documents how Codex assists; it does not establish external adoption. |
| CI policy | [local CI workflow](../.github/workflows/ci.yml) and [GitHub Actions](https://github.com/ting07081010-ui/moosie-eduops-ai-kit/actions) | Local candidate has not been pushed, so no remote CI run exists for `13aec97`. |
| Required gates | [`privacy-regression` skill](../.agents/skills/privacy-regression/SKILL.md) and [`release-readiness` skill](../.agents/skills/release-readiness/SKILL.md) | Record a command result and CI run URL for each application/release candidate. |

## Statistics date and data sources

| Data category | As of | Source | Refresh rule |
| --- | --- | --- | --- |
| Repository visibility and permissions | 2026-07-22 | GitHub repository metadata and connected GitHub App read-only query | Recheck before submission and after permission changes. |
| Releases | 2026-07-22 | Public GitHub release URLs above | Add a row for each release only after publication. |
| Issue, PR, and review facts | 2026-07-22 | GitHub issue/PR/review URLs above and connected read-only query | Recheck after every merged PR or review. |
| Local commands and timings | 2026-07-22 | Terminal output on local commit `13aec97` | Re-run for the exact candidate commit; preserve failures as well as passes. |
| Beta, adoption, external contribution, downstream, upstream | 2026-07-22 | **not recorded** | Add only independently verifiable, consented, and dated sources. |

## Monthly update entry

Add an entry after each material event or monthly review. Do not overwrite prior
evidence; append a new dated row or section instead.

```text
As of: YYYY-MM-DD
Repository / commit / release: <URL or SHA>
Maintainer control source: <profile or repository URL>
Merged PRs and reviews: <URLs or not recorded>
Issue triage: <URLs, source type, decision, or not recorded>
Beta/adopter feedback: <consented anonymized record or not recorded>
Eval cases and pass rate: <command, numerator/denominator, scope>
Regression history: <failure and follow-up URLs or not recorded>
Clean-install command and duration: <exact command and elapsed time>
External/downstream/upstream activity: <URLs or not recorded>
CI source: <run URL or not recorded>
Owner of next update: <maintainer>
```
