# Privacy & Minors Policy

This project is designed for an education context involving minors. **Privacy is a core feature, not an afterthought.**

## Principles

1. **All examples use de-identified fake data** (e.g., "Student A", "S-001"). No real names, ever.
2. **Data minimization.** Prompts and schemas only request fields needed for the task.
3. **No cross-student leakage.** A parent message must never reference another student. This is enforced by the privacy-risk eval.
4. **Local-first demos.** Demos run locally; nothing is sent anywhere except the model API you configure.
5. **Right to be forgotten.** Schemas use opaque student codes so records can be deleted without trace.

## What We Do NOT Collect

- Real names
- Contact info (phone, email, address)
- Payment data
- Photos or biometric data
- Anything that identifies a specific child

## For Adopters

If you deploy this in a real school, **you are the data controller**. You must:

- Follow your local regulations on minors' data (e.g., COPPA, GDPR-K, Taiwan's PIPA)
- Obtain parental consent where required
- Ensure your LLM provider's data handling complies with your obligations
- Never log prompts containing real student data to external services

## Eval Enforcement

The `evals/privacy-risk-eval.jsonl` set specifically tests for:

- Cross-student name leaks
- Over-promising (guaranteeing grades or results)
- Identifying information in generated messages
- Cold or blaming tone toward children

See [docs/privacy-and-minors.md](docs/privacy-and-minors.md) for detailed guidance.
