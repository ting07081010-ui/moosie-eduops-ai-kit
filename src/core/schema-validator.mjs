/**
 * Core: Schema validation for lesson records.
 *
 * Validates against lesson-record.schema.json at runtime.
 * Does NOT use external JSON-schema library — lightweight inline validation.
 */

const REQUIRED_FIELDS = ["studentCode", "date", "topic", "performance"];

const VALID_LESSON_TYPES = ["reading", "speaking", "writing", "grammar", "project", "listening", "vocab"];
const VALID_CEFR = ["Pre-A1", "A1", "A2", "B1", "B2", "C1"];
const VALID_HW_STATUS = ["done", "partial", "missing"];
const VALID_ATTENDANCE = ["present", "absent", "late"];
const VALID_RETENTION = ["green", "yellow", "red"];

/**
 * Validate a lesson record against the schema.
 *
 * @param {object} record
 * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
 */
export function validateLessonRecord(record) {
  const errors = [];
  const warnings = [];

  if (!record || typeof record !== "object") {
    return { valid: false, errors: ["Record must be a non-null object"], warnings };
  }

  // Required fields
  for (const field of REQUIRED_FIELDS) {
    if (!record[field]) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  // studentCode format
  if (record.studentCode && !/^S-\d{3}$/.test(record.studentCode)) {
    errors.push(`Invalid studentCode format: "${record.studentCode}" (expected S-XXX)`);
  }

  // date format
  if (record.date && !/^\d{4}-\d{2}-\d{2}$/.test(record.date)) {
    errors.push(`Invalid date format: "${record.date}" (expected YYYY-MM-DD)`);
  }

  // Enum validations
  if (record.lessonType && !VALID_LESSON_TYPES.includes(record.lessonType)) {
    errors.push(`Invalid lessonType: "${record.lessonType}" (expected one of: ${VALID_LESSON_TYPES.join(", ")})`);
  }

  if (record.cefrTarget && !VALID_CEFR.includes(record.cefrTarget)) {
    errors.push(`Invalid cefrTarget: "${record.cefrTarget}" (expected one of: ${VALID_CEFR.join(", ")})`);
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

  // Skills validation
  if (record.skills) {
    const validSkills = ["speaking", "listening", "reading", "writing", "grammar", "participation"];
    for (const [key, val] of Object.entries(record.skills)) {
      if (!validSkills.includes(key)) {
        warnings.push(`Unknown skill: "${key}"`);
      }
      if (typeof val !== "number" || val < 1 || val > 5) {
        errors.push(`Invalid skill rating for ${key}: ${val} (expected 1-5)`);
      }
    }
  }

  // Moosie field warnings (recommended but not required)
  if (!record.parentAction) {
    warnings.push("Missing parentAction — recommended for Moosie workflow");
  }
  if (!record.teacherNextStep) {
    warnings.push("Missing teacherNextStep — recommended for Moosie workflow");
  }
  if (!record.evidence || record.evidence.length === 0) {
    warnings.push("Missing evidence — recommended for specific observations");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate and throw if invalid (for use in pipelines).
 *
 * @param {object} record
 * @throws {Error} If validation fails
 */
export function assertValidLessonRecord(record) {
  const result = validateLessonRecord(record);
  if (!result.valid) {
    throw new Error(`Invalid lesson record:\n${result.errors.join("\n")}`);
  }
  return result;
}
