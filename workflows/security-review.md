# Security Review Workflow

Use this workflow to audit the repo for security issues.

## What We Scan For

### 1. Hardcoded Secrets
- API keys (`sk-`, `Bearer `, `api_key=`)
- Tokens and passwords in code or config
- `.env` files committed to git

### 2. PII Leakage
- Real names in code, tests, or fixtures
- Phone numbers, email addresses
- Student IDs that aren't in `S-XXX` format

### 3. Prompt Injection Risks
- Prompts that could leak data between students
- Prompts that accept unvalidated user input without sanitization
- System prompts exposed to end users

### 4. Dependency Vulnerabilities
- `npm audit` results
- Outdated packages with known CVEs

## Automated Scan (CI)

```yaml
# Runs on every PR
- name: Scan for hardcoded secrets
  run: |
    ! grep -rEn 'sk-[A-Za-z0-9]{20,}' --include=*.{mjs,js,ts,json,md} . \
      || (echo '❌ Hardcoded key found' && exit 1)

- name: Check for PII patterns
  run: |
    ! grep -rEn '(09[0-9]{8}|[a-z]+@[a-z]+\.[a-z]+)' --include=*.{mjs,js,ts,json} . \
      || (echo '⚠️ Possible PII found — review manually' && exit 1)
```

## Manual Review Checklist

- [ ] No real student names in `examples/fake-data/`
- [ ] All `studentCode` values match `^S-[0-9]{3}$`
- [ ] No phone numbers or emails in any file
- [ ] `.env` is in `.gitignore`
- [ ] No API keys in commit history
- [ ] Prompts include safety rules
- [ ] Schemas have `additionalProperties: false`

## Codex Security Prompt

```
Run a security audit on this repo.

Check:
1. Any hardcoded API keys or secrets?
2. Any real PII (names, phones, emails)?
3. Any .env files committed?
4. Any prompts that could leak data between students?
5. Any schema fields that could accept PII?

For each finding, report: file, line, severity (critical/high/medium/low), recommendation.
```

## Response Plan

| Severity | Action |
|---|---|
| Critical | Rotate key immediately, force-push clean history, notify affected users |
| High | Fix within 24 hours, patch release |
| Medium | Fix in next release |
| Low | Track in issue backlog |
