# Privacy Policy — Moosie EduOps AI Kit

## Data Principles

1. **No real student data in this repo.** All datasets in `examples/fake-data/` are synthetic and de-identified.
2. **PII is masked before AI processing.** Microsoft Presidio detects and masks PII before any message reaches an LLM.
3. **AI drafts only; humans decide.** No message is sent to parents without explicit teacher approval.
4. **Minimal data retention.** Class logs store only what's necessary for drafting responses.

## What PII We Handle

| Type | Example | Presidio Entity | Redaction |
|------|---------|-----------------|-----------|
| Taiwan mobile | 0912-345-678 | `TW_MOBILE` | `PHONE_REDACTED` |
| LINE ID | @moosie123 | `LINE_ID` | `LINE_REDACTED` |
| Chinese name | 王小明 | `ZH_NAME` | `PARENT_A` / `STUDENT_A` |

## What We Do NOT Handle

- National ID numbers (身分證字號)
- Home addresses
- Financial information
- Health records
- Grades or test scores (stored in school systems, not this repo)

## Data Flow

```
Teacher input (LINE/CLI)
  → AI generates lesson record (structured JSON)
  → AI generates parent message draft
  → Risk Check gate (privacy/overpromising/tone)
  → Teacher review and approval
  → Approved message sent to parent
  → Record stored for audit trail
```

At no point does unmasked PII reach an AI model.

---

## Four Privacy Layers for Deployment

### Layer 1: Parent Informed Consent

Before using AI-assisted communication, schools must inform parents:

> 「本校使用 AI 輔助老師整理課後紀錄與家長溝通草稿。所有訊息均經過老師人工審核後才發送。AI 僅處理去識別化資料，不會接觸學生真實姓名或聯絡資訊。」

Key points:
- AI assists the teacher, it does not replace the teacher
- All messages require human review before sending
- No real names or contact info are sent to AI models
- Parents can opt out at any time

### Layer 2: Data De-identification

- Student names are stored separately from student codes (`S-001`, `S-002`)
- The AI system only sees student codes, never real names
- Contact information (phone, LINE ID) is stored in the school's own system, not in this repo
- Class records use opaque identifiers: `S-001` + `M-ESL-G3-A`

### Layer 3: Message Review Gate

**Every parent message MUST pass through the risk check gate before sending.**

The gate checks:
- `privacyRisk`: Does it mention other students or leak PII?
- `overPromising`: Does it guarantee results?
- `tone`: Is it supportive, or blaming/cold?
- `mentionsOtherStudent`: Does it reference another child?
- `hasObservableBehavior`: Does it contain a specific classroom observation?
- `hasParentAction`: Does it include a doable next step?

If any check fails → message is **blocked**, not sent.

### Layer 4: Data Retention Policy

| Data Type | Retention | Purpose |
|-----------|-----------|---------|
| Lesson records | 12 months | Progress tracking, parent meetings |
| Parent messages | 12 months | Audit trail, dispute resolution |
| AI logs (Langfuse) | 3 months | Quality monitoring, cost tracking |
| Risk check reports | 12 months | Compliance evidence |

Schools should configure retention to match their policies and local regulations.

---

## Compliance Checklist for Schools

- [ ] Obtain consent from parents/guardians for AI-assisted communication
- [ ] Inform parents that messages are drafted with AI assistance
- [ ] Ensure teachers review every message before sending
- [ ] Configure data retention policies
- [ ] Regularly audit who has access to the system
- [ ] Keep audit logs of all sent messages
- [ ] Separate student names from student codes
- [ ] Never send real PII to external LLM APIs

## For Developers

- Never commit real API keys to the repo (PII scanner blocks this)
- Use `studentCode` (e.g., `S-001`) in all prompts and schemas
- Test with fake data only (`examples/fake-data/`)
- Run `npm run scan` before committing to check for PII leaks

## References

- [Taiwan PDPA](https://law.moj.gov.tw/LawClass/LawSingle.aspx?pcode=I0050021)
- [Microsoft Presidio Documentation](https://microsoft.github.io/presidio/)
- [COPPA (US)](https://www.ftc.gov/legal-library/browse/rules/childrens-online-privacy-protection-rule)
- [GDPR-K (EU)](https://gdpr-info.eu/art-8-gdpr/)
