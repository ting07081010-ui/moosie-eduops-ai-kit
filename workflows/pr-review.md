# PR Review Workflow

Use this workflow when reviewing pull requests to this repo.

## Automated Checks (CI)

1. **No real PII** — scan for name patterns, phone numbers, email addresses
2. **No hardcoded secrets** — regex for `sk-`, API keys, tokens
3. **Tests pass** — `npm test`
4. **Schema valid** — JSON files parse correctly

## Manual Review Checklist

### For Prompt Changes
- [ ] Follows five-section format (Role / Task / Input / Output / Safety)
- [ ] Safety rules are explicit and testable
- [ ] No over-promising language ("guarantee", "definitely", "will improve")
- [ ] No cross-student references possible
- [ ] Eval cases added or updated

### For Schema Changes
- [ ] No new PII fields added
- [ ] `studentCode` pattern enforced
- [ ] `additionalProperties: false` maintained
- [ ] Backward compatible (or breaking change noted)

### For Eval Changes
- [ ] New cases cover edge cases
- [ ] Expectations are specific and checkable
- [ ] Rubric updated if dimensions changed

### For Demo Changes
- [ ] Fake data only
- [ ] Error handling present
- [ ] No logging of real data patterns

## Codex Review Prompt

When using Codex for PR review, use this prompt:

```
Review this PR for the Moosie EduOps AI Kit.

Check:
1. Does any code, test, or fixture contain real student PII?
2. Do prompt changes follow the five-section format?
3. Do prompts contain over-promising language?
4. Are schema changes backward-compatible?
5. Are eval cases added for new prompts or prompt changes?
6. Is there any hardcoded API key or secret?

Output a structured review with PASS/FAIL for each check.
```
