---
name: prompt-change-review
description: Review a prompt change for output quality, privacy, evaluation coverage, and human approval requirements before merge.
---

# Prompt Change Review

Use this skill for every change under `prompts/` and for code or docs that
change a prompt's inputs, outputs, or safety interpretation.

## Review procedure

1. Read the diff and identify the affected education workflow, input schema,
   expected output, and parent-facing impact.
2. Check that the prompt retains an explicit **Role**, **Task**, **Input**,
   **Output**, and **Safety** section.
3. Reject unsupported educational, behavioral, medical, legal, or grade
   guarantees. Reject language that could refer to another student.
4. Add or update a focused eval fixture for the changed behavior. Expected
   outcomes must be concrete enough to review.
5. Invoke the `privacy-regression` skill, then run:

   ```bash
   npm run eval:structural
   ```

6. Confirm that the generated content remains a draft and cannot bypass the
   human approval gate for parent-facing use.
7. Put the review result and commands in the linked issue and PR.

## Review outcome

Use this format in a review comment or PR body:

```text
Prompt contract: PASS | BLOCK
Eval coverage: <fixture path and result>
Privacy regression: PASS | BLOCK
Human approval gate: preserved | impacted
Unsupported claims or cross-student risk: none | details
Decision: approve | request changes | escalate
```

A successful structural eval checks the repository's defined structure; it is
not evidence of real-world parent approval or adoption.
