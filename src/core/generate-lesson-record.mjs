/**
 * Core: Generate structured lesson record from teacher's free-text input.
 *
 * Uses callLLMJsonValidated to enforce schema compliance with auto-retry.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { callLLMJsonValidated } from "./llm.mjs";
import { validateLessonRecord } from "./schema-validator.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROMPT_PATH = path.resolve(__dirname, "../../prompts/teacher-after-class-note.md");

const SYSTEM_PROMPT = fs.readFileSync(PROMPT_PATH, "utf8");

/**
 * Generate a structured lesson record from teacher's free-text input.
 * Validates output against schema and auto-retries on failure.
 *
 * @param {string} teacherInput - Free-form text from teacher
 * @param {{ date?: string }} opts - Optional overrides
 * @returns {Promise<{ data: object, warnings: string[] }>}
 */
export async function generateLessonRecord(teacherInput, opts = {}) {
  const userMessage = opts.date
    ? `Date override: ${opts.date}\n\nTeacher input:\n${teacherInput}`
    : `Teacher input:\n${teacherInput}`;

  const { data, warnings } = await callLLMJsonValidated(
    SYSTEM_PROMPT,
    userMessage,
    validateLessonRecord,
    { maxRetries: 2 }
  );

  // Ensure date is set
  if (!data.date) {
    data.date = opts.date || new Date().toISOString().split("T")[0];
  }

  // Ensure studentCode is set
  if (!data.studentCode) {
    data.studentCode = "S-000";
    warnings.push("studentCode not found in input, defaulted to S-000");
  }

  return { data, warnings };
}
