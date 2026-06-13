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
npm install
cp .env.example .env
npm run cli -- --file examples/fake-data/lesson-input.json
```

Expected reviewer takeaway:

- The demo uses fake lesson data.
- The output separates lesson record, parent summary, admin tasks, and risk
  checks.
- A teacher remains the approval gate.

## 3. Show Batch Processing

```bash
npm run cli -- --input-dir examples/fake-data
```

Expected reviewer takeaway:

- The workflow can process multiple fake lesson records.
- It is still bounded to education workflow output, not business-system data.

## 4. Run Structural Evals

```bash
npm run eval:structural
```

Expected reviewer takeaway:

- Evals exist and can be inspected without live model calls.
- The rubric checks clarity, specificity, non-overclaiming, privacy safety,
  actionability, and tone.

## 5. Show the LINE Demo Scope

Open `examples/line-webhook-demo/README.md`.

Expected reviewer takeaway:

- The LINE demo supports `/summary`, `/risk`, and `/task`.
- CRM, tuition payment, scheduling, grade management, and identity records are
  intentionally out of scope.
