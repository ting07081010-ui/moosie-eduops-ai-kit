# Moosie EduOps AI Kit

> Open-source AI operations toolkit for small education providers (tutoring schools)
> that have no engineering team. Reusable prompts, JSON schemas, a runnable
> LINE bot / CLI demo, de-identified datasets, evals, and privacy-aware
> maintainer workflows.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![CI](https://github.com/ting07081010-ui/moosie-eduops-ai-kit/actions/workflows/ci.yml/badge.svg)](https://github.com/ting07081010-ui/moosie-eduops-ai-kit/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/ting07081010-ui/moosie-eduops-ai-kit)](https://github.com/ting07081010-ui/moosie-eduops-ai-kit/releases)

## The Problem

Small tutoring schools spend hours every week on teacher admin and parent
communication. They want AI help but have no engineers, no eval process, and
no safe way to handle minors' data.

## Who Is This For

- Small English / subject tutoring schools
- Solo teachers and small teaching teams
- EdTech builders who need a privacy-first starting point

## What's Inside

| Module | What it gives you |
|---|---|
| `prompts/` | Parent weekly summary, after-class note, risk check, task router, progress diagnosis, irregular-verb practice |
| `schemas/` | JSON schemas for student progress, lesson record, parent message, task |
| `examples/teacher-note-cli/` | Runnable CLI: teacher input → note + parent summary + tasks + risks |
| `examples/line-webhook-demo/` | LINE bot with /summary /risk /task |
| `examples/fake-data/` | De-identified sample data (safe to use) |
| `evals/` | Eval sets + quality rubric for parent messages and privacy risk |
| `workflows/` | Maintainer workflows for issue triage, PR review, release, security |

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

## Privacy First

This project **never** ships real student data. See:
- [PRIVACY.md](PRIVACY.md) — core privacy principles
- [docs/privacy-and-minors.md](docs/privacy-and-minors.md) — detailed guidance

All examples use de-identified fake data (e.g., "S-001", "Student A").
Prompts and schemas only request fields needed for the task.
A parent message must never reference another student — enforced by the privacy-risk eval.

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
| [Release Notes](workflows/release-note.md) | Generates changelog from Conventional Commits |
| [Security Review](workflows/security-review.md) | Scans for hardcoded keys, minor data risks |

## Roadmap

See the [open issues](../../issues) and [milestones](../../milestones).

Planned:
- [x] Irregular-verb practice prompt
- [x] CLI batch input support
- [x] LINE quick-reply buttons
- [x] PII scanner pre-commit hook
- [x] Bilingual (zh-TW / en) prompt variants — parent-weekly-summary supports `"language": "en"`
- [x] CI eval pipeline on every PR

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). We welcome:
- New prompts and eval cases
- Schema improvements
- Translations
- Bug reports and feature requests

Look for issues labeled [`good first issue`](../../labels/good%20first%20issue) and [`help wanted`](../../labels/help%20wanted).

## License

MIT — see [LICENSE](LICENSE).
