/**
 * Core: Schema validation for lesson records, parent messages, and tasks.
 *
 * Lightweight inline validation — no external JSON-schema library needed.
 */

// ── Lesson Record ──────────────────────────────────────────────

const LESSON_REQUIRED = ["studentCode", "date", "topic", "performance"];
const VALID_LESSON_TYPES = ["reading", "speaking", "writing", "grammar", "project", "listening", "vocab"];
const VALID_CEFR = ["Pre-A1", "A1", "A2", "B1", "B2", "C1"];
const VALID_HW_STATUS = ["done", "partial", "missing"];
const VALID_ATTENDANCE = ["present", "absent", "late"];
const VALID_RETENTION = ["green", "yellow", "red"];
const VALID_SKILLS = ["speaking", "listening", "reading", "writing", "grammar", "participation", "confidence"];

/**
 * Validate a lesson record.
 * @param {object} record
 * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
 */
export function validateLessonRecord(record) {
  const errors = [];
  const warnings = [];

  if (!record || typeof record !== "object") {
    return { valid: false, errors: ["Record must be a non-null object"], warnings };
  }

  for (const field of LESSON_REQUIRED) {
    if (!record[field]) errors.push(`Missing required field: ${field}`);
  }

  if (record.studentCode && !/^S-\d{3}$/.test(record.studentCode)) {
    errors.push(`Invalid studentCode format: "${record.studentCode}" (expected S-XXX)`);
  }
  if (record.teacherCode && !/^T-\d{3}$/.test(record.teacherCode)) {
    errors.push(`Invalid teacherCode format: "${record.teacherCode}" (expected T-XXX)`);
  }
  if (record.date && !/^\d{4}-\d{2}-\d{2}$/.test(record.date)) {
    errors.push(`Invalid date format: "${record.date}" (expected YYYY-MM-DD)`);
  }
  if (record.lessonType && !VALID_LESSON_TYPES.includes(record.lessonType)) {
    errors.push(`Invalid lessonType: "${record.lessonType}"`);
  }
  if (record.cefrTarget && !VALID_CEFR.includes(record.cefrTarget)) {
    errors.push(`Invalid cefrTarget: "${record.cefrTarget}"`);
  }
  if (record.homeworkStatus && !VALID_HW_STATUS.includes(record.homeworkStatus)) {
    errors.push(`Invalid homeworkStatus: "${record.homeworkStatus}"`);
  }
  if (record.attendance && !VALID_ATTENDANCE.includes(record.attendance)) {
    errors.push(`Invalid attendance: "${record.attendance}"`);
  }
  if (record.retentionSignal && !VALID_RETENTION.includes(record.retentionSignal)) {
    errors.push(`Invalid retentionSignal: "${record.retentionSignal}"`);
  }

  if (record.skills) {
    for (const [key, val] of Object.entries(record.skills)) {
      if (!VALID_SKILLS.includes(key)) warnings.push(`Unknown skill: "${key}"`);
      if (typeof val !== "number" || val < 1 || val > 5) {
        errors.push(`Invalid skill rating for ${key}: ${val} (expected 1-5)`);
      }
    }
  }

  // Moosie recommended fields
  if (!record.parentAction) warnings.push("Missing parentAction — recommended for Moosie workflow");
  if (!record.teacherNextStep) warnings.push("Missing teacherNextStep — recommended for Moosie workflow");
  if (!record.evidence || record.evidence.length === 0) warnings.push("Missing evidence — recommended for specific observations");
  if (!record.learningObjective) warnings.push("Missing learningObjective — recommended for goal tracking");

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Validate and throw if invalid.
 */
export function assertValidLessonRecord(record) {
  const result = validateLessonRecord(record);
  if (!result.valid) throw new Error(`Invalid lesson record:\n${result.errors.join("\n")}`);
  return result;
}

// ── Parent Message ─────────────────────────────────────────────

const PARENT_REQUIRED = ["studentCode", "body"];
const VALID_CHANNELS = ["line", "email"];
const VALID_MSG_TYPES = ["weekly_summary", "homework_reminder", "absence_followup", "progress_alert", "renewal_support"];
const VALID_RISK_STATUS = ["unchecked", "safe", "needs_review", "blocked"];
const VALID_APPROVERS = ["teacher", "admin"];

/**
 * Validate a parent message.
 * @param {object} msg
 * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
 */
export function validateParentMessage(msg) {
  const errors = [];
  const warnings = [];

  if (!msg || typeof msg !== "object") {
    return { valid: false, errors: ["Message must be a non-null object"], warnings };
  }

  for (const field of PARENT_REQUIRED) {
    if (!msg[field]) errors.push(`Missing required field: ${field}`);
  }

  if (msg.body && msg.body.length > 400) errors.push(`Body exceeds 400 chars (${msg.body.length})`);
  if (msg.channel && !VALID_CHANNELS.includes(msg.channel)) errors.push(`Invalid channel: "${msg.channel}"`);
  if (msg.messageType && !VALID_MSG_TYPES.includes(msg.messageType)) errors.push(`Invalid messageType: "${msg.messageType}"`);
  if (msg.riskStatus && !VALID_RISK_STATUS.includes(msg.riskStatus)) errors.push(`Invalid riskStatus: "${msg.riskStatus}"`);
  if (msg.approvedBy && !VALID_APPROVERS.includes(msg.approvedBy)) errors.push(`Invalid approvedBy: "${msg.approvedBy}"`);

  // Safety warnings
  if (!msg.riskStatus || msg.riskStatus === "unchecked") warnings.push("riskStatus should be checked before sending");
  if (!msg.approvedBy) warnings.push("approvedBy should be set before sending");
  if (!msg.messageType) warnings.push("messageType recommended for tracking");

  return { valid: errors.length === 0, errors, warnings };
}

// ── Task ───────────────────────────────────────────────────────

const VALID_OWNERS = ["teacher", "admin", "parent"];
const VALID_POOLS = ["teacher_task", "admin_task", "parent_action"];
const VALID_TASK_STATUS = ["open", "done", "dismissed"];
const VALID_CREATORS = ["ai", "teacher", "admin"];

/**
 * Validate a task.
 * @param {object} task
 * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
 */
export function validateTask(task) {
  const errors = [];
  const warnings = [];

  if (!task || typeof task !== "object") {
    return { valid: false, errors: ["Task must be a non-null object"], warnings };
  }

  if (!task.title) errors.push("Missing required field: title");
  if (task.owner && !VALID_OWNERS.includes(task.owner)) errors.push(`Invalid owner: "${task.owner}"`);
  if (task.pool && !VALID_POOLS.includes(task.pool)) errors.push(`Invalid pool: "${task.pool}"`);
  if (task.status && !VALID_TASK_STATUS.includes(task.status)) errors.push(`Invalid status: "${task.status}"`);
  if (task.createdBy && !VALID_CREATORS.includes(task.createdBy)) errors.push(`Invalid createdBy: "${task.createdBy}"`);
  if (task.studentCode && !/^S-\d{3}$/.test(task.studentCode)) errors.push(`Invalid studentCode: "${task.studentCode}"`);
  if (task.teacherCode && !/^T-\d{3}$/.test(task.teacherCode)) errors.push(`Invalid teacherCode: "${task.teacherCode}"`);

  // Recommendations
  if (!task.status) warnings.push("status recommended (default to 'open')");
  if (!task.createdBy) warnings.push("createdBy recommended for audit trail");
  if (!task.pool) warnings.push("pool recommended for task categorization");

  return { valid: errors.length === 0, errors, warnings };
}
