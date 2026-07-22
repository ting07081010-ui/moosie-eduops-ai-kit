import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8')
}

function readPrMetadataScript() {
  const ci = read('.github/workflows/ci.yml')
  const match = ci.match(/          script: \|\n([\s\S]*?)\n\n  test:/)
  assert.ok(match, 'PR metadata script must be present before the test job')
  return match[1].replace(/^            /gm, '')
}

async function runPrMetadataScript(body, issueResult) {
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
  const failures = []
  const run = new AsyncFunction('context', 'github', 'core', readPrMetadataScript())
  await run(
    { payload: { pull_request: { body } }, repo: { owner: 'owner', repo: 'repo' } },
    { rest: { issues: { get: issueResult } } },
    { setFailed: (message) => failures.push(message) }
  )
  return failures
}

describe('readiness contract', () => {
  it('contains the canonical maintainer guidance and skills', () => {
    const requiredPaths = [
      'AGENTS.md',
      'docs/maintainer-workflows.md',
      'docs/line-bot-workflow.md',
      'docs/codex-workflows.md',
      '.agents/skills/privacy-regression/SKILL.md',
      '.agents/skills/prompt-change-review/SKILL.md',
      '.agents/skills/release-readiness/SKILL.md',
      '.agents/skills/docs-sync/SKILL.md',
    ]

    const missing = requiredPaths.filter((relativePath) => !fs.existsSync(path.join(ROOT, relativePath)))
    assert.deepEqual(missing, [])
  })

  it('requires a linked issue and recorded verification in the PR template', () => {
    const template = read('.github/pull_request_template.md')

    assert.match(template, /linked issue/i)
    assert.match(template, /closes\s+#\d+/i)
    assert.match(template, /verification (evidence|results)/i)
  })

  it('provides a maintainer triage record in every issue template', () => {
    const templateDirectory = path.join(ROOT, '.github/ISSUE_TEMPLATE')
    const templates = fs.readdirSync(templateDirectory).filter((name) => name.endsWith('.md'))

    assert.ok(templates.length > 0, 'expected at least one issue template')
    for (const templateName of templates) {
      const template = fs.readFileSync(path.join(templateDirectory, templateName), 'utf8')
      assert.match(template, /maintainer triage record/i)
      assert.match(template, /source:/i)
      assert.match(template, /triage decision:/i)
    }
  })

  it('documents the implemented privacy boundary without claiming Presidio masking', () => {
    const privacy = read('PRIVACY.md')

    assert.match(privacy, /does not implement Microsoft Presidio/i)
    assert.doesNotMatch(privacy, /Presidio detects and masks PII/i)
    assert.match(privacy, /potential PII/i)
    assert.match(privacy, /not a complete de-identification solution/i)
  })

  it('makes deterministic privacy and mock CLI checks blocking CI steps', () => {
    const ci = read('.github/workflows/ci.yml')

    assert.match(ci, /npm run privacy:regression/)
    assert.match(ci, /npm run cli:mock/)
    assert.match(ci, /pr-metadata/)
    assert.match(ci, /github\.rest\.issues\.get/)
    assert.match(ci, /issue\.pull_request/)
  })

  it('checks that a linked issue exists and is not another pull request', async () => {
    const validFailures = await runPrMetadataScript(
      [
        'Closes #42',
        '',
        '## Verification evidence / results',
        '| Command or review | Exit status / result | Evidence or relevant output |',
        '| --- | --- | --- |',
        '| npm test | 0 | 31 tests passed |',
      ].join('\n'),
      async () => ({ data: { number: 42 } })
    )
    assert.deepEqual(validFailures, [])

    const emptyVerificationFailures = await runPrMetadataScript(
      'Closes #42\n\n## Verification evidence / results',
      async () => ({ data: { number: 42 } })
    )
    assert.deepEqual(emptyVerificationFailures, [
      'PR body must include a real linked issue (for example, Closes #123) and at least one recorded Verification evidence/results row.',
    ])

    const pullRequestFailures = await runPrMetadataScript(
      [
        'Closes #42',
        '',
        '## Verification evidence / results',
        '| Command or review | Exit status / result | Evidence or relevant output |',
        '| --- | --- | --- |',
        '| npm test | 0 | 31 tests passed |',
      ].join('\n'),
      async () => ({ data: { number: 42, pull_request: {} } })
    )
    assert.deepEqual(pullRequestFailures, ['The linked item must be an issue, not another pull request.'])

    const missingIssueFailures = await runPrMetadataScript(
      [
        'Closes #42',
        '',
        '## Verification evidence / results',
        '| Command or review | Exit status / result | Evidence or relevant output |',
        '| --- | --- | --- |',
        '| npm test | 0 | 31 tests passed |',
      ].join('\n'),
      async () => {
        throw new Error('Not Found')
      }
    )
    assert.deepEqual(missingIssueFailures, ['The linked issue #42 does not exist or is not accessible.'])
  })

  it('runs the fake-data CLI in mock mode without an API key', () => {
    const { OPENAI_API_KEY, ...envWithoutApiKey } = process.env
    const result = spawnSync(
      process.execPath,
      ['src/adapters/cli-adapter.mjs', '--mock', '--file', 'examples/fake-data/lesson-input.json'],
      {
        cwd: ROOT,
        encoding: 'utf8',
        env: envWithoutApiKey,
      }
    )

    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stdout, /Mock mode/i)
    assert.match(result.stdout, /Parent Summary/)
    assert.match(result.stdout, /Risk Check/)
  })
})
