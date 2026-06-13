# LINE Webhook Demo

This demo shows how a small education team could expose three AI workflow
commands through LINE while keeping the open-source core focused and small.

It is a reference implementation, not a full school management system.

## Commands

| Command | Purpose |
|---|---|
| `/summary` | Generate a parent weekly summary from a lesson record |
| `/risk` | Check privacy, over-promising, and tone risks |
| `/task` | Extract admin tasks from teacher notes |

## Not Included

This demo intentionally does not include:

- CRM
- Tuition payment
- Scheduling
- Grade management
- Parent database
- Student identity records

Those belong to the business layer, not the open-source workflow core.

## Local Run

```bash
cp .env.example .env
npm run line:demo
```

Required environment variables:

- `OPENAI_API_KEY`
- `LINE_CHANNEL_ACCESS_TOKEN`
- `LINE_CHANNEL_SECRET`

For first-pass review without LINE credentials, read the handler code in
[`server.mjs`](./server.mjs) and run the CLI demo instead:

```bash
npm run cli -- --file examples/fake-data/lesson-input.json
```
