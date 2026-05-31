# Issue Triage Workflow

Use this workflow to automatically label and categorize new issues.

## Label Taxonomy

| Label | Color | When to apply |
|---|---|---|
| `bug` | 🔴 red | Something is broken |
| `enhancement` | 🔵 blue | New feature or improvement |
| `documentation` | 🟢 green | Docs need updating |
| `privacy` | 🟣 purple | Related to data privacy or minors |
| `education` | 🟡 yellow | Pedagogical content or approach |
| `eval` | 🟠 orange | Evaluation set or rubric |
| `security` | ⚫ black | Security concern |
| `ci` | 🔵 light blue | CI/CD pipeline |
| `good first issue` | 🟢 light green | Good for new contributors |
| `help wanted` | 🟡 light yellow | Needs community help |

## Triage Rules

### Automatic Labels

| Keywords in title/body | Labels |
|---|---|
| "privacy", "PII", "student data", "minor" | `privacy` |
| "prompt", "schema", "eval" | `enhancement` |
| "README", "docs", "typo" | `documentation` |
| "CI", "workflow", "action" | `ci` |
| "crash", "error", "broken", "fail" | `bug` |
| "security", "key", "secret", "leak" | `security` |

### Priority

- `security` + `privacy` → immediate attention
- `bug` → fix before next release
- `enhancement` → backlog
- `documentation` → can be picked up by community

## Codex Triage Prompt

```
Triage this issue for the Moosie EduOps AI Kit.

Read the title and body. Assign one or more labels:
- bug, enhancement, documentation, privacy, education, eval, security, ci
- If appropriate, also add "good first issue" or "help wanted"

Output:
labels: [list of labels]
priority: critical / high / medium / low
summary: one-line summary
```
