#!/usr/bin/env node

/**
 * LINE Bot Demo — Moosie EduOps AI Kit
 *
 * Three commands only:
 *   /summary <json>  — Generate parent weekly summary
 *   /risk <text>     — Check a message for privacy/communication risks
 *   /task <json>     — Extract action items from teacher notes
 *
 * Setup:
 *   1. Set LINE_CHANNEL_ACCESS_TOKEN and LINE_CHANNEL_SECRET in .env
 *   2. Set webhook URL in LINE Developers Console to https://your-domain/webhook
 *   3. npm run line
 */

import express from "express";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");

const PORT = process.env.PORT || 3000;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const LINE_CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;
const LINE_CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET;
const MODEL = process.env.MODEL || "gpt-4o-mini";

if (!OPENAI_API_KEY || !LINE_CHANNEL_ACCESS_TOKEN || !LINE_CHANNEL_SECRET) {
  console.error("Missing env vars. Required: OPENAI_API_KEY, LINE_CHANNEL_ACCESS_TOKEN, LINE_CHANNEL_SECRET");
  process.exit(1);
}

// ── Helpers ──
function loadPrompt(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

async function ask(systemPrompt, userPayload) {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: typeof userPayload === "string" ? userPayload : JSON.stringify(userPayload) },
      ],
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    console.error("OpenAI API error:", err);
    return "⚠️ AI service temporarily unavailable. Please try again.";
  }

  const data = await response.json();
  return data.choices[0].message.content.trim();
}

// ── Command Handlers ──
async function handleSummary(text) {
  // Parse input after /summary
  const body = text.replace(/^\/summary\s*/, "").trim();
  if (!body) return "Usage: /summary {json with lesson record}\n\nExample:\n/summary {\"studentCode\":\"S-001\",\"date\":\"2026-05-30\",\"topic\":\"Past tense\",\"performance\":\"Good progress\"}";

  let input;
  try {
    input = JSON.parse(body);
  } catch {
    return "⚠️ Invalid JSON. Please send lesson data as JSON after /summary.";
  }

  const prompt = loadPrompt("prompts/parent-weekly-summary.md");
  return await ask(prompt, JSON.stringify(input));
}

async function handleRisk(text) {
  const body = text.replace(/^\/risk\s*/, "").trim();
  if (!body) return "Usage: /risk <draft message to check>\n\nExample:\n/risk Tom did great this week! He will definitely get an A.";

  const prompt = loadPrompt("prompts/parent-message-risk-check.md");
  return await ask(prompt, JSON.stringify({ body }));
}

async function handleTask(text) {
  const body = text.replace(/^\/task\s*/, "").trim();
  if (!body) return "Usage: /task {json with lesson record}\n\nExample:\n/task {\"studentCode\":\"S-001\",\"topic\":\"Past tense\",\"performance\":\"Needs irregular verb practice\",\"followUps\":[\"Send worksheet\"]}";

  let input;
  try {
    input = JSON.parse(body);
  } catch {
    return "⚠️ Invalid JSON. Please send lesson data as JSON after /task.";
  }

  const prompt = loadPrompt("prompts/admin-task-router.md");
  return await ask(prompt, JSON.stringify(input));
}

// ── LINE API ──
function verifySignature(req) {
  const sig = crypto
    .createHmac("sha256", LINE_CHANNEL_SECRET)
    .update(req.rawBody)
    .digest("base64");
  return sig === req.headers["x-line-signature"];
}

async function replyToLine(replyToken, text) {
  // LINE has 5000 char limit per message
  const truncated = text.length > 4900 ? text.slice(0, 4900) + "\n...(truncated)" : text;

  await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({
      replyToken,
      messages: [{ type: "text", text: truncated }],
    }),
  });
}

// ── Express App ──
const app = express();
app.use(express.json({
  verify: (req, _res, buf) => { req.rawBody = buf; },
}));

app.post("/webhook", async (req, res) => {
  if (!verifySignature(req)) {
    console.warn("Invalid signature");
    return res.status(401).end();
  }

  for (const event of req.body.events || []) {
    if (event.type !== "message" || event.message.type !== "text") continue;

    const text = event.message.text.trim();
    let reply;

    try {
      if (text.startsWith("/summary")) {
        reply = await handleSummary(text);
      } else if (text.startsWith("/risk")) {
        reply = await handleRisk(text);
      } else if (text.startsWith("/task")) {
        reply = await handleTask(text);
      } else {
        reply = "🤖 Moosie EduOps Bot\n\nAvailable commands:\n/summary — Generate parent weekly summary\n/risk — Check message for privacy risks\n/task — Extract action items from notes";
      }
    } catch (err) {
      console.error("Handler error:", err);
      reply = "⚠️ Something went wrong. Please try again.";
    }

    await replyToLine(event.replyToken, reply);
  }

  res.status(200).end();
});

// Health check
app.get("/", (_req, res) => {
  res.json({ status: "ok", bot: "moosie-eduops", commands: ["/summary", "/risk", "/task"] });
});

app.listen(PORT, () => {
  console.log(`🤖 Moosie LINE Bot running on port ${PORT}`);
  console.log(`   Webhook: http://localhost:${PORT}/webhook`);
});
