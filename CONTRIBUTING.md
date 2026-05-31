# Contributing

Thanks for helping make AI safer for small schools!

## Ground Rules

1. **Never commit real student, parent, or teacher data.** Use de-identified fake data only.
2. One change = one branch = one pull request.
3. Use [Conventional Commits](https://www.conventionalcommits.org/): `feat:`, `fix:`, `docs:`, `chore:`, `test:`.
4. Every new prompt or schema change must include or update an eval.

## Dev Setup

```bash
npm install
cp .env.example .env   # add your OPENAI_API_KEY
npm test
npm run eval
```

## Pull Request Checklist

- [ ] No real PII in code, tests, or fixtures
- [ ] Prompts pass evals (`npm run eval`)
- [ ] Docs updated if behavior changed
- [ ] Linked to an issue
- [ ] Conventional Commit messages

## Where to Start

Look for issues labeled [`good first issue`](../../labels/good%20first%20issue) and [`help wanted`](../../labels/help%20wanted).

## Adding a New Prompt

1. Create `prompts/your-prompt.md` following the five-section format (Role / Task / Input / Output / Safety).
2. Add a JSON schema in `schemas/` if new data shape is needed.
3. Add at least 3 eval cases in `evals/`.
4. Update README's "What's inside" table.

## Code of Conduct

Be kind. We're building tools to help teachers, not to impress engineers.
