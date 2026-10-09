/**
 * Human approval gate for parent-facing messages.
 *
 * A draft starts as "pending". Only an approved draft can produce
 * outgoing text. Approval needs a named approver role and a risk
 * verdict that is not "block". AI never moves a draft to "approved".
 */

const APPROVER_ROLES = ["teacher", "admin"];

// Only objects returned by approveDraft() count as approved.
const approvedDrafts = new WeakSet();

/**
 * @param {string} text
 * @param {{ studentCode?: string, riskVerdict?: "approve"|"review"|"block" }} [meta]
 */
export function createDraft(text, meta = {}) {
  if (typeof text !== "string" || !text.trim()) {
    throw new Error("Draft text is required");
  }
  return Object.freeze({
    status: "pending",
    text,
    studentCode: meta.studentCode,
    riskVerdict: meta.riskVerdict,
    approvedBy: undefined,
    approvedAt: undefined,
  });
}

/**
 * @param {ReturnType<typeof createDraft>} draft
 * @param {{ approvedBy: "teacher"|"admin", text?: string }} approval
 */
export function approveDraft(draft, approval = {}) {
  if (draft?.status !== "pending") {
    throw new Error(`Only a pending draft can be approved (got "${draft?.status}")`);
  }
  if (!APPROVER_ROLES.includes(approval.approvedBy)) {
    throw new Error(`approvedBy must be one of: ${APPROVER_ROLES.join(", ")}`);
  }
  if (draft.riskVerdict === "block") {
    throw new Error("A blocked draft cannot be approved; rewrite it and run the risk check again");
  }
  const approved = Object.freeze({
    ...draft,
    text: approval.text ?? draft.text,
    status: "approved",
    approvedBy: approval.approvedBy,
    approvedAt: new Date().toISOString(),
  });
  approvedDrafts.add(approved);
  return approved;
}

/**
 * Returns the text that may be sent to a parent. Throws unless approved.
 * @param {ReturnType<typeof createDraft>} draft
 */
export function outgoingText(draft) {
  if (!approvedDrafts.has(draft)) {
    throw new Error("Message is not approved by a teacher or admin; it cannot be sent");
  }
  return draft.text;
}
