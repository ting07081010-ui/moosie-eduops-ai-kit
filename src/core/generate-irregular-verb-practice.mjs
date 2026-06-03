/**
 * Core: Generate irregular-verb practice from a lesson record.
 *
 * Produces a short practice plan for next lesson and parent-supported home review.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { callLLMJson } from "./llm.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROMPT_PATH = path.resolve(__dirname, "../../prompts/irregular-verb-practice.md");

const SYSTEM_PROMPT = fs.readFileSync(PROMPT_PATH, "utf8");

/**
 * Generate an irregular-verb practice plan.
 *
 * @param {object} lessonRecord - Conforms to lesson-record.schema.json
 * @returns {Promise<{ title: string, focusVerbs: string[], activities: object[], parentAction: string, teacherNextStep: string, safetyNote: string }>}
 */
export async function generateIrregularVerbPractice(lessonRecord) {
  return callLLMJson(SYSTEM_PROMPT, JSON.stringify(lessonRecord));
}
