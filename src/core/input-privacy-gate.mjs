/**
 * Local preflight for data that would otherwise be sent to an LLM.
 *
 * This intentionally blocks a small, explicit set of high-risk identifiers.
 * It is a defence-in-depth control, not a complete de-identification system.
 */

const HIGH_RISK_PATTERNS = [
  {
    type: 'taiwanPhone',
    pattern: /\b09\d{2}[-\s]?\d{3}[-\s]?\d{3}\b/g,
  },
  {
    type: 'email',
    pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
  },
  {
    type: 'taiwanNationalId',
    pattern: /\b[A-Z][12]\d{8}\b/g,
  },
]

function serializeForInspection(value) {
  if (typeof value === 'string') return value

  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

/**
 * Return high-risk identifiers found in an LLM payload without returning the
 * matched values, so error paths do not echo potential PII into logs.
 *
 * @param {unknown} value
 * @returns {{ type: string }[]}
 */
export function findHighRiskPii(value) {
  const input = serializeForInspection(value)
  const findings = []

  for (const { type, pattern } of HIGH_RISK_PATTERNS) {
    pattern.lastIndex = 0
    if (pattern.test(input)) findings.push({ type })
  }

  return findings
}

/**
 * Stop a network-bound LLM call when obvious direct identifiers are present.
 *
 * @param {unknown} value
 * @returns {void}
 */
export function assertSafeForLlm(value) {
  const findings = findHighRiskPii(value)
  if (findings.length === 0) return

  const types = findings.map(({ type }) => type).join(', ')
  throw new Error(
    `Potential PII detected (${types}). Remove or replace direct identifiers with opaque codes before calling an LLM.`
  )
}
