# LINE Slash-Command Webhook Demo

This is the slash-command LINE server, distinct from the full quick-reply
integration started by `npm run line:quick-reply`. It shows how a small
education team could expose three AI workflow commands through LINE while
keeping the open-source core focused and small.

It is a reference implementation, not a full school management system.

## Commands

| Command | Purpose |
|---|---|
| `/summary` | Generate a parent weekly summary from a lesson record |
| `/risk` | Check privacy, over-promising, and tone risks |
| `/task` | Extract admin tasks from teacher notes |

Unknown slash commands and ordinary text receive the command guide; they are not
sent to the model.

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
npm run line:slash-demo
```

The older `npm run line:demo` name remains available as an alias.

Required environment variables:

- `OPENAI_API_KEY`
- `LINE_CHANNEL_ACCESS_TOKEN`
- `LINE_CHANNEL_SECRET`

`npm run line:slash-demo` (and its alias `npm run line:demo`) loads these values
from the project-root `.env` file before the demo starts; values already set in
the shell take precedence.

For first-pass review without LINE credentials, read the handler code in
[`server.mjs`](./server.mjs) and run the CLI demo instead:

```bash
npm run cli -- --file examples/fake-data/lesson-input.json
```
