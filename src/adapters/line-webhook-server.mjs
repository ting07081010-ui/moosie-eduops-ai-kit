/**
 * LINE Webhook Server — Full integration with quick reply handling.
 *
 * Receives LINE webhook events, processes teacher input through the core pipeline,
 * and handles quick reply button actions.
 *
 * Usage:
 *   node src/adapters/line-webhook-server.mjs
 *
 * Environment:
 *   LINE_CHANNEL_ACCESS_TOKEN
 *   LINE_CHANNEL_SECRET
 *   OPENAI_API_KEY
 *   PORT (default: 3000)
 */

import express from "express";
import crypto from "node:crypto";
import {
  generateLessonRecord,
  generateParentSummary,
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
  const secret = process.env.LINE_CHANNEL_SECRET;
  if (!secret) return false;
  const signature = req.headers["x-line-signature"];
  if (!signature) return false;
  const hash = crypto
    .createHmac("sha256", secret)
    .update(req.rawBody)
    .digest("base64");
  return hash === signature;
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

const lessonRecords = new Map(); // studentCode → latest lesson record
const riskReports = new Map(); // studentCode → latest risk report

// ── Action Handlers ────────────────────────────────────────────

/**
 * Handle teacher's natural language input.
 * Full pipeline: input → lesson record → parent summary → risk check → tasks
 */
async function handleTeacherInput(text) {
  // Step 1: Generate lesson record (with schema validation + auto-retry)
  const { data: record, warnings } = await generateLessonRecord(text);
  lessonRecords.set(record.studentCode, record);

  // Step 2: Generate parent summary
  const summary = await generateParentSummary(record);

  // Step 3: Risk check
  const risk = await checkParentMessageRisk(summary, record);
  riskReports.set(record.studentCode, risk);

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
async function handleGenerateSummary(studentCode) {
  const record = lessonRecords.get(studentCode);
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
async function handleCheckRisk(studentCode) {
  const record = lessonRecords.get(studentCode);
  const risk = riskReports.get(studentCode);

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
async function handleExtractTasks(studentCode) {
  const record = lessonRecords.get(studentCode);
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
async function handleGeneratePractice(studentCode) {
  const record = lessonRecords.get(studentCode);
  if (!record) {
    return {
      type: "text",
      text: `找不到 ${studentCode} 的課後紀錄。請先輸入課後筆記。`,
      quickReply: buildQuickReply("generate_practice"),
    };
  }

  // Generate a practice suggestion based on the record
  let msg = `【補強練習 — ${studentCode}】\n\n`;
  msg += `本週主題：${record.topic}\n`;
  msg += `觀察：${record.performance}\n\n`;

  if (record.followUps && record.followUps.length > 0) {
    msg += `建議練習：\n`;
    for (const f of record.followUps) msg += `• ${f}\n`;
  }

  if (record.teacherNextStep) {
    msg += `\n老師下一步：${record.teacherNextStep}`;
  }

  return {
    type: "text",
    text: msg.trim(),
    quickReply: buildQuickReply("generate_practice"),
  };
}

/**
 * Handle "list_yellow_students" quick reply action.
 */
async function handleListYellowStudents() {
  const yellowStudents = [];

  for (const [code, record] of lessonRecords.entries()) {
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

  const text = message.text.trim();

  // Quick reply action routing
  switch (text) {
    case "generate_summary": {
      // Need student code from context — use last active
      const lastCode = [...lessonRecords.keys()].pop();
      if (lastCode) {
        return replyMessage(replyToken, await handleGenerateSummary(lastCode));
      }
      return replyMessage(replyToken, {
        type: "text",
        text: "請先輸入課後筆記（例如：S-003 今天上 past tense...）",
        quickReply: buildQuickReply(),
      });
    }

    case "check_risk": {
      const lastCode = [...lessonRecords.keys()].pop();
      if (lastCode) {
        return replyMessage(replyToken, await handleCheckRisk(lastCode));
      }
      return replyMessage(replyToken, {
        type: "text",
        text: "請先輸入課後筆記。",
        quickReply: buildQuickReply(),
      });
    }

    case "extract_tasks": {
      const lastCode = [...lessonRecords.keys()].pop();
      if (lastCode) {
        return replyMessage(replyToken, await handleExtractTasks(lastCode));
      }
      return replyMessage(replyToken, {
        type: "text",
        text: "請先輸入課後筆記。",
        quickReply: buildQuickReply(),
      });
    }

    case "generate_practice": {
      const lastCode = [...lessonRecords.keys()].pop();
      if (lastCode) {
        return replyMessage(replyToken, await handleGeneratePractice(lastCode));
      }
      return replyMessage(replyToken, {
        type: "text",
        text: "請先輸入課後筆記。",
        quickReply: buildQuickReply(),
      });
    }

    case "list_yellow_students": {
      return replyMessage(replyToken, await handleListYellowStudents());
    }
  }

  // Check if this looks like teacher input (contains student code pattern)
  if (/^S-\d{3}\s/.test(text) || text.length > 10) {
    try {
      const response = await handleTeacherInput(text);
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

app.post("/webhook", async (req, res) => {
  if (!verifySignature(req)) {
    console.warn("Invalid LINE signature");
    return res.status(401).end();
  }

  const events = req.body.events || [];
  console.log(`Received ${events.length} event(s)`);

  // Process events asynchronously
  for (const event of events) {
    if (event.type === "message") {
      handleMessage(event).catch((err) => {
        console.error("Event handling error:", err);
      });
    }
  }

  res.status(200).end();
});

// ── Health Check ───────────────────────────────────────────────

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "moosie-line-webhook",
    records: lessonRecords.size,
  });
});

// ── Start ──────────────────────────────────────────────────────

const cfg = validateConfig();
if (!cfg.ok) {
  console.warn(`⚠️  Missing config: ${cfg.missing.join(", ")}`);
  console.warn("   Some features may not work without OPENAI_API_KEY");
}

app.listen(PORT, () => {
  console.log(`Moosie LINE webhook server listening on :${PORT}`);
  console.log(`  Quick replies: ${QUICK_REPLIES.map((q) => q.label).join(", ")}`);
});
