# Release Notes Workflow

Use this workflow to generate release notes from Conventional Commits.

## Process

1. Trigger the `Draft Release Notes` GitHub Action manually
2. Provide the target version and optional starting tag / commit
3. Download the generated `RELEASE_NOTES.md` artifact
4. Review the notes before creating a GitHub release

## Changelog Format

```markdown
## [0.1.0] - 2026-05-31

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
# Draft release notes locally
npm run changelog -- --version v0.1.0 --output RELEASE_NOTES.md

# Tag the release
git tag v0.1.0
git push origin v0.1.0

# Create GitHub release
gh release create v0.1.0 \
  --title "v0.1.0" \
  --notes-file RELEASE_NOTES.md
```
