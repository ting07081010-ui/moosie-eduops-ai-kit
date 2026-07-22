---
name: docs-sync
description: Keep public documentation, workflow instructions, and readiness claims aligned with implemented behavior and dated evidence.
---

# Docs Sync

Use this skill whenever a change affects an interface, privacy boundary,
workflow, example, evaluation, release claim, or readiness evidence.

## Procedure

1. Identify the changed behavior and its source of truth: implementation,
   schema, eval, test, workflow, or release record.
2. Review the affected public documents, especially:

   - [`README.md`](../../../README.md)
   - [`docs/architecture.md`](../../../docs/architecture.md)
   - [`docs/privacy-and-minors.md`](../../../docs/privacy-and-minors.md)
   - [`docs/maintainer-workflows.md`](../../../docs/maintainer-workflows.md)
   - [`docs/line-bot-workflow.md`](../../../docs/line-bot-workflow.md)
   - [`docs/codex-workflows.md`](../../../docs/codex-workflows.md)
   - [`docs/readiness-evidence.md`](../../../docs/readiness-evidence.md)

3. Update only claims supported by a linked source and, for time-sensitive
   claims, an explicit date. Never turn a plan, mock, configuration, or passing
   local command into a production, adoption, external-review, or legal-compliance
   claim.
4. Preserve these public boundaries:

   - examples use synthetic fixtures only;
   - parent-facing AI output requires human approval;
   - the LINE demo is a non-production reference / roadmap item;
   - external tester, contributor, issue, and feedback counts are reported only
     when independently verifiable.

5. For documentation that names a command, verify the command exists in
   `package.json`; for behavior claims, link to the relevant test, eval, schema,
   workflow, or implementation file.
6. Record the files checked, source links, and unresolved evidence gaps in the
   PR.

## Completion report

```text
Behavior or claim reviewed: <description>
Documents updated: <paths>
Source of truth: <paths or URLs>
Time-sensitive evidence date: <date or not applicable>
Unverified external evidence retained as: <not claimed | path>
Decision: synced | blocked pending evidence
```
