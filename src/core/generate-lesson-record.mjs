/**
 * Core: Generate structured lesson record from teacher's free-text input.
 *
 * This is the entry point for all teacher input. Accepts messy, abbreviated,
 * informal text and produces a structured lesson record.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { callLLMJson } from "./llm.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROMPT_PATH = path.resolve(__dirname, "../../prompts/teacher-after-class-note.md");

const SYSTEM_PROMPT = fs.readFileSync(PROMPT_PATH, "utf8");

/**
 * Generate a structured lesson record from teacher's free-text input.
 *
 * @param {string} teacherInput - Free-form text from teacher (e.g., "S-003 past tense 口說比上週順")
 * @param {{ date?: string }} opts - Optional overrides
 * @returns {Promise<object>} Lesson record conforming to lesson-record.schema.json
 */
export async function generateLessonRecord(teacherInput, opts = {}) {
  const userMessage = opts.date
    ? `Date override: ${opts.date}\n\nTeacher input:\n${teacherInput}`
    : `Teacher input:\n${teacherInput}`;

  const record = await callLLMJson(SYSTEM_PROMPT, userMessage);

  // Ensure date is set
  if (!record.date) {
    record.date = opts.date || new Date().toISOString().split("T")[0];
  }

  // Ensure studentCode is set
  if (!record.studentCode) {
    record.studentCode = "S-000";
    record.observations = (record.observations || "") + " [⚠️ studentCode not found in input]";
  }

  return record;
}
