import { describe, it } from "node:test";
import assert from "node:assert";
import { createDraft, approveDraft, outgoingText } from "../src/core/approval-gate.mjs";

describe("human approval gate", () => {
  it("starts pending and cannot be sent", () => {
    const draft = createDraft("S-001 本週能用過去式說出三句完整句子。");
    assert.equal(draft.status, "pending");
    assert.throws(() => outgoingText(draft), /not approved/);
  });

  it("sends only after a teacher or admin approves", () => {
    const approved = approveDraft(createDraft("draft"), { approvedBy: "teacher" });
    assert.equal(approved.status, "approved");
    assert.equal(outgoingText(approved), "draft");
  });

  it("keeps the teacher's edited text", () => {
    const approved = approveDraft(createDraft("draft"), { approvedBy: "admin", text: "edited" });
    assert.equal(outgoingText(approved), "edited");
  });

  it("rejects a missing or AI approver", () => {
    assert.throws(() => approveDraft(createDraft("d"), {}), /approvedBy/);
    assert.throws(() => approveDraft(createDraft("d"), { approvedBy: "ai" }), /approvedBy/);
  });

  it("cannot approve a draft the risk check blocked", () => {
    const draft = createDraft("Tom did better than Amy", { riskVerdict: "block" });
    assert.throws(() => approveDraft(draft, { approvedBy: "teacher" }), /blocked/);
  });

  it("cannot be bypassed by mutating or forging the draft", () => {
    const draft = createDraft("d");
    assert.throws(() => { "use strict"; draft.status = "approved"; }, TypeError);
    assert.throws(() => outgoingText({ status: "approved", text: "x" }), /not approved/);
    assert.throws(() => outgoingText({ ...draft, status: "approved", approvedBy: "teacher" }), /not approved/);
  });

  it("cannot be approved twice", () => {
    const approved = approveDraft(createDraft("d"), { approvedBy: "teacher" });
    assert.throws(() => approveDraft(approved, { approvedBy: "teacher" }), /pending/);
  });
});
