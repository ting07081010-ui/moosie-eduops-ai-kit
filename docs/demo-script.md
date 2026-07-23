# Demo Script

Use this script when showing the repository to a reviewer in three minutes.

## 1. Explain the Project

Moosie EduOps AI Kit is an open-source reference implementation for small
education providers that want AI-assisted teacher workflows without exposing
real student data.

Point reviewers to:

- `README.md`
- `PRIVACY.md`
- `examples/fake-data/`
- `evals/`

## 2. Run the CLI Demo

```bash
npm ci
npm run cli:mock
```

Expected reviewer takeaway:

- The demo uses fake lesson data, no API key, and no network model call.
- The output separates lesson record, parent summary, admin tasks, and risk
  checks.
- A teacher remains the approval gate.

## 3. Show Deterministic Safety and Eval Gates

```bash
npm run eval:structural
npm run privacy:regression
npm run schema:compat
npm run scan
```

Expected reviewer takeaway:

- Structural fixtures, privacy regression, schema compatibility, and PII scan
  are deterministic local checks.
- A passing check has a stated scope; it does not prove production safety or
  external adoption.

## 4. Optional Live and Batch Paths

Live model calls are not part of the three-minute demo. A maintainer may
configure a local, untracked .env and run the documented live CLI or eval path
only with synthetic, pre-de-identified input. Batch processing also requires
mock mode or a configured model; do not present it as a no-key default.

Expected reviewer takeaway:

- The clean-install demonstration is mock-first.
- Live output requires additional model, privacy, and human-review controls.

## 5. Show the LINE Demo Scope

Open `examples/line-webhook-demo/README.md`.

Expected reviewer takeaway:

- The LINE demo supports `/summary`, `/risk`, and `/task`.
- CRM, tuition payment, scheduling, grade management, and identity records are
  intentionally out of scope.
- The reference adapter is not a production delivery channel and cannot bypass
  human approval.
