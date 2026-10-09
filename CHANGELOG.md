# Changelog

## [0.3.0] - 2026-10-09

### Added

- Optional Claude provider through the official Anthropic SDK, selected with `AI_PROVIDER`, `ANTHROPIC_API_KEY`, and `ANTHROPIC_MODEL` (#22)
- Fake-data provider demo (`npm run demo`) with `--dry-run` and `--mock`, reading `examples/fake-data/classroom-observation.json` (#22)
- Human approval gate: `createDraft`, `approveDraft`, and `outgoingText` (#23)
- Claude prompt caching on the shared system prompt (#23)
- Optional `ANTHROPIC_RISK_MODEL` for the parent-message risk check only (#23)
- Live parent-message and privacy-risk evals through the selected provider, with `--report` to save a JSON report (#23)

### Improved

- OpenAI chat-completions remains the path when `AI_PROVIDER=openai`, or when `AI_PROVIDER` is unset and `ANTHROPIC_API_KEY` is not set (#22)
- Live evals call the shared provider switch instead of a hard-coded OpenAI request (#23)
- CLI and LINE startup messages name the missing key for the selected provider (#22)
- PII scanner treats `@anthropic-ai` as a package scope, not a LINE ID (#22)

### Behavior change

Drafts start as `pending`. Sendable text comes only from `outgoingText()` after `approveDraft()`, and only when `approvedBy` is `teacher` or `admin`. A draft whose risk verdict is `block` cannot be approved. Setting `status` to `"approved"` by hand does not make the text sendable. See the upgrade notes in [docs/releases/v0.3.0.md](docs/releases/v0.3.0.md).

### Validation

- `npm test`
- `npm run eval:structural`
- `npm run scan`

### Privacy

This release continues to use fake and de-identified data only. The demo observation uses student code `S-001`. The Claude pilot is in progress, and this entry does not include live quality scores.
