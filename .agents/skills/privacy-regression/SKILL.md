---
name: privacy-regression
description: Run and document the privacy regression checks for changes that can affect prompts, input handling, output handling, evals, or fixtures.
---

# Privacy Regression

Use this skill before merging any change that could alter what reaches an LLM,
what the toolkit generates, or what appears in examples, evals, logs, and
documentation.

## Scope

This is a repository safety gate, not legal advice and not a complete
de-identification solution. It checks the repository's defined cases; it does
not authorize sending real minor data to an AI provider.

## Procedure

1. Inspect the changed files for student, parent, teacher, school, credential,
   or account data. Replace any real-looking value with a synthetic fixture
   before running a command.
2. Confirm that only synthetic minor-data fixtures are present. Use opaque
   student codes such as `S-001`; do not use names, phone numbers, LINE IDs,
   email addresses, addresses, health details, payment data, or identifiable
   school records.
3. Run the deterministic privacy regression:

   ```bash
   npm run privacy:regression
   ```

4. Run the repository PII and secret scan:

   ```bash
   npm run scan
   ```

5. When prompts or eval fixtures changed, also run:

   ```bash
   npm run eval:structural
   ```

6. Record every command, exit status, and material output in the PR's
   **Verification evidence / results** section. Do not replace results with an
   unchecked checklist.

## Decision rule

- **PASS:** every required command exits successfully and manual inspection
  finds no real or likely personal data.
- **BLOCK:** a command fails, a potential PII finding is unexplained, a fixture
  is not demonstrably synthetic, or a change could allow AI content to bypass
  human approval.
- **ESCALATE:** a maintainer must decide any exception involving a real-world
  data flow. Do not paste the data into an issue or PR to request help.

## Required report

```text
Scope: <files and data path reviewed>
Synthetic-fixture review: PASS | BLOCK
npm run privacy:regression: <exit status and result>
npm run scan: <exit status and result>
npm run eval:structural: <not applicable | exit status and result>
Human approval impact: <none | describe required reviewer>
Decision: PASS | BLOCK | ESCALATE
```
