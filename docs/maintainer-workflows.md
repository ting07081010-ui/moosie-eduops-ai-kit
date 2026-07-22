# Maintainer Workflows

This page maps the repository's day-to-day maintenance procedures. It is a
policy and evidence guide, not proof that a workflow has run. Every claim about
issues, reviews, releases, testers, or adoption must be linked and dated in
[`readiness-evidence.md`](readiness-evidence.md) and the application-facing
[`application-evidence.md`](application-evidence.md).

## Source procedures

| Activity | Source procedure | Required outcome |
| --- | --- | --- |
| Issue intake and triage | [Issue Triage Workflow](../workflows/issue-triage.md) | labels, priority, source, reproduction/eval evidence, and triage decision |
| Pull request review | [PR Review Workflow](../workflows/pr-review.md) | linked issue, privacy and compatibility review, recorded verification results |
| Security review | [Security Review Workflow](../workflows/security-review.md) | secret/PII finding decision and an owner for remediation |
| Release preparation | [Release Notes Workflow](../workflows/release-note.md) | traceable notes, release-readiness review, and dated evidence ledger |

The local agent procedures in [`.agents/skills/`](../.agents/skills/) turn
these checks into repeatable gates. They never replace maintainer judgement,
human approval, or required release authority.

## Issue triage record

Use a real issue for every reported bug, eval failure, privacy concern, or
feature request. A report may come from an external tester, a maintainer, CI,
or a local eval; identify the source truthfully and do not call a maintainer
test an external report.

Record this information in the issue or a linked triage comment:

```text
Source: <external tester, CI run, local eval, maintainer reproduction>
Data handling: <synthetic only / redacted summary; never paste minor data>
Reproduction or eval case: <command, fixture, or minimal safe steps>
Labels and priority: <labels>
Triage decision: <fix, defer, duplicate, cannot reproduce>
Owner and next review date: <owner / date>
```

An external testing or eval-failure issue counts as readiness evidence only if
its source, triage record, and follow-up are verifiable. Do not manufacture
issues or feedback merely to satisfy an application checklist.

## Pull request lifecycle

1. Open or identify the real issue first.
2. Use the PR template and write `Closes #123` with the real issue number.
3. Select the changed surface and run its required gate:

   | Change surface | Required verification |
   | --- | --- |
   | Prompt | `npm run privacy:regression` and `npm run eval:structural` |
   | Schema | `npm run schema:compat` and `npm test` |
   | Example / fake data | `npm run cli:mock` and `npm run scan` |
   | Privacy-sensitive code or fixture | `npm run privacy:regression` and `npm run scan` |
   | Release preparation | the full `release-readiness` skill command set |

4. Record the exact commands, exit status, and meaningful results in the PR.
5. Review the diff using the [PR Review Workflow](../workflows/pr-review.md).
   Parent-facing AI output remains a draft until a human approval gate is
   completed.
6. Merge only after the linked issue, required gates, and review decision are
   complete.

## Release lifecycle

1. Start from merged, traceable PRs rather than an unlinked changelog entry.
2. Run the [`release-readiness` skill](../.agents/skills/release-readiness/SKILL.md).
3. Generate and review release notes using the
   [Release Notes Workflow](../workflows/release-note.md).
4. Add a dated row to the [readiness evidence ledger](readiness-evidence.md).
   Link each claimed feedback-driven fix to the real issue, PR, eval, or
   consented and anonymized feedback record.
5. A maintainer with release authority decides whether to tag and publish.

## Monthly maintenance evidence

At the end of each month, add only verifiable counts to the evidence ledger:

- PR reviews and merged PRs;
- eval and privacy-regression runs, including failures fixed or still open;
- triaged issues and average time to a triage decision;
- releases and their linked fixes;
- external contributors, beta testers, or external use cases; and
- Codex usage or credit totals, if a dated source is available.

If an item has no verifiable source, write `not recorded` rather than `0` or an
estimate. The absence of a count is an evidence gap, not a failure to be hidden.
