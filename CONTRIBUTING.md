# Contributing

Thank you for considering a contribution.

This project welcomes practical improvements for small education teams, especially:

- New prompt templates
- Better JSON schemas
- Fake datasets
- Eval cases
- Traditional Chinese translations
- Privacy-risk checks
- Documentation improvements
- LINE bot workflow examples

## Contribution Principles

1. Do not submit real student data.
2. Do not include names, phone numbers, addresses, school names, or identifiable parent messages.
3. Use fake IDs such as `S-001`, `Student A`, `Parent B`.
4. Keep outputs specific but not overconfident.
5. Avoid medical, psychological, or diagnostic claims.
6. Add eval cases when changing prompts.

## Local Setup

```bash
git clone https://github.com/ting07081010-ui/moosie-eduops-ai-kit.git
cd moosie-eduops-ai-kit
npm install
cp .env.example .env
npm test
npm run eval
```

## Pull Request Checklist

Before opening a PR:

- [ ] I did not include real student data
- [ ] I used fake or de-identified sample data only
- [ ] I updated docs if behavior changed
- [ ] I added or updated eval cases if prompts changed
- [ ] I ran `npm test`
- [ ] I ran `npm run eval`
- [ ] I checked for privacy risks

## Good First Contributions

- Add one fake lesson input
- Add one Traditional Chinese parent summary prompt
- Improve README clarity
- Add one privacy-risk eval case
- Add one LINE command example

## Adding a New Prompt

1. Create `prompts/your-prompt.md` following the five-section format (Role / Task / Input / Output / Safety).
2. Add a JSON schema in `schemas/` if new data shape is needed.
3. Add at least 3 eval cases in `evals/`.
4. Update README's "What's inside" table.

## Code of Conduct

Be kind. We're building tools to help teachers, not to impress engineers.