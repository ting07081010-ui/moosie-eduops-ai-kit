# Threat Model

## Scope and non-goals

Moosie EduOps AI Kit is a reference toolkit for privacy-aware education AI
workflows. It is not a hosted student-information system, identity service,
consent system, audit store, delivery service, or complete de-identification
tool.

This threat model covers the tracked source tree, fake fixtures, local CLI,
optional model calls, CI gates, and reference LINE adapters. A school deploying
the kit owns the production architecture and its legal, privacy, security, and
operational controls.

## Assets to protect

| Asset | Why it matters |
| --- | --- |
| Minor-related information | A real name, contact detail, school context, or combination of facts can identify a student or family. |
| API and channel credentials | A leaked key can expose model usage, messaging capability, or other systems. |
| Parent-facing drafts | A misleading, overpromising, blaming, or cross-student message can cause harm even without a direct identifier. |
| Prompt, schema, and eval integrity | Unsafe changes can silently weaken safeguards across every adopter. |
| Evidence records | Inflated tester, review, or adoption claims undermine the project and any application. |
| CI and release process | A bypass can publish unreviewed or unsafe changes. |

## Trust boundaries

~~~text
Contributor or local input
  -> repository PII/secret scan and review
  -> schema validation plus LLM input preflight
  -> optional external model produces a draft
  -> local quality and risk checks
  -> named human approval in the deploying system
  -> separately implemented delivery channel
~~~

The mock CLI stays on the local side of the model boundary and makes no network
model call. The reference LINE adapters cross an external platform boundary and
must not be treated as a production approval or retention system.

## Threats, controls, and residual risks

| Threat | Implemented prevention | Detection | Human or deployment control | Residual risk |
| --- | --- | --- | --- | --- |
| Real student or parent data enters the repository. | Synthetic-fixture policy, CONTRIBUTING rules, and examples with opaque codes. | PII scanner and CI scan. | Maintainer review; stop release and remove data if found. | Pattern scanning can miss names, context, or indirect identification. |
| Obvious direct identifiers reach an LLM call. | Input preflight blocks supported Taiwan mobile numbers, email addresses, and Taiwan IDs before core and demo call sites. | Privacy regression tests and direct-call-site contract tests. | Deployers must de-identify before the model boundary. | The preflight is incomplete de-identification; it does not recognize every name, address, school, health fact, or contextual identifier. |
| A parent draft mentions another student or makes a guarantee. | Parent-message prompt rules and local risk gate. | Privacy-risk evals and quality checks. | A qualified human approves every parent-facing message before delivery. | Model output can still be wrong or unsafe; a passing check is not approval. |
| A draft invents learning facts or makes diagnostic claims. | Evidence-focused prompt guidance and schema-shaped inputs. | Evals and maintainer review. | Teacher verifies observations and decides whether to use a draft. | The toolkit cannot prove factual accuracy from a model response. |
| A credential is committed. | .env guidance and no-key mock path. | PII/secret scanner and CI grep gate. | Rotate exposed credentials and review history if an exposure occurs. | Scanner patterns are incomplete and cannot detect every secret format. |
| Untrusted text attempts to override instructions. | System prompt and user payload are passed separately by the core caller. | No complete automated adversarial-defense suite exists. | Treat untrusted input as draft material; deployers must add access controls and an appropriate injection defense. | Prompt injection remains an open deployment risk. |
| A LINE webhook or delivery flow sends unapproved content. | Signature verification appears in reference adapters. | Local tests and manual inspection only. | Deploying system must add identity binding, consent, audit trail, retention, access control, and fail-closed human approval. | The adapters are not production integrations. |
| Evidence is inflated through templates or self-created issues. | Evidence Pack uses not recorded and source/date rules. | Maintainer review of public URLs or consented records. | Applicant verifies identity, ownership, source type, and consent before submission. | Local documents cannot independently prove external activity. |

## Required human approval boundary

The toolkit can generate drafts and risk reports. It must not autonomously make a
student-risk decision, teaching diagnosis, disciplinary judgment, parent-facing
communication, or other decision affecting a minor's rights or wellbeing.

A deployment must require a named human approver before parent-facing content is
sent. The repository cannot observe or enforce that external control, so
deployers must fail closed when approval is absent.

## Incident and release stop conditions

Stop a release or public evidence update when any of these occur:

- Real or likely personal data appears in the repository, issue, document, or
  eval fixture.
- A credential is exposed or suspected to be exposed.
- A privacy regression, cross-student leak, or unsafe automatic delivery path
  is found.
- An evaluation failure cannot be reproduced or classified.
- A claim lacks a dated source, consent, or an accurate scope statement.

For a potential secret, rotate or revoke it through the provider's supported
process. For personal data, remove access and follow the relevant incident and
legal process. Do not paste the sensitive value into a public issue or report.

## Review cadence

- Prompt or privacy-risk change: run privacy regression and structural evals.
- Schema change: run schema compatibility checks.
- Example or onboarding change: run the mock CLI clean path.
- Release candidate: run all required commands and attach results to the
  release preparation record.
- Production adapter work: perform a separate deployment threat-model review;
  this document is not sufficient approval.
