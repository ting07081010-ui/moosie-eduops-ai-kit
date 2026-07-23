# Evaluation Report Protocol

This document defines how to record reproducible evaluation evidence. It is a
protocol, not a claim that a live model has passed or that an external user has
validated the project.

## Scope labels

| Scope | Command or source | What it can prove |
| --- | --- | --- |
| Structural fixtures | npm run eval:structural | JSONL shape and expected-field structure. It does not measure live-model quality. |
| Privacy regression | npm run privacy:regression | The supported deterministic privacy preflight and contract cases. |
| Schema compatibility | npm run schema:compat | Compatibility with the recorded synthetic fixture. |
| Mock CLI smoke | npm run cli:mock | The fake-data, no-key local workflow. |
| Live evaluation | npm run eval | A manually invoked model run with recorded model, prompt version, cost, and human review. It is never assumed from structural results. |

## Required metadata for each dated result

- As-of date and time zone
- Commit SHA and release tag, or not recorded
- Environment: operating system, Node version, package-lock state, and whether
  the checkout was isolated
- Command or workflow URL
- Dataset or fixture scope, plus pass count, fail count, and pass rate where
  that calculation applies
- Failure category: privacy, hallucination, tone, schema, runtime,
  documentation, or other
- Human reviewer for a live-model baseline change, or not recorded
- Source path under evals/results, public URL, or not recorded
- Limitation statement explaining what the result does not prove

## Result file convention

Save a new record as:

~~~text
evals/results/YYYY-MM-DD-<short-sha>-<scope>.md
~~~

Do not overwrite a prior result. A correction or rerun receives a new dated
file and links back to the original result. Preserve failures and their follow
up; a pass-rate history without failed runs is incomplete maintenance evidence.

## Candidate record template

~~~text
As of: YYYY-MM-DD
Commit: <full SHA>
Release: <tag or not recorded>
Environment: <OS, Node version, isolated checkout or CI runner>
Scope: <structural | privacy | schema | mock-cli | live>
Command or CI URL: <exact command or public URL>
Fixture / dataset scope: <counts and names>
Passed: <number>
Failed: <number>
Pass rate: <calculation or not applicable>
Failure categories: <none or categories>
Model and prompt version: <required for live; not applicable otherwise>
Human review: <required for baseline change; not recorded otherwise>
Artifact: <path or URL>
Limit: <what this result does not prove>
Follow-up: <issue, PR, release, or not recorded>
~~~

## Baseline and regression rules

- Add or update a deterministic regression case when prompt behavior, risk
  logic, or supported identifier detection changes.
- Do not automatically replace a live-eval baseline. A maintainer must review
  the model, prompt, dataset, date, and observed difference.
- Do not turn a structural 100% fixture-validity result into a claim about
  parent-message quality, privacy safety outside the tested cases, or
  production safety.
- A privacy failure blocks a release candidate until it has a linked fix and a
  passing rerun.
- Keep only synthetic data and redacted error descriptions in result records.

## Current record status

No new result is created by this protocol. Dated historical and local command
summaries remain in [Application Evidence Pack](application-evidence.md) until
a corresponding result artifact is recorded under evals/results.
