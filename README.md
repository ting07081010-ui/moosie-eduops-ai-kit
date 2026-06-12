# Moosie EduOps AI Kit

> Privacy-first AI operations toolkit for small education providers: reusable prompts, JSON schemas, fake datasets, CLI/LINE demos, evals, and maintainer workflows.

Small tutoring schools and education teams often want AI support, but they usually lack engineering staff, evaluation processes, and safe data-handling patterns for minors' learning data.

This repo turns practical AI operations workflows into reusable open-source building blocks.

## What You Can Build

With this kit, you can prototype:

- Teacher note → structured lesson record
- Lesson record → parent-friendly weekly summary
- Student progress data → learner profile
- Teacher/admin message → task routing
- Parent message → privacy and overclaiming risk check
- LINE bot command → summary / risk / task workflow
- Prompt output → eval scoring and safety check

## Why This Exists

Most AI examples are designed for engineering teams.

Small education providers need something different:

- Runnable examples instead of abstract strategy
- Fake data instead of real student data
- JSON schemas instead of loose chat outputs
- Evaluation rubrics instead of blind trust
- Privacy-aware workflows for minors
- Traditional Chinese education contexts

This project is an open-source attempt to make responsible AI workflows usable by small schools, solo teachers, churches, nonprofits, and local community teams.

## Demo Paths

Choose one path depending on what you want to test.

### 1. Teacher Note CLI

Use this when you want to test the core workflow locally.

```bash
npm install
cp .env.example .env
npm run cli -- --file examples/fake-data/lesson-input.json
```

Expected output:
- Structured lesson note
- Parent summary
- Admin tasks
- Risk flags

### 2. Batch Lesson Processing

Use this when you want to process multiple fake lesson records.

```bash
npm run cli -- --input-dir examples/fake-data
```

### 3. Prompt Quality Evals

Use this when you want to check output quality and privacy risk.

```bash
npm run eval
```

### 4. LINE Webhook Demo

Use this when you want to test a lightweight LINE bot workflow.

Supported demo commands:
- `/summary`
- `/risk`
- `/task`

---

## Example Output

Input: a short teacher note after class.

```json
{
  "student_id": "S-001",
  "lesson_topic": "Past tense verbs",
  "teacher_note": "Student A understood regular past tense but still confused go/went and eat/ate. She participated actively during the speaking game.",
  "parent_context": "Parent wants practical feedback and one home practice suggestion."
}
```

Output:

```json
{
  "parent_summary": "Student A participated actively today and showed good understanding of regular past tense forms. The main next step is to strengthen irregular verbs such as go/went and eat/ate.",
  "home_practice": "Ask Student A to say three sentences about yesterday using went, ate, and saw.",
  "tasks": [
    {
      "owner": "teacher",
      "task": "Prepare irregular verb speaking drill for next class",
      "priority": "medium"
    }
  ],
  "risk_flags": []
}
```

The fake data intentionally avoids real names, contact details, school names, or identifiable student records.

## Privacy Model

This project is designed for education contexts involving minors.

Default rules:

- Never commit real student data
- Use fake IDs such as `S-001`
- Avoid full names, phone numbers, addresses, school names, or parent contact details
- Do not mention one student in another student's parent message
- Do not generate medical, psychological, or diagnostic claims
- Do not overpromise progress
- Run privacy-risk evals before accepting new prompt templates

See:

- [PRIVACY.md](./PRIVACY.md)
- [docs/privacy-and-minors.md](./docs/privacy-and-minors.md)
- [evals/output-quality-rubric.md](./evals/output-quality-rubric.md)

## Architecture

```
moosie-eduops-ai-kit/
├── prompts/                    # Reusable prompt templates (5 roles)
│   ├── parent-weekly-summary.md
│   ├── teacher-after-class-note.md
│   ├── parent-message-risk-check.md
│   ├── admin-task-router.md
│   ├── student-progress-diagnosis.md
│   └── irregular-verb-practice.md
├── schemas/                    # JSON schemas (4 types)
│   ├── lesson-record.schema.json
│   ├── student-progress.schema.json
│   ├── parent-message.schema.json
│   └── task.schema.json
├── examples/
│   ├── teacher-note-cli/       # CLI demo (Node.js)
│   ├── line-webhook-demo/      # LINE bot demo
│   └── fake-data/              # De-identified samples
├── evals/                      # Eval sets + rubric + runner
├── workflows/                  # Maintainer workflow docs
└── docs/                       # Extended documentation
```

See [docs/architecture.md](docs/architecture.md) for a detailed diagram.

## Evaluation

Run evals to check prompt quality:

```bash
npm run eval
```

Evals cover:

- **Parent message quality** — clarity, specificity, non-overclaiming, tone
- **Privacy risk** — no cross-student leaks, no over-promising, no PII

Pass threshold: score ≥ 9/12 AND privacy safety == 2.

See [evals/output-quality-rubric.md](evals/output-quality-rubric.md).

## Maintainer Workflows

This repo uses Codex-powered workflows for:

| Workflow | What Codex does |
|---|---|
| [PR Review](workflows/pr-review.md) | Checks prompts for over-promising, PII leaks, schema compliance |
| [Issue Triage](workflows/issue-triage.md) | Auto-labels: bug / feature / docs / privacy / education |
| [Release Notes](workflows/release-note.md) | Generates changelog from Conventional Commits via `npm run changelog` / GitHub Actions |
| [Security Review](workflows/security-review.md) | Scans for hardcoded keys, minor data risks |

## Quick Start

```bash
# Clone & install
git clone https://github.com/ting07081010-ui/moosie-eduops-ai-kit.git
cd moosie-eduops-ai-kit
npm install

# Configure
cp .env.example .env
# Edit .env and add your OPENAI_API_KEY

# Run CLI demo
npm run cli -- --file examples/fake-data/lesson-input.json

# Process all lesson JSON files in a folder
npm run cli -- --input-dir examples/fake-data

# Run evals
npm run eval

# Run tests
npm test
```

## Project Status

Current version: operations

This project is early-stage but runnable.

**Stable:**

- Prompt templates
- JSON schemas
- Fake data examples
- Teacher-note CLI demo
- Basic eval runner
- Privacy documentation

**Experimental:**

- LINE webhook demo
- Batch processing
- Maintainer workflows
- Bilingual prompt variants
- CI eval pipeline

## Ecosystem Impact

This repo is designed for small education teams and local community organizations that want to adopt AI workflows but cannot afford a dedicated engineering team.

**Potential downstream users:**

- Small tutoring schools
- Solo teachers
- Church education teams
- Nonprofit learning programs
- Local community learning centers
- EdTech builders working in Traditional Chinese contexts

**Reusable components:**

- Prompt templates
- JSON schemas
- Fake education datasets
- CLI workflow examples
- LINE bot demo patterns
- Prompt evaluation rubrics
- Privacy-risk review workflows
- Maintainer workflows for AI-assisted open source work

The project focuses on a gap that is often under-served by enterprise AI tooling: practical, privacy-aware, small-team AI operations in education.

## Roadmap

### v0.2.0 — Better Local Adoption

- [ ] Add Traditional Chinese prompt variants
- [ ] Add more fake lesson datasets
- [ ] Improve CLI output formatting
- [ ] Add PII scanner pre-commit hook
- [ ] Add screenshots / terminal demo GIF
- [ ] Add beginner setup guide

### v0.3.0 — Workflow Integrations

- [ ] Improve LINE quick-reply flow
- [ ] Add Google Sheets export example
- [ ] Add parent insight workflow example
- [ ] Add Granola-style meeting note import example
- [ ] Add admin dashboard mock output

### v0.4.0 — Evaluation and Governance

- [ ] Run evals in CI on every PR
- [ ] Add unsafe-output regression cases
- [ ] Add bilingual eval rubrics
- [ ] Add maintainer review checklist
- [ ] Add release governance template

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). We welcome:

- New prompts and eval cases
- Schema improvements
- Translations
- Bug reports and feature requests

Look for issues labeled [`good first issue`](../../labels/good%20first%20issue) and [`help wanted`](../../labels/help%20wanted).

## License

MIT — see [LICENSE](LICENSE).