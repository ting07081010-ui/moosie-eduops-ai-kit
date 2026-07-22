# Privacy and Minors Policy — Moosie EduOps AI Kit

This repository is a reusable reference kit, not a hosted student-information
system. It is designed around synthetic fixtures and opaque student codes such
as `S-001`.

## Controls Implemented in This Repository

1. **Synthetic data only.** The tracked examples, eval fixtures, and tests use
   de-identified fake data. Real student, parent, school, medical, financial,
   and contact data do not belong in this repository.
2. **LLM input preflight.** Before a network-bound LLM call, the runtime blocks
   obvious Taiwan mobile numbers, email addresses, and Taiwan national IDs.
   The error reports only identifier types, not matched values.
3. **Draft and risk report.** The CLI produces drafts and a risk report for
   privacy, over-promising, peer comparison, and blaming tone. Its final
   `approve` / `review` / `block` verdict is computed locally from the report.
4. **Regression checks.** `npm run privacy:regression`, `npm run scan`, and the
   structural eval suite run in CI. They cover the deterministic preflight,
   synthetic fixtures, and known privacy-risk cases.

## Important Limits

The local input preflight is **not a complete de-identification solution**. It
does not recognise every personal name, address, LINE identifier, medical
detail, school identifier, or context that could identify a minor. It also does
not replace a legal, privacy, or security review.

This repository does not implement Microsoft Presidio, a general-purpose PII
redaction service, a student database, retention storage, consent collection,
or an automatic outbound parent-messaging system. Do not describe any of those
as implemented by this project.

The LINE material is a development scaffold. A production integration must add
its own identity boundary, consent process, audit trail, retention policy,
access controls, and a human approval gate before delivery to a parent.

## Data Flow and Human Approval Boundary

```
Synthetic or pre-de-identified input
  → local potential PII preflight
  → configured LLM produces a draft
  → local quality and risk checks
  → human review and approval in the deploying system
  → delivery through a separately implemented channel
```

The CLI never sends a parent message. The library cannot prove that an external
adapter obtained human approval, so the deploying school or adapter owns that
control and must fail closed when approval is absent.

## Deployment Checklist

- [ ] Keep the mapping from opaque student codes to real identities outside the
  prompt, eval, and log boundary.
- [ ] Remove or replace direct identifiers before a request reaches an LLM.
- [ ] Obtain the consent and notices required for the deployment jurisdiction.
- [ ] Require a named human approver before a parent-facing message is sent.
- [ ] Define retention, deletion, and access-control policies in the deploying
  system.
- [ ] Run `npm run privacy:regression`, `npm run scan`, and `npm test` before
  merging relevant changes.
- [ ] Use synthetic fixtures only in pull requests, issues, demos, and docs.

## Developer Rules

- Do not commit API keys or direct identifiers.
- Use opaque codes such as `S-001` in prompts, schemas, evals, and examples.
- Add a deterministic privacy regression case when changing risk logic or a
  parent-facing prompt.
- Treat a preflight pass as a minimum guard, not proof that data is safe to
  disclose to an external model.

## References

- [Taiwan Personal Data Protection Act](https://law.moj.gov.tw/LawClass/LawSingle.aspx?pcode=I0050021)
- [COPPA](https://www.ftc.gov/legal-library/browse/rules/childrens-online-privacy-protection-rule)
- [GDPR Article 8](https://gdpr-info.eu/art-8-gdpr/)
