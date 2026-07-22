# Codex-Assisted Maintainer Workflows

Codex can help maintain this repository by inspecting scoped changes, running
the documented checks, and preparing evidence. It is an assistant to the
maintainer process: it cannot turn an unverified claim into evidence, approve
parent-facing AI output, or authorize a deployment or release.

## Permitted maintenance uses

| Task | Codex-assisted action | Required source of truth |
| --- | --- | --- |
| PR review | Check prompts for unsupported claims, cross-student risk, schema impact, secrets, and synthetic fixtures | [PR Review Workflow](../workflows/pr-review.md) and PR verification record |
| Issue triage | Classify a report as bug, feature, docs, privacy, education, eval, security, or CI | [Issue Triage Workflow](../workflows/issue-triage.md) and the real issue source |
| Release preparation | Draft notes from merged PRs and identify the required validation set | [Release Notes Workflow](../workflows/release-note.md) and the release-readiness report |
| Security review | Look for hardcoded secrets, likely PII, prompt-injection risk, and dependency-review follow-up | [Security Review Workflow](../workflows/security-review.md) |
| Prompt regression | Run the privacy and structural eval gates for a scoped prompt change | [`privacy-regression` skill](../.agents/skills/privacy-regression/SKILL.md) and [`prompt-change-review` skill](../.agents/skills/prompt-change-review/SKILL.md) |
| Docs maintenance | Reconcile behavior claims with tests, workflows, and dated evidence | [`docs-sync` skill](../.agents/skills/docs-sync/SKILL.md) |

## Operating rules

1. Give Codex only the minimum necessary context. Never provide real student,
   parent, teacher, account, credential, or other personal data. All examples,
   tests, and evals must use synthetic fixtures.
2. For a prompt change, use `prompt-change-review`, which invokes
   `privacy-regression`; record `npm run privacy:regression` and
   `npm run eval:structural` results.
3. For a schema change, run `npm run schema:compat` and `npm test`. A Codex
   explanation is not a backward-compatibility result.
4. For an example change, run `npm run cli:mock` and `npm run scan`. The mock
   CLI is the safe local smoke path; it does not prove an LLM or LINE deployment.
5. For a release, use `release-readiness` and put the dated outcome in
   [`readiness-evidence.md`](readiness-evidence.md).
6. A human reviewer must approve parent-facing output before it is sent. Codex
   must not bypass this human approval gate or mark an AI draft as approved.

## Review output format

Use concise, checkable reports. A useful Codex report contains:

```text
Scope reviewed: <files and behavior>
Issue / PR traceability: <issue number and link, or blocker>
Checks run: <command, exit status, result>
Privacy and synthetic-data status: PASS | BLOCK
Schema compatibility status: PASS | BLOCK | not applicable
Human approval impact: preserved | impacted
Evidence gap: <none or exact missing external/local proof>
Recommendation: approve | request changes | escalate
```

## Metrics and evidence discipline

Codex may summarize a dated, auditable record of PR reviews, eval runs, failed
regressions, triaged issues, releases, external contributors, average repair
time, and Codex credits used. It must not invent, estimate, or backfill these
metrics. Only add a metric after its source and `as of` date are recorded in
the [readiness evidence ledger](readiness-evidence.md).

External testing, external contributions, and adoption must be verified from
their actual source. A local Codex run is useful maintenance evidence but is
not external adoption evidence.
