# Architecture

## System Overview

```mermaid
graph TB
    subgraph Input
        TI[Teacher Input<br/>free-text notes]
        DM[Draft Message<br/>parent message]
    end

    subgraph Prompts
        P1[teacher-after-class-note.md]
        P2[parent-weekly-summary.md]
        P3[parent-message-risk-check.md]
        P4[admin-task-router.md]
        P5[student-progress-diagnosis.md]
        P6[irregular-verb-practice.md]
    end

    subgraph Schemas
        S1[lesson-record.schema.json]
        S2[parent-message.schema.json]
        S3[task.schema.json]
        S4[student-progress.schema.json]
    end

    subgraph Output
        O1[Structured Note<br/>JSON]
        O2[Parent Summary<br/>zh-TW text]
        O3[Risk Report<br/>JSON]
        O4[Task List<br/>JSON]
        O5[Progress Report<br/>JSON]
        O6[Practice Plan<br/>JSON]
    end

    subgraph Eval
        E1[parent-message-eval.jsonl]
        E2[privacy-risk-eval.jsonl]
        E3[irregular-verb-practice-eval.jsonl]
        E4[output-quality-rubric.md]
        ER[run-evals.mjs]
    end

    subgraph Demos
        CLI[teacher-note-cli<br/>Node.js CLI]
        LINE[line-webhook-demo<br/>Express + LINE API]
    end

    TI --> P1 --> O1
    O1 --> P2 --> O2
    DM --> P3 --> O3
    O1 --> P4 --> O4
    O1 --> P5 --> O5
    O1 --> P6 --> O6

    O1 -.-> S1
    O2 -.-> S2
    O4 -.-> S3

    P1 & P2 & P3 & P4 & P5 & P6 --> ER
    E1 & E2 & E3 & E4 --> ER

    TI --> CLI
    CLI --> O1 & O2 & O4 & O3

    LINE --> P2 & P3 & P4 & P6
```

## Data Flow

### CLI Demo Flow
```
lesson-input.json
  → teacher-after-class-note.md  → structured note (JSON)
  → parent-weekly-summary.md     → parent message (zh-TW)
  → admin-task-router.md         → task list (JSON)
  → parent-message-risk-check.md → risk report (JSON)
```

Batch mode:
```
folder/*.json
  → validate each lesson record
  → run parent summary + quality gate + risk check + task extraction
  → print pass / review / fail summary table
```

### LINE Bot Flow
```
Teacher sends lesson note
  → generateLessonRecord()
  → parent-weekly-summary.md
  → quality gate + risk check
  → admin-task-router.md
  → quick reply buttons

Teacher taps "產生補強練習"
  → irregular-verb-practice.md
  → reply with focused practice plan

Teacher taps "查看黃燈學生"
  → list latest yellow / red retention signals from in-memory records
```

## Key Design Decisions

1. **JSON-driven everything.** Prompts, schemas, evals, and data are all in structured files — no hardcoded logic.
2. **Five-section prompts.** Every prompt follows Role / Task / Input / Output / Safety format for consistency and testability.
3. **Privacy by design.** Opaque student codes, no PII fields, cross-student leak detection in evals.
4. **Local-first.** Demos run locally. Only the configured LLM API is called.
5. **Eval-gated.** Changes to prompts must pass evals before merging.

## Sequence Diagrams

### CLI: Full Pipeline

```mermaid
sequenceDiagram
    participant T as Teacher
    participant CLI as CLI adapter
    participant AI as LLM API
    participant O as Output

    T->>CLI: --file lesson-input.json
    CLI->>CLI: Parse JSON input
    CLI->>AI: teacher-after-class-note.md + input
    AI-->>CLI: Structured note (JSON)
    CLI->>O: Print Internal Note

    CLI->>AI: parent-weekly-summary.md + input
    AI-->>CLI: Parent message (zh-TW)
    CLI->>O: Print Parent Summary

    CLI->>AI: admin-task-router.md + input
    AI-->>CLI: Task list (JSON)
    CLI->>O: Print Tasks

    CLI->>AI: parent-message-risk-check.md + summary
    AI-->>CLI: Risk report (JSON)
    CLI->>O: Print Risk Check
```

### Privacy: What Data Flows Where

```mermaid
flowchart LR
    subgraph SAFE[✅ Safe to Share]
        SC[Student Code: S-001]
        TP[Topic: Past tense]
        PF[Performance: good speaking]
        HW[Homework: partial]
    end

    subgraph NEVER[❌ Never in Repo]
        RN[Real Names]
        PH[Phone Numbers]
        EM[Email Addresses]
        AD[Addresses]
        PAY[Payment Data]
    end

    subgraph OUTPUT[📤 Generated Output]
        MSG[Parent Message]
        RISK[Risk Report]
        TASK[Task List]
    end

    SAFE --> MSG
    SAFE --> RISK
    SAFE --> TASK
    NEVER -.->|blocked by schema + eval| MSG
```

## File Structure

```
moosie-eduops-ai-kit/
├── prompts/                    # 6 prompt templates
│   ├── parent-weekly-summary.md
│   ├── teacher-after-class-note.md
│   ├── parent-message-risk-check.md
│   ├── admin-task-router.md
│   ├── student-progress-diagnosis.md
│   └── irregular-verb-practice.md
├── schemas/                    # 4 JSON schemas
│   ├── lesson-record.schema.json
│   ├── student-progress.schema.json
│   ├── parent-message.schema.json
│   └── task.schema.json
├── examples/
│   ├── teacher-note-cli/       # CLI demo
│   ├── line-webhook-demo/      # LINE bot demo
│   └── fake-data/              # De-identified samples
├── evals/                      # Eval sets + runner, including irregular-verb practice cases
├── scripts/                    # PII scanner + changelog generator
├── workflows/                  # Maintainer workflow docs
├── docs/                       # Extended documentation
└── .github/                    # CI, issue templates, release-notes workflow
```
