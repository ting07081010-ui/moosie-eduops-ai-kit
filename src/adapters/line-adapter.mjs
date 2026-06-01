/**
 * LINE Adapter — Connects LINE webhook events to core functions.
 *
 * Handles:
 * - Natural language teacher input → lesson record
 * - Quick reply buttons (5 actions)
 * - Risk gate before sending to parent
 *
 * This adapter does NOT contain business logic — it delegates to src/core/.
 */

import {
  generateLessonRecord,
  generateParentSummary,
  checkParentMessageRisk,
  extractAdminTasks,
  quickRiskCheck,
  runQualityGate,
} from "../core/index.mjs";

/**
 * LINE quick reply action definitions.
 */
export const QUICK_REPLIES = [
  { label: "📝 產生家長摘要", action: "generate_summary" },
  { label: "🔒 檢查訊息風險", action: "check_risk" },
  { label: "📋 建立行政任務", action: "extract_tasks" },
  { label: "📖 產生補強練習", action: "generate_practice" },
  { label: "🟡 查看黃燈學生", action: "list_yellow_students" },
];

/**
 * Process a teacher's natural language input from LINE.
 *
 * Full pipeline:
 * 1. Parse teacher input → lesson record
 * 2. Generate parent summary
 * 3. Run risk check
 * 4. Extract tasks
 * 5. Return formatted response with quick reply buttons
 *
 * @param {string} teacherText - Free-form text from teacher via LINE
 * @returns {Promise<object>} Formatted response for LINE
 */
export async function handleTeacherInput(teacherText) {
  // Step 1: Generate lesson record (with schema validation + auto-retry)
  const { data: lessonRecord, warnings } = await generateLessonRecord(teacherText);

  // Step 2: Generate parent summary
  const parentSummary = await generateParentSummary(lessonRecord);

  // Step 3: Quality gate (multi-check)
  const qualityResult = runQualityGate(parentSummary, lessonRecord);

  // Step 4: Risk check (LLM-based)
  const riskReport = await checkParentMessageRisk(parentSummary, lessonRecord);

  // Step 5: Extract tasks
  const tasks = await extractAdminTasks(lessonRecord);

  // Step 5: Format response
  return formatLineResponse({
    lessonRecord,
    parentSummary,
    riskReport,
    tasks,
  });
}

/**
 * Format the pipeline output for LINE display.
 *
 * @param {object} data
 * @returns {object} LINE message object
 */
function formatLineResponse({ lessonRecord, parentSummary, riskReport, tasks }) {
  const verdictEmoji = {
    approve: "✅",
    block: "🚫",
    review: "⚠️",
  };

  let text = "";

  // Parent summary
  text += `【家長訊息草稿】\n${parentSummary}\n\n`;

  // Risk check
  text += `【風險檢查】\n`;
  text += `${verdictEmoji[riskReport.verdict]} ${riskReport.verdict.toUpperCase()}\n`;
  text += `privacyRisk: ${riskReport.privacyRisk}\n`;
  text += `overPromising: ${riskReport.overPromising}\n`;
  text += `tone: ${riskReport.tone}\n`;

  if (riskReport.issues && riskReport.issues.length > 0) {
    text += `issues: ${riskReport.issues.join(", ")}\n`;
  }

  // Tasks by pool
  const teacherTasks = tasks.tasks.filter((t) => t.pool === "teacher_task");
  const adminTasks = tasks.tasks.filter((t) => t.pool === "admin_task");
  const parentActions = tasks.tasks.filter((t) => t.pool === "parent_action");

  if (teacherTasks.length > 0) {
    text += `\n【老師任務】\n`;
    for (const t of teacherTasks) text += `• ${t.title}\n`;
  }

  if (adminTasks.length > 0) {
    text += `\n【行政任務】\n`;
    for (const t of adminTasks) text += `• ${t.title}\n`;
  }

  if (parentActions.length > 0) {
    text += `\n【家長任務】\n`;
    for (const t of parentActions) text += `• ${t.title}\n`;
  }

  // Suggested rewrite if blocked/review
  if (riskReport.verdict !== "approve" && riskReport.suggestedRewrite) {
    text += `\n【建議改寫】\n${riskReport.suggestedRewrite}\n`;
  }

  return {
    type: "text",
    text: text.trim(),
    quickReply: {
      items: QUICK_REPLIES.map((qr) => ({
        type: "action",
        action: { type: "message", label: qr.label, text: qr.action },
      })),
    },
  };
}
