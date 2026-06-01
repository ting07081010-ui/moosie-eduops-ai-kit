/**
 * Core: Extract admin tasks from a lesson record.
 *
 * Produces three task pools:
 * - Teacher Task: things the teacher needs to do for next lesson
 * - Admin Task: operational tasks for school admin
 * - Parent Action: things the parent can do at home
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { callLLMJson } from "./llm.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROMPT_PATH = path.resolve(__dirname, "../../prompts/admin-task-router.md");

const SYSTEM_PROMPT = fs.readFileSync(PROMPT_PATH, "utf8");

/**
 * Extract tasks from a lesson record, categorized into three pools.
 *
 * @param {object} lessonRecord - Conforms to lesson-record.schema.json
 * @returns {Promise<{ tasks: object[], summary: object }>}
 */
export async function extractAdminTasks(lessonRecord) {
  const result = await callLLMJson(SYSTEM_PROMPT, JSON.stringify(lessonRecord));

  // Ensure summary exists
  if (!result.summary) {
    result.summary = {
      teacher_tasks: result.tasks.filter((t) => t.pool === "teacher_task").length,
      admin_tasks: result.tasks.filter((t) => t.pool === "admin_task").length,
      parent_actions: result.tasks.filter((t) => t.pool === "parent_action").length,
    };
  }

  return result;
}
