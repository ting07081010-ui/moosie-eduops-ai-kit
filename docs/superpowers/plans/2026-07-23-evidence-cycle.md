# Evidence Cycle Documentation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Turn the 45-day handbook into an honest, mock-first documentation and evidence cycle without creating remote GitHub activity or inventing external adoption.

**Architecture:** Keep policy, current evidence, and future evidence templates distinct. Existing docs/application-evidence.md remains the dated factual index; new documentation explains how a maintainer collects future evidence. A repository contract test prevents the onboarding path from silently reverting to live API or unverifiable evidence claims.

**Tech Stack:** Markdown, GitHub Issue Forms YAML, Node.js built-in test runner, existing npm scripts.

## Global Constraints

- Make no GitHub, release, issue, PR, tag, or push operation.
- Never add real student, parent, teacher, school, account, or credential data.
- Treat npm ci plus npm run cli:mock as the default clean-install path; live eval stays optional.
- Use not recorded for beta, reviewer, adoption, and feedback facts until a dated source exists.
- The LINE adapter remains a non-production reference; parent-facing content requires human approval.
- Do not introduce dependencies.

---

### Task 1: Add a readiness-document contract test

**Files:**
- Modify: test/readiness-contract.test.mjs

**Interfaces:**
- Consumes: repository documentation files as UTF-8 text.
- Produces: a deterministic Node test that fails when required readiness documents or mock-first onboarding markers are absent.

- [ ] **Step 1: Write the failing test**

Add a test named documents the 45-day evidence cycle without making external claims. It must require these paths:

    docs/45-day-readiness-plan.md
    docs/beta-test-guide.md
    docs/feedback-template.md
    docs/evidence/README.md
    docs/threat-model.md
    docs/eval-report.md
    evals/results/README.md
    CHANGELOG.md
    .github/ISSUE_TEMPLATE/beta-feedback.yml

The test must assert that CONTRIBUTING.md contains npm ci and npm run cli:mock, does not require npm run eval, and that the beta guide contains synthetic and not recorded.

- [ ] **Step 2: Run the focused test to verify it fails**

Run: npm test -- test/readiness-contract.test.mjs

Expected: FAIL because the 45-day evidence-cycle documents do not yet exist.

- [ ] **Step 3: Keep the test as the acceptance contract**

Do not weaken the assertions after implementation. The later document tasks must satisfy this test exactly.

- [ ] **Step 4: Run the focused test after all document tasks**

Run: npm test -- test/readiness-contract.test.mjs

Expected: PASS with the existing readiness tests and the new documentation contract.

### Task 2: Create the 45-day plan and beta-evidence intake surfaces

**Files:**
- Create: docs/45-day-readiness-plan.md
- Create: docs/beta-test-guide.md
- Create: docs/feedback-template.md
- Create: docs/evidence/README.md
- Create: .github/ISSUE_TEMPLATE/beta-feedback.yml
- Modify: README.md

**Interfaces:**
- Consumes: current source of truth in docs/application-evidence.md and docs/readiness-evidence.md.
- Produces: a future-facing evidence collection workflow that never changes current not recorded facts by template alone.

- [ ] **Step 1: Add the 45-day evidence-cycle plan**

Document a new evidence-cycle timeline rather than rewriting historical releases: Days 1–14 verify runnable and safety baselines, Days 15–30 collect consented external testing and triage real feedback, Days 31–45 publish dated results and pursue verifiable external use. For every phase, name the evidence source, owner role, and stop condition. State that completion is conditional on real evidence rather than a calendar date.

- [ ] **Step 2: Add beta onboarding and feedback templates**

Make the beta guide use only npm ci, npm run cli:mock, deterministic checks, and synthetic fixtures. The feedback template must collect environment, duration, friction point, useful output, consent to summarize, and an optional issue or PR URL. docs/evidence/README.md must explicitly prohibit names, contacts, school identifiers, raw prompts, and credentials.

- [ ] **Step 3: Add a beta-feedback Issue Form**

Use body fields for a required synthetic-data confirmation, setup outcome, anonymous findings, consent choice, and optional follow-up URL. The form must state that it does not create external-evidence status by itself.

- [ ] **Step 4: Link the safe paths from README**

Add concise links to the 45-day plan, beta guide, feedback template, and application evidence pack. Do not add a beta count or a success claim.

### Task 3: Add threat-model and reproducible-eval documentation

**Files:**
- Create: docs/threat-model.md
- Create: docs/eval-report.md
- Create: evals/results/README.md
- Modify: docs/application-evidence.md
- Modify: docs/readiness-evidence.md

**Interfaces:**
- Consumes: implemented controls in PRIVACY.md, src/core/input-privacy-gate.mjs, scripts/pii-scanner.mjs, and .github/workflows/ci.yml.
- Produces: documentation that maps threats to existing controls and defines append-only, versioned result records.

- [ ] **Step 1: Add docs/threat-model.md**

Include assets, trust boundaries, abuse scenarios, implemented prevention and detection controls, human approval requirements, and residual risk. State precisely that pattern preflight is incomplete de-identification and that production adapters own identity, consent, retention, access control, and delivery approval.

- [ ] **Step 2: Add an eval-report protocol and result directory guide**

Document required metadata: date, commit, release, Node version, command, fixture counts, pass and fail counts, failure category, and source. State that structural fixture validation is not a live-model quality rate, and reserve a dated entry only for commands actually run.

- [ ] **Step 3: Cross-link policy and evidence documents**

Add links from both evidence ledgers to the plan, eval-report protocol, and beta guide. Preserve all existing not recorded values and public-source limits.

### Task 4: Make contributor and demo onboarding mock-first and add a factual changelog baseline

**Files:**
- Modify: CONTRIBUTING.md
- Modify: docs/demo-script.md
- Create: CHANGELOG.md

**Interfaces:**
- Consumes: npm scripts in package.json.
- Produces: a default contributor/demo path that works without OPENAI_API_KEY and records live evaluation as optional.

- [ ] **Step 1: Replace stale default commands**

In contributor and demo instructions, use npm ci, npm run cli:mock, npm run eval:structural, npm run privacy:regression, npm run schema:compat, npm test, and npm run scan. Retain live evaluation only in a clearly marked optional section that requires local .env configuration.

- [ ] **Step 2: Add CHANGELOG.md**

Use Keep a Changelog headings. Add an Unreleased section that has no outcome claims. List historical release tags as links and state that detailed historical change records are not yet reconstructed; do not invent release notes or say that a release was feedback-driven.

- [ ] **Step 3: Run the focused readiness test**

Run: npm test -- test/readiness-contract.test.mjs

Expected: PASS.

### Task 5: Verify and record only fresh local evidence

**Files:**
- Modify: docs/application-evidence.md
- Modify: docs/eval-report.md

**Interfaces:**
- Consumes: terminal outputs produced for the exact first documentation commit.
- Produces: dated local evidence that names the commit, command scope, result, and limitation.

- [ ] **Step 1: Run the full repository gates after the documentation commit**

Run these commands:

    npm test
    npm run eval:structural
    npm run privacy:regression
    npm run schema:compat
    npm run cli:mock
    npm run scan
    git diff --check

Expected: every command exits 0. If any command fails, fix the relevant document or test contract or report the blocker; do not record a passing result.

- [ ] **Step 2: Append a dated, local-only evidence entry**

Use the exact commit SHA and command outputs. Record no external beta, reviewer, adoption, or release fact unless a dated source exists. State that the entry is local and not a remote CI run.

- [ ] **Step 3: Re-run the relevant test and diff validation**

Run: npm test -- test/readiness-contract.test.mjs && git diff --check

Expected: exit 0.

- [ ] **Step 4: Commit in focused units**

Commit 1 message: docs: add mock-first evidence cycle materials

Commit 2 message: docs: record readiness evidence cycle results

Use the repository Lore trailers. Do not push either commit.

## Self-review

- Coverage: the plan covers the approved local roadmap, beta and evidence templates, threat and eval documentation, mock-first onboarding, Issue Form, changelog, and dated verification; it excludes GitHub publication and invented external facts.
- Placeholder scan: no task asks an implementer to invent evidence, credentials, or future event data.
- Consistency: all default commands exist in package.json; only npm run eval is live and optional.
