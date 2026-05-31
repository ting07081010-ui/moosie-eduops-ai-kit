# Privacy and Minors — Detailed Guidance

## Why This Matters

This toolkit is designed for tutoring schools that teach minors (children under 18). Handling data about children requires extra care. This document provides practical guidance for adopters.

## What We Guarantee in This Repo

1. **No real data ever.** Every example uses fake identifiers like "S-001" or "Student A".
2. **No cross-student leaks.** Our privacy-risk eval specifically tests that a message about Student A never mentions Student B.
3. **No over-promising.** Our evals flag messages that guarantee grades or results.
4. **Data minimization.** Schemas only ask for what's needed. No addresses, no phone numbers, no payment info.

## For Schools Deploying This

If you use this toolkit with real students, you are the **data controller**. You must:

### Before You Start
- [ ] Consult a lawyer familiar with your local minor-data laws
- [ ] Obtain parental consent for AI-generated communications
- [ ] Review your LLM provider's data retention policy
- [ ] Set up a data deletion process

### Ongoing
- [ ] Never log prompts containing real student names to external services
- [ ] Rotate API keys regularly
- [ ] Audit generated messages before sending
- [ ] Keep a consent register

## Regional Regulations

| Region | Key Law | Key Requirement |
|---|---|---|
| USA | COPPA | Parental consent for under-13 data |
| EU | GDPR-K | Data minimization, right to erasure |
| Taiwan | PIPA (個資法) | Purpose limitation, consent |
| Japan | APPI | Opt-in for minors under 16 |

**This is not legal advice.** Consult a local lawyer.

## Technical Safeguards

### What Prompts See
Prompts receive only:
- Opaque student code (S-XXX)
- Lesson topic and performance observations
- Homework status

Prompts do NOT receive:
- Real names
- Contact information
- Addresses
- Payment data
- Photos

### What Schemas Enforce
- `studentCode` pattern: `^S-[0-9]{3}$` — blocks real names
- `body` maxLength: 400 — prevents essay-length data dumps
- No fields for phone, email, or address

### What Evals Check
- Cross-student name leaks
- Over-promising language
- Tone (cold, blaming)
- Identifying information in output

## Deleting Data

Because schemas use opaque codes, deletion is straightforward:
1. Delete the record associated with `S-XXX`
2. No name-based search needed
3. No orphaned references

## Questions?

Open an issue or email privacy@moosie-edu.com.
