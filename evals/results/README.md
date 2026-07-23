# Versioned Evaluation Results

Store dated evaluation records here only after the command or review actually
runs. Do not add empty reports, generated placeholders, raw personal data, API
keys, or unreviewed model output.

Use the format defined in [Evaluation Report Protocol](../../docs/eval-report.md):

~~~text
YYYY-MM-DD-<short-sha>-<scope>.md
~~~

Valid scopes include structural, privacy, schema, mock-cli, and live. Each
record must identify its commit, command or CI URL, pass/fail scope, limit, and
follow-up. A live record additionally names the model, prompt version, and
human reviewer.

The directory may be empty. Its existence is not evidence of an eval run.
