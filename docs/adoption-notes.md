# Adoption Notes

These notes are for small education providers adapting the toolkit with their
own systems.

## Start With Fake Data

Begin with `examples/fake-data/` and add only synthetic profiles or lesson
records. Do not paste real student names, parent messages, phone numbers, LINE
IDs, school names, grades, health information, or payment details into the repo.

## Keep Identity Outside the AI Workflow

Use opaque identifiers such as `S-001` inside prompts, schemas, evals, and logs.
Keep the mapping from `S-001` to a real student inside the school's existing
student system.

## Add Human Approval

AI output should be a draft. A teacher or school staff member should review
every parent-facing message before sending it.

## Keep the Open-Source Core Small

This repo is intentionally focused on reusable AI workflow patterns:

- Teacher note cleanup
- Parent summary drafting
- Parent message risk checks
- Admin task extraction
- Student progress diagnosis
- Prompt and privacy evals

Business functions such as tuition payment, scheduling, CRM, and grade
management should live in separate private systems or adapters.

## Run Checks Before Sharing Changes

```bash
npm test
npm run eval:structural
npm run scan
```

For prompt or schema changes, add or update eval cases before opening a pull
request.
