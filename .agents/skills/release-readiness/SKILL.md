---
name: release-readiness
description: Produce a truthful, evidence-backed release readiness review before a version is tagged or published.
---

# Release Readiness

Use this skill before proposing any release. It creates evidence for a release
decision; it does not tag, push, publish, or grant production authorization.

## Preconditions

- Every included PR has a real linked issue and recorded verification result.
- All examples and eval fixtures use synthetic data only.
- The release notes distinguish shipped facts from roadmap work and from
  external evidence that is still missing.

## Required checks

Run these commands on the candidate commit and record the command, exit status,
and result:

```bash
npm test
npm run eval:structural
npm run privacy:regression
npm run schema:compat
npm run cli:mock
npm run scan
```

Then complete the following review:

- Read [`workflows/release-note.md`](../../../workflows/release-note.md) and
  generate release notes from the actual merged PR list.
- Verify that each claimed fix links to its issue, PR, test result, or eval
  result.
- Update [`docs/readiness-evidence.md`](../../../docs/readiness-evidence.md)
  with dated, attributable evidence. Leave unavailable evidence explicitly
  unverified rather than estimating it.
- Verify no release text calls the LINE demo production-ready. It remains a
  non-production roadmap/reference implementation until separately reviewed.
- Verify that no release claim treats AI output as approved without the required
  human approval gate.

## Decision report

```text
Candidate: <tag or commit>
Required commands: <command, exit status, result for each>
Issue and PR traceability: PASS | BLOCK
Privacy / synthetic-fixture review: PASS | BLOCK
External feedback attribution: <linked evidence | not claimed>
Readiness ledger updated: yes | no
Decision: READY TO PROPOSE | BLOCKED
Blockers: <none or specific evidence gap>
```

Only a maintainer with the needed repository and release authority may turn a
`READY TO PROPOSE` result into a published release.
