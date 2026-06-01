/**
 * Core: Quality Gate — Multi-check pipeline for parent messages.
 *
 * Inspired by Claw-ED's 12-check quality gate.
 * Runs a series of checks on the generated parent message.
 * Returns pass/fail with specific issues for auto-retry feedback.
 */

const AIISMS = [
  "很棒", "非常好", "表現優異", "持續進步", "值得肯定",
  "令人欣慰", "可圈可點", "加油", "繼續努力", "再接再厲",
  "整體而言", "總體來說", "基本上", "相信孩子可以", "期待看到更多",
  "delve", "utilize", "leverage", "furthermore", "moreover",
];

const VAGUE_PHRASES = [
  "表現很好", "很認真", "很乖", "很用心", "態度良好",
  "繼續保持", "需要加強", "有待加強", "還不錯",
];

/**
 * Run all quality checks on a parent message.
 *
 * @param {string} message - The parent message to check
 * @param {object} lessonRecord - The source lesson record
 * @returns {{ pass: boolean, score: number, checks: object[], issues: string[] }}
 */
export function runQualityGate(message, lessonRecord = {}) {
  const checks = [];
  const issues = [];

  // Check 1: No AI-isms
  const aiismCheck = checkNoAiisms(message);
  checks.push(aiismCheck);
  if (!aiismCheck.pass) issues.push(...aiismCheck.issues);

  // Check 2: Has specific observation (not vague)
  const specificityCheck = checkSpecificity(message);
  checks.push(specificityCheck);
  if (!specificityCheck.pass) issues.push(...specificityCheck.issues);

  // Check 3: Has parent action
  const actionCheck = checkParentAction(message);
  checks.push(actionCheck);
  if (!actionCheck.pass) issues.push(...actionCheck.issues);

  // Check 4: Length in range
  const lengthCheck = checkLength(message, 80, 250);
  checks.push(lengthCheck);
  if (!lengthCheck.pass) issues.push(...lengthCheck.issues);

  // Check 5: No other student mention
  const privacyCheck = checkNoOtherStudent(message);
  checks.push(privacyCheck);
  if (!privacyCheck.pass) issues.push(...privacyCheck.issues);

  // Check 6: No over-promising
  const promiseCheck = checkNoOverPromising(message);
  checks.push(promiseCheck);
  if (!promiseCheck.pass) issues.push(...promiseCheck.issues);

  // Check 7: References evidence (if available in lesson record)
  const evidenceCheck = checkReferencesEvidence(message, lessonRecord);
  checks.push(evidenceCheck);
  if (!evidenceCheck.pass) issues.push(...evidenceCheck.issues);

  // Calculate score (0-100)
  const passedChecks = checks.filter((c) => c.pass).length;
  const score = Math.round((passedChecks / checks.length) * 100);

  return {
    pass: score >= 70 && !issues.some((i) => i.includes("CRITICAL")),
    score,
    checks,
    issues,
  };
}

function checkNoAiisms(message) {
  const found = AIISMS.filter((w) => message.includes(w));
  return {
    name: "no_aiisms",
    pass: found.length === 0,
    issues: found.length > 0 ? [`Contains AI-isms: ${found.join(", ")}`] : [],
  };
}

function checkSpecificity(message) {
  const hasVague = VAGUE_PHRASES.some((p) => message.includes(p));
  const hasSpecific = /能|會|已|用了|說出|寫出|完成|混淆/.test(message);
  return {
    name: "specificity",
    pass: hasSpecific && !hasVague,
    issues: hasVague ? ["Contains vague praise without specific evidence"] : [],
  };
}

function checkParentAction(message) {
  const hasAction = /在家|每天|請孩子|分鐘|可以|練習|讀|聽|說|寫/.test(message);
  return {
    name: "parent_action",
    pass: hasAction,
    issues: hasAction ? [] : ["Missing parent action — no concrete home task"],
  };
}

function checkLength(message, min, max) {
  const len = message.length;
  return {
    name: "length",
    pass: len >= min && len <= max,
    issues: len < min ? [`Too short (${len} < ${min})`] : len > max ? [`Too long (${len} > ${max})`] : [],
  };
}

function checkNoOtherStudent(message) {
  const patterns = ["其他同學", "別的小朋友", "班上同學", "其他學生"];
  const found = patterns.some((p) => message.includes(p));
  return {
    name: "no_other_student",
    pass: !found,
    issues: found ? ["CRITICAL: References other students"] : [],
  };
}

function checkNoOverPromising(message) {
  const patterns = ["一定", "保證", "肯定會", "必然", "絕對"];
  const found = patterns.some((p) => message.includes(p));
  return {
    name: "no_over_promising",
    pass: !found,
    issues: found ? ["CRITICAL: Over-promises results"] : [],
  };
}

function checkReferencesEvidence(message, lessonRecord) {
  if (!lessonRecord.evidence || lessonRecord.evidence.length === 0) {
    return { name: "evidence_reference", pass: true, issues: [] };
  }

  // Check if any evidence keywords appear in the message
  const evidenceWords = lessonRecord.evidence
    .join(" ")
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 3);

  const messageLower = message.toLowerCase();
  const hasEvidence = evidenceWords.some((w) => messageLower.includes(w));

  return {
    name: "evidence_reference",
    pass: hasEvidence,
    issues: hasEvidence ? [] : ["Message doesn't reference lesson evidence — may feel generic"],
  };
}
