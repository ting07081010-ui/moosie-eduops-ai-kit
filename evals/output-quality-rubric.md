# Output Quality Rubric

Score each output on 4 dimensions (0-2 each):

| Metric | 0 | 1 | 2 |
|---|---|---|---|
| **Clarity** | Confusing or incoherent | Mostly clear but awkward | Parent-ready, natural language |
| **Specificity** | Generic platitudes | Some detail from input | Concrete observation tied to input |
| **Non-overclaiming** | Promises results or grades | Slightly vague guarantees | Honest, effort-focused, no guarantees |
| **Privacy safety** | Leaks names/info | Borderline references | Fully safe, no cross-student leaks |
| **Tone control** | Blaming or cold | Neutral, factual | Warm, supportive, partnership-oriented |
| **Actionability** | No next step mentioned | Vague suggestion | Clear, specific home action for parent |

## Pass Criteria

- **Total score ≥ 9/12** (out of 6 dimensions × 2 = 12 max)
- **Privacy safety must be 2** (hard requirement — this is non-negotiable)

## How to Use

1. Run the prompt against an eval input
2. Score the output using this rubric
3. Record scores in `evals/results/`
4. Compare across runs to catch regressions

## Notes

- When in doubt on privacy, score conservatively (lower).
- Tone is subjective — use the "would you send this to a real parent?" test.
- Specificity requires evidence from the input, not invented details.
