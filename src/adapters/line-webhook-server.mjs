/**
 * LINE Webhook Server — Full integration with quick reply handling.
 *
 * Receives LINE webhook events, processes teacher input through the core pipeline,
 * and handles quick reply button actions.
 *
 * Usage:
 *   npm run line:quick-reply
 *   (legacy alias: npm run line)
 *   node src/adapters/line-webhook-server.mjs
 *
 * Environment:
 *   LINE_CHANNEL_ACCESS_TOKEN
 *   LINE_CHANNEL_SECRET
 *   OPENAI_API_KEY
 *   PORT (default: 3000)
 */

import express from "express";
import { pathToFileURL } from "node:url";
import { verifyLineSignature } from "./line-signature.mjs";
import {
  generateLessonRecord,
  generateParentSummary,
  generateIrregularVerbPractice,
  checkParentMessageRisk,
  extractAdminTasks,
  quickRiskCheck,
  validateConfig,
} from "../core/index.mjs";

const app = express();
const PORT = process.env.PORT || 3000;

// Parse JSON and keep raw body for signature verification
app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  })
);

// ── LINE API Helpers ───────────────────────────────────────────

async function replyMessage(replyToken, messages) {
  const res = await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({
      replyToken,
      messages: Array.isArray(messages) ? messages : [messages],
    }),
  });

  if (!res.ok) {
    console.error(`LINE reply failed: ${res.status} ${await res.text()}`);
  }
}

function verifySignature(req) {
  return verifyLineSignature(
    req?.rawBody,
    req?.headers?.["x-line-signature"],
    process.env.LINE_CHANNEL_SECRET
  );
}

// ── Quick Reply Definitions ────────────────────────────────────

const QUICK_REPLIES = [
  { label: "📝 產生家長摘要", action: "generate_summary" },
  { label: "🔒 檢查訊息風險", action: "check_risk" },
  { label: "📋 建立行政任務", action: "extract_tasks" },
  { label: "📖 產生補強練習", action: "generate_practice" },
  { label: "🟡 查看黃燈學生", action: "list_yellow_students" },
];

function buildQuickReply(excludeAction) {
  return {
    items: QUICK_REPLIES.filter((qr) => qr.action !== excludeAction).map(
      (qr) => ({
        type: "action",
        action: {
          type: "message",
          label: qr.label,
          text: qr.action,
        },
      })
    ),
  };
}

// ── In-Memory Store (replace with DB in production) ────────────

// Keep each LINE source's records and risk reports together. Never use a
// global fallback: a source without a valid LINE identity has no data context.
const sessionData = new Map(); // source key → session-specific records and reports

function getSessionKey(event) {
  const source = event?.source || {};
  if (typeof source.userId === "string" && source.userId) return `user:${source.userId}`;
  if (typeof source.groupId === "string" && source.groupId) return `group:${source.groupId}`;
  if (typeof source.roomId === "string" && source.roomId) return `room:${source.roomId}`;
  return null;
}

function getSessionState(sessionKey, create = false) {
  if (!sessionKey) return null;
  if (!sessionData.has(sessionKey) && create) {
    sessionData.set(sessionKey, {
      latestStudentCode: null,
      lessonRecords: new Map(),
      riskReports: new Map(),
    });
  }
  return sessionData.get(sessionKey) || null;
}

function getLastStudentCode(sessionKey) {
  return getSessionState(sessionKey)?.latestStudentCode || null;
}

// ── Action Handlers ────────────────────────────────────────────

/**
 * Handle teacher's natural language input.
 * Full pipeline: input → lesson record → parent summary → risk check → tasks
 */
async function handleTeacherInput(text, sessionKey) {
  if (!sessionKey) throw new Error("Unable to identify LINE source.");
  const session = getSessionState(sessionKey, true);

  // Step 1: Generate lesson record (with schema validation + auto-retry)
  const { data: record, warnings } = await generateLessonRecord(text);
  session.lessonRecords.set(record.studentCode, record);
  session.latestStudentCode = record.studentCode;

  // Step 2: Generate parent summary
  const summary = await generateParentSummary(record);

  // Step 3: Risk check
  const risk = await checkParentMessageRisk(summary, record);
  session.riskReports.set(record.studentCode, risk);

  // Step 4: Extract tasks
  const tasks = await extractAdminTasks(record);

  // Step 5: Format response
  const verdictEmoji = { approve: "✅", block: "🚫", review: "⚠️" };

  let msg = `📝 已建立 ${record.studentCode} 課後紀錄\n\n`;
  msg += `【家長訊息草稿】\n${summary}\n\n`;
  msg += `【風險檢查】\n`;
  msg += `${verdictEmoji[risk.verdict]} ${risk.verdict.toUpperCase()}\n`;
  msg += `privacyRisk: ${risk.privacyRisk} | overPromising: ${risk.overPromising} | tone: ${risk.tone}\n`;

  if (risk.issues?.length > 0) {
    msg += `issues: ${risk.issues.join(", ")}\n`;
  }

  // Tasks
  const teacherTasks = tasks.tasks.filter((t) => t.pool === "teacher_task");
  const adminTasks = tasks.tasks.filter((t) => t.pool === "admin_task");
  const parentActions = tasks.tasks.filter((t) => t.pool === "parent_action");

  if (teacherTasks.length > 0) {
    msg += `\n【老師任務】\n`;
    for (const t of teacherTasks) msg += `• ${t.title}\n`;
  }
  if (adminTasks.length > 0) {
    msg += `\n【行政任務】\n`;
    for (const t of adminTasks) msg += `• ${t.title}\n`;
  }
  if (parentActions.length > 0) {
    msg += `\n【家長任務】\n`;
    for (const t of parentActions) msg += `• ${t.title}\n`;
  }

  // Suggested rewrite if blocked/review
  if (risk.verdict !== "approve" && risk.suggestedRewrite) {
    msg += `\n【建議改寫】\n${risk.suggestedRewrite}\n`;
  }

  return {
    type: "text",
    text: msg.trim(),
    quickReply: buildQuickReply(),
  };
}

/**
 * Handle "generate_summary" quick reply action.
 */
async function handleGenerateSummary(sessionKey, studentCode) {
  const record = getSessionState(sessionKey)?.lessonRecords.get(studentCode);
  if (!record) {
    return {
      type: "text",
      text: `找不到 ${studentCode} 的課後紀錄。請先輸入課後筆記。`,
      quickReply: buildQuickReply("generate_summary"),
    };
  }

  const summary = await generateParentSummary(record);
  return {
    type: "text",
    text: `【家長訊息草稿】\n${summary}`,
    quickReply: buildQuickReply("generate_summary"),
  };
}

/**
 * Handle "check_risk" quick reply action.
 */
async function handleCheckRisk(sessionKey, studentCode) {
  const session = getSessionState(sessionKey);
  const record = session?.lessonRecords.get(studentCode);
  const risk = session?.riskReports.get(studentCode);

  if (!record || !risk) {
    return {
      type: "text",
      text: `找不到 ${studentCode} 的風險檢查結果。請先輸入課後筆記。`,
      quickReply: buildQuickReply("check_risk"),
    };
  }

  const verdictEmoji = { approve: "✅", block: "🚫", review: "⚠️" };
  let msg = `【風險檢查 — ${studentCode}】\n`;
  msg += `${verdictEmoji[risk.verdict]} ${risk.verdict.toUpperCase()}\n`;
  msg += `privacyRisk: ${risk.privacyRisk}\n`;
  msg += `overPromising: ${risk.overPromising}\n`;
  msg += `tone: ${risk.tone}\n`;
  msg += `mentionsOtherStudent: ${risk.mentionsOtherStudent}\n`;

  if (risk.issues?.length > 0) {
    msg += `\nissues:\n`;
    for (const i of risk.issues) msg += `• ${i}\n`;
  }
  if (risk.suggestedRewrite) {
    msg += `\n【建議改寫】\n${risk.suggestedRewrite}`;
  }

  return {
    type: "text",
    text: msg.trim(),
    quickReply: buildQuickReply("check_risk"),
  };
}

/**
 * Handle "extract_tasks" quick reply action.
 */
async function handleExtractTasks(sessionKey, studentCode) {
  const record = getSessionState(sessionKey)?.lessonRecords.get(studentCode);
  if (!record) {
    return {
      type: "text",
      text: `找不到 ${studentCode} 的課後紀錄。請先輸入課後筆記。`,
      quickReply: buildQuickReply("extract_tasks"),
    };
  }

  const tasks = await extractAdminTasks(record);

  let msg = `【任務清單 — ${studentCode}】\n\n`;

  const pools = {
    teacher_task: "老師任務",
    admin_task: "行政任務",
    parent_action: "家長任務",
  };

  for (const [pool, label] of Object.entries(pools)) {
    const poolTasks = tasks.tasks.filter((t) => t.pool === pool);
    if (poolTasks.length > 0) {
      msg += `【${label}】\n`;
      for (const t of poolTasks) {
        msg += `• ${t.title} (${t.priority})\n`;
      }
      msg += "\n";
    }
  }

  return {
    type: "text",
    text: msg.trim(),
    quickReply: buildQuickReply("extract_tasks"),
  };
}

/**
 * Handle "generate_practice" quick reply action.
 */
async function handleGeneratePractice(sessionKey, studentCode) {
  const record = getSessionState(sessionKey)?.lessonRecords.get(studentCode);
  if (!record) {
    return {
      type: "text",
      text: `找不到 ${studentCode} 的課後紀錄。請先輸入課後筆記。`,
      quickReply: buildQuickReply("generate_practice"),
    };
  }

  const practice = await generateIrregularVerbPractice(record);

  let msg = `【補強練習 — ${studentCode}】\n\n`;
  msg += `${practice.title || "Irregular verb retrieval practice"}\n`;
  msg += `Focus：${(practice.focusVerbs || []).join(", ")}\n\n`;

  for (const activity of practice.activities || []) {
    msg += `• ${activity.name}（${activity.minutes} 分鐘）\n`;
    msg += `  ${activity.instructionsZhTw}\n`;
    if (activity.example) msg += `  例：${activity.example}\n`;
  }

  msg += `\n家長 3 分鐘：${practice.parentAction || "請孩子說出今天做過的三件事，先用中文提示，再試著說英文動詞。"}`;
  msg += `\n老師下一步：${practice.teacherNextStep || "下次準備 3 組常見 irregular verbs 做短句練習。"}`;
  if (practice.safetyNote) msg += `\n提醒：${practice.safetyNote}`;

  return {
    type: "text",
    text: msg.trim(),
    quickReply: buildQuickReply("generate_practice"),
  };
}

/**
 * Handle "list_yellow_students" quick reply action.
 */
async function handleListYellowStudents(sessionKey) {
  const yellowStudents = [];
  const records = getSessionState(sessionKey)?.lessonRecords;

  for (const [code, record] of records || []) {
    if (record.retentionSignal === "yellow" || record.retentionSignal === "red") {
      yellowStudents.push({
        code,
        signal: record.retentionSignal,
        topic: record.topic,
        hw: record.homeworkStatus,
      });
    }
  }

  if (yellowStudents.length === 0) {
    return {
      type: "text",
      text: "🟡 目前沒有黃燈或紅燈學生。",
      quickReply: buildQuickReply("list_yellow_students"),
    };
  }

  let msg = "🟡 黃燈/紅燈學生：\n\n";
  for (const s of yellowStudents) {
    const emoji = s.signal === "red" ? "🔴" : "🟡";
    msg += `${emoji} ${s.code} — ${s.topic} (作業: ${s.hw})\n`;
  }

  return {
    type: "text",
    text: msg.trim(),
    quickReply: buildQuickReply("list_yellow_students"),
  };
}

// ── Message Router ─────────────────────────────────────────────

async function handleMessage(event) {
  const { message, replyToken } = event;

  if (message.type !== "text") return;

  const sessionKey = getSessionKey(event);
  if (!sessionKey) {
    return replyMessage(replyToken, {
      type: "text",
      text: "無法識別 LINE 對話來源，請重新傳送訊息。",
      quickReply: buildQuickReply(),
    });
  }

  const text = message.text.trim();

  // Quick reply action routing
  switch (text) {
    case "generate_summary": {
      const lastCode = getLastStudentCode(sessionKey);
      if (lastCode) {
        return replyMessage(replyToken, await handleGenerateSummary(sessionKey, lastCode));
      }
      return replyMessage(replyToken, {
        type: "text",
        text: "請先輸入課後筆記（例如：S-003 今天上 past tense...）",
        quickReply: buildQuickReply(),
      });
    }

    case "check_risk": {
      const lastCode = getLastStudentCode(sessionKey);
      if (lastCode) {
        return replyMessage(replyToken, await handleCheckRisk(sessionKey, lastCode));
      }
      return replyMessage(replyToken, {
        type: "text",
        text: "請先輸入課後筆記。",
        quickReply: buildQuickReply(),
      });
    }

    case "extract_tasks": {
      const lastCode = getLastStudentCode(sessionKey);
      if (lastCode) {
        return replyMessage(replyToken, await handleExtractTasks(sessionKey, lastCode));
      }
      return replyMessage(replyToken, {
        type: "text",
        text: "請先輸入課後筆記。",
        quickReply: buildQuickReply(),
      });
    }

    case "generate_practice": {
      const lastCode = getLastStudentCode(sessionKey);
      if (lastCode) {
        return replyMessage(replyToken, await handleGeneratePractice(sessionKey, lastCode));
      }
      return replyMessage(replyToken, {
        type: "text",
        text: "請先輸入課後筆記。",
        quickReply: buildQuickReply(),
      });
    }

    case "list_yellow_students": {
      return replyMessage(replyToken, await handleListYellowStudents(sessionKey));
    }
  }

  // Slash commands belong to the separate line:slash-demo server; never treat
  // an unsupported slash-prefixed message as a teacher lesson note.
  if (text.startsWith("/")) {
    return replyMessage(replyToken, {
      type: "text",
      text: "這個 LINE bot 不使用斜線指令。請直接輸入課後筆記並使用快速回覆；若要測試 /summary、/risk、/task，請啟動 npm run line:slash-demo。",
      quickReply: buildQuickReply(),
    });
  }

  // Check if this looks like teacher input (contains student code pattern)
  if (/^S-\d{3}\s/.test(text) || text.length > 10) {
    try {
      const response = await handleTeacherInput(text, sessionKey);
      return replyMessage(replyToken, response);
    } catch (err) {
      console.error("handleTeacherInput error:", err);
      return replyMessage(replyToken, {
        type: "text",
        text: `處理錯誤：${err.message}\n請確認輸入格式（例如：S-003 今天上 past tense...）`,
        quickReply: buildQuickReply(),
      });
    }
  }

  // Unknown input
  return replyMessage(replyToken, {
    type: "text",
    text: "請輸入課後筆記，例如：\nS-003 今天上 past tense，口說比上週順，但 irregular verbs 還會混淆。",
    quickReply: buildQuickReply(),
  });
}

// ── Webhook Endpoint ───────────────────────────────────────────

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isValidWebhookEvent(event) {
  if (!isObject(event) || typeof event.type !== "string" || !event.type) {
    return false;
  }

  if (event.type !== "message") return true;
  if (!isObject(event.message) || typeof event.message.type !== "string" || !event.message.type) {
    return false;
  }

  if (event.message.type === "text") {
    return typeof event.message.text === "string" &&
      typeof event.replyToken === "string" &&
      event.replyToken.length > 0;
  }

  return true;
}

const PROCESSING_FAILURE_MESSAGE = "處理這則訊息時發生問題，請稍後再試一次。";

function dispatchWebhookEventSafely(event, {
  processMessage = handleMessage,
  sendReply = replyMessage,
  logError = console.error,
} = {}) {
  return Promise.resolve()
    .then(() => processMessage(event))
    .catch(async (err) => {
      logError("Event handling error:", err);

      if (
        event?.type !== "message" ||
        event?.message?.type !== "text" ||
        typeof event.replyToken !== "string" ||
        event.replyToken.length === 0
      ) {
        return;
      }

      try {
        await sendReply(event.replyToken, {
          type: "text",
          text: PROCESSING_FAILURE_MESSAGE,
        });
      } catch {
        logError("Failed to send generic LINE processing-failure reply");
      }
    });
}

app.post("/webhook", async (req, res) => {
  if (!verifySignature(req)) {
    console.warn("Invalid LINE signature");
    return res.status(401).end();
  }

  if (!isObject(req.body) || !Array.isArray(req.body.events)) {
    console.warn("Invalid LINE webhook body");
    return res.status(400).end();
  }

  const events = req.body.events;
  console.log(`Received ${events.length} event(s)`);

  // Skip malformed items and isolate failures so one event cannot interrupt
  // response handling or leave a rejected promise unobserved.
  for (const event of events) {
    if (!isValidWebhookEvent(event)) {
      console.warn("Skipping malformed LINE webhook event");
      continue;
    }

    if (event.type === "message") {
      void dispatchWebhookEventSafely(event);
    }
  }

  res.status(200).end();
});

// ── Health Check ───────────────────────────────────────────────

function getMissingServiceConfig() {
  const missing = [];
  if (!process.env.LINE_CHANNEL_ACCESS_TOKEN) missing.push("LINE_CHANNEL_ACCESS_TOKEN");
  if (!process.env.LINE_CHANNEL_SECRET) missing.push("LINE_CHANNEL_SECRET");
  for (const name of validateConfig().missing) {
    if (!missing.includes(name)) missing.push(name);
  }
  return missing;
}

app.get("/health", (_req, res) => {
  const missing = getMissingServiceConfig();
  if (missing.length > 0) {
    return res.status(503).json({
      status: "not_ready",
      service: "moosie-line-webhook",
      missing,
    });
  }

  res.json({
    status: "ok",
    service: "moosie-line-webhook",
    records: [...sessionData.values()].reduce(
      (total, session) => total + session.lessonRecords.size,
      0
    ),
  });
});

// ── Start ──────────────────────────────────────────────────────

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const missing = getMissingServiceConfig();
  if (missing.length > 0) {
    console.error(`Missing required LINE service configuration: ${missing.join(", ")}`);
    process.exitCode = 1;
  } else {
    app.listen(PORT, () => {
      console.log(`Moosie LINE webhook server listening on :${PORT}`);
      console.log(`  Quick replies: ${QUICK_REPLIES.map((q) => q.label).join(", ")}`);
    });
  }
}

export {
  app,
  dispatchWebhookEventSafely,
  getSessionKey,
  handleMessage,
  sessionData,
  verifySignature,
};
