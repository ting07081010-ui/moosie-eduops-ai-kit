import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  getSessionKey,
  handleMessage,
  sessionData,
} from "../src/adapters/line-webhook-server.mjs";

const QUICK_REPLY_ACTIONS = [
  "generate_summary",
  "check_risk",
  "extract_tasks",
  "generate_practice",
  "list_yellow_students",
];

const PRIVATE_CANARIES = [
  "S-041",
  "CANARY_PRIVATE_TOPIC",
  "CANARY_PRIVATE_HOMEWORK",
  "CANARY_PRIVATE_PERFORMANCE",
  "CANARY_PRIVATE_RISK_ISSUE",
  "CANARY_PRIVATE_REWRITE",
];

describe("LINE webhook session data isolation", () => {
  it("does not expose one LINE user's data through any quick-reply route to another user", async () => {
    const originalFetch = globalThis.fetch;
    const replies = [];
    sessionData.clear();

    globalThis.fetch = async (_url, options) => {
      replies.push(JSON.parse(options.body));
      return { ok: true, text: async () => "" };
    };

    try {
      const firstUserKey = getSessionKey({
        source: { type: "user", userId: "synthetic-line-user-a" },
      });
      const secondUserKey = getSessionKey({
        source: { type: "user", userId: "synthetic-line-user-b" },
      });
      const record = {
        studentCode: "S-041",
        topic: "CANARY_PRIVATE_TOPIC",
        homeworkStatus: "CANARY_PRIVATE_HOMEWORK",
        performance: "CANARY_PRIVATE_PERFORMANCE",
        retentionSignal: "yellow",
      };
      const risk = {
        verdict: "block",
        privacyRisk: "high",
        overPromising: false,
        tone: "review",
        mentionsOtherStudent: false,
        issues: ["CANARY_PRIVATE_RISK_ISSUE"],
        suggestedRewrite: "CANARY_PRIVATE_REWRITE",
      };

      sessionData.set(firstUserKey, {
        latestStudentCode: record.studentCode,
        lessonRecords: new Map([[record.studentCode, record]]),
        riskReports: new Map([[record.studentCode, risk]]),
      });

      for (const action of QUICK_REPLY_ACTIONS) {
        await handleMessage({
          source: { type: "user", userId: "synthetic-line-user-b" },
          replyToken: `synthetic-reply-${action}`,
          message: { type: "text", text: action },
        });

        const reply = replies.at(-1);
        assert.equal(reply.replyToken, `synthetic-reply-${action}`);
        assert.equal(reply.messages.length, 1);
        const responseText = reply.messages[0].text;
        for (const canary of PRIVATE_CANARIES) {
          assert.ok(
            !responseText.includes(canary),
            `${action} must not reveal ${canary}; got: ${responseText}`
          );
        }
        if (action === "list_yellow_students") {
          assert.equal(responseText, "🟡 目前沒有黃燈或紅燈學生。");
        } else {
          assert.match(responseText, /請先輸入課後筆記/);
        }
      }

      assert.equal(replies.length, QUICK_REPLY_ACTIONS.length);
      assert.equal(sessionData.has(secondUserKey), false, "a read-only quick reply must not create another user's session");
    } finally {
      globalThis.fetch = originalFetch;
      sessionData.clear();
    }
  });

  it("fails closed when an event has no valid LINE source identity", async () => {
    const originalFetch = globalThis.fetch;
    const replies = [];
    sessionData.clear();
    globalThis.fetch = async (_url, options) => {
      replies.push(JSON.parse(options.body));
      return { ok: true, text: async () => "" };
    };

    try {
      assert.equal(getSessionKey({ source: {} }), null);
      await handleMessage({
        source: {},
        replyToken: "synthetic-reply-no-source",
        message: { type: "text", text: "list_yellow_students" },
      });
      assert.match(replies[0].messages[0].text, /無法識別 LINE 對話來源/);
    } finally {
      globalThis.fetch = originalFetch;
      sessionData.clear();
    }
  });
});
