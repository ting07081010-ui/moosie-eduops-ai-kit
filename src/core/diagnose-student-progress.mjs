/**
 * Core: Diagnose student progress from multiple lesson records.
 *
 * Analyzes trends across lessons to identify:
 * - Skill progression or regression
 * - Retention risk signals
 * - Recommended interventions
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { callLLMJson } from "./llm.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROMPT_PATH = path.resolve(__dirname, "../../prompts/student-progress-diagnosis.md");

const SYSTEM_PROMPT = fs.readFileSync(PROMPT_PATH, "utf8");

/**
 * Diagnose student progress from multiple lesson records.
 *
 * @param {object[]} records - Array of lesson records for one student
 * @returns {Promise<object>} Progress diagnosis
 */
export async function diagnoseStudentProgress(records) {
  if (!Array.isArray(records) || records.length === 0) {
    throw new Error("At least one lesson record is required for diagnosis");
  }

  const input = {
    studentCode: records[0].studentCode,
    records,
  };

  return callLLMJson(SYSTEM_PROMPT, JSON.stringify(input));
}
