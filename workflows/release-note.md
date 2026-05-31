# Release Notes Workflow

Use this workflow to generate release notes from merged PRs.

## Process

1. Collect all merged PRs since last release
2. Group by label (feat, fix, docs, chore)
3. Generate changelog
4. Create GitHub release

## Changelog Format

```markdown
## [0.1.0] - 2026-06-13

### ✨ Features
- Added student progress diagnosis prompt (#12)
- CLI batch input support (#15)

### 🐛 Fixes
- Fixed schema validation for empty followUps (#8)

### 📚 Documentation
- Added architecture diagram (#10)
- Updated privacy guidance (#14)

### 🔒 Privacy & Security
- Added PII scanner pre-commit hook (#11)

### 🧪 Evals
- Added 5 new privacy-risk eval cases (#9)

### 🏗️ Internal
- CI: run evals on every PR (#13)
```

## Codex Release Prompt

```
Generate release notes for the Moosie EduOps AI Kit.

Read the list of merged PRs since the last release.
Group them into: Features, Fixes, Documentation, Privacy & Security, Evals, Internal.

For each PR, write a one-line description with the PR number.

Also compute the version bump:
- Any "breaking" label → major
- Any "feat" label → minor
- Only "fix" or "docs" → patch
```

## Manual Steps

```bash
# Tag the release
git tag v0.1.0
git push origin v0.1.0

# Create GitHub release
gh release create v0.1.0 \
  --title "v0.1.0" \
  --notes-file RELEASE_NOTES.md
```
