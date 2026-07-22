import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { validateLessonRecord } from '../src/core/schema-validator.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

describe('schema compatibility', () => {
  it('continues to accept the published v0.2.1 synthetic lesson record fixture', () => {
    const fixturePath = path.join(ROOT, 'test/fixtures/lesson-record-v0.2.1.json')
    const legacyRecord = JSON.parse(fs.readFileSync(fixturePath, 'utf8'))

    const result = validateLessonRecord(legacyRecord)

    assert.equal(result.valid, true, result.errors.join('\n'))
  })
})
