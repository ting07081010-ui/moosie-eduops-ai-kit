/**
 * Core: Generate parent-facing summary from a structured lesson record.
 *
 * Produces a 120-200 character zh-TW message that follows Moosie's four constraints:
 * 1. No empty praise
 * 2. Must include one observable behavior
 * 3. Must include one parent action (3-min task)
 * 4. Professional tone (學力管理, not 安親照顧回報)
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { callLLM } from "./llm.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROMPT_PATH = path.resolve(__dirname, "../../prompts/parent-weekly-summary.md");

const SYSTEM_PROMPT = fs.readFileSync(PROMPT_PATH, "utf8");

/**
 * Generate a parent-facing message from a lesson record.
 *
 * @param {object} lessonRecord - Conforms to lesson-record.schema.json
 * @param {{ language?: "zh-TW" | "en" }} opts
 * @returns {Promise<string>} Parent message text
 */
export async function generateParentSummary(lessonRecord, opts = {}) {
  const input = opts.language === "en"
    ? { ...lessonRecord, language: "en" }
    : lessonRecord;

  return callLLM(SYSTEM_PROMPT, JSON.stringify(input));
}
