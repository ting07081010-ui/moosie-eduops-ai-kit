/**
 * Core: Pre-send risk gate for parent messages.
 *
 * Every parent message MUST pass through this gate before sending.
 * Returns a verdict: "approve" | "block" | "review"
 *
 * Block conditions:
 *   - privacyRisk === "high"
 *   - overPromising === true
 *   - mentionsOtherStudent === true
 *   - tone === "blaming"
 *
 * Review conditions:
 *   - hasObservableBehavior === false
 *   - hasParentAction === false
 *   - privacyRisk === "low"
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { callLLMJson } from "./llm.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROMPT_PATH = path.resolve(__dirname, "../../prompts/parent-message-risk-check.md");

const SYSTEM_PROMPT = fs.readFileSync(PROMPT_PATH, "utf8");

/**
 * Check a draft parent message for risks.
 *
 * @param {string} draft - The draft parent message text
 * @param {object} lessonRecord - The lesson record that generated this draft
 * @returns {Promise<object>} Risk report with verdict
 */
export async function checkParentMessageRisk(draft, lessonRecord = {}) {
  const input = { draft, lessonRecord };
  const report = await callLLMJson(SYSTEM_PROMPT, JSON.stringify(input));

  // Ensure verdict is computed (don't trust LLM's verdict logic)
  report.verdict = computeVerdict(report);
  report.draft = draft;

  return report;
}

/**
 * Compute verdict from risk report fields.
 * This is deterministic — we don't rely on the LLM for the final decision.
 *
 * @param {object} report
 * @returns {"approve" | "block" | "review"}
 */
export function computeVerdict(report) {
  // Block conditions
  if (report.privacyRisk === "high") return "block";
  if (report.overPromising === true) return "block";
  if (report.mentionsOtherStudent === true) return "block";
  if (report.tone === "blaming") return "block";

  // Review conditions
  if (report.hasObservableBehavior === false) return "review";
  if (report.hasParentAction === false) return "review";
  if (report.privacyRisk === "low") return "review";

  return "approve";
}

/**
 * Quick heuristic check (no LLM call) for obvious issues.
 * Use this as a fast pre-filter before calling the full risk check.
 *
 * @param {string} draft
 * @returns {{ hasIssues: boolean, quickFlags: string[] }}
 */
export function quickRiskCheck(draft) {
  const flags = [];

  // Over-promising keywords
  const promiseWords = ["一定", "保證", "guarantee", "definitely", "will definitely"];
  if (promiseWords.some((w) => draft.includes(w))) {
    flags.push("overPromising");
  }

  // Blaming tone
  const blamingWords = ["很差", "態度有問題", "不認真", "太混", "blame", "lazy"];
  if (blamingWords.some((w) => draft.includes(w))) {
    flags.push("blamingTone");
  }

  // Possible other student mention
  const otherPatterns = ["其他同學", "別的小朋友", "班上同學"];
  if (otherPatterns.some((w) => draft.includes(w))) {
    flags.push("mentionsOther");
  }

  // Vague praise (no observable behavior)
  const vagueOnly = ["表現很好", "很認真", "繼續加油", "很棒", "很乖"];
  const hasOnlyVague = vagueOnly.some((w) => draft.includes(w)) && draft.length < 60;
  if (hasOnlyVague) {
    flags.push("vaguePraise");
  }

  return { hasIssues: flags.length > 0, quickFlags: flags };
}
