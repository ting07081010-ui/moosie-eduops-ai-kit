import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  assertSafeForLlm,
  findHighRiskPii,
} from '../src/core/input-privacy-gate.mjs'
import { callLLM } from '../src/core/llm.mjs'

const testDir = path.dirname(fileURLToPath(import.meta.url))

function findDirectOpenAiCallSites(directory) {
  const paths = []

  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue

    const fullPath = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      paths.push(...findDirectOpenAiCallSites(fullPath))
      continue
    }

    if (!entry.isFile() || path.extname(entry.name) !== '.mjs') continue
    const source = fs.readFileSync(fullPath, 'utf8')
    if (/fetch\(\s*['"]https:\/\/api\.openai\.com\//.test(source)) {
      paths.push(fullPath)
    }
  }

  return paths
}

describe('LLM input privacy gate', () => {
  it('allows synthetic opaque student fixtures', () => {
    const findings = findHighRiskPii({
      studentCode: 'S-001',
      note: '能說出三個 past tense 句子。',
    })

    assert.deepEqual(findings, [])
    assert.doesNotThrow(() => {
      assertSafeForLlm({ studentCode: 'S-001', note: 'fake fixture' })
    })
  })

  it('blocks Taiwan phone numbers, email addresses, and national IDs before an LLM call', () => {
    const payload = {
      studentCode: 'S-001',
      phone: '0912-345-678',
      email: 'parent@example.com',
      nationalId: 'A123456789',
    }

    const findings = findHighRiskPii(payload)

    assert.deepEqual(
      findings.map((finding) => finding.type).sort(),
      ['email', 'taiwanNationalId', 'taiwanPhone'].sort()
    )
    assert.throws(() => assertSafeForLlm(payload), /potential PII/i)
  })

  it('fails closed before core LLM code reaches fetch', async () => {
    const originalFetch = globalThis.fetch
    let fetchCalled = false
    globalThis.fetch = async () => {
      fetchCalled = true
      throw new Error('Network should not be called for PII')
    }

    try {
      await assert.rejects(
        () => callLLM('test prompt', { parentPhone: '0912-345-678' }),
        /potential PII/i
      )
    } finally {
      globalThis.fetch = originalFetch
    }

    assert.equal(fetchCalled, false)
  })

  it('requires every direct OpenAI call site to run the input gate before network calls', () => {
    const projectRoot = path.resolve(testDir, '..')
    const directCallSites = findDirectOpenAiCallSites(projectRoot)

    assert.ok(directCallSites.length > 0, 'expected at least one direct OpenAI call site')
    for (const filePath of directCallSites) {
      const source = fs.readFileSync(filePath, 'utf8')
      assert.match(source, /import\s+\{\s*assertSafeForLlm\s*\}/)
      assert.match(source, /assertSafeForLlm\(userPayload\)/)
    }
  })
})
