#!/usr/bin/env node

/**
 * LINE Slash-Command Demo — Moosie EduOps AI Kit
 *
 * Three commands only:
 *   /summary <json>  — Generate parent weekly summary
 *   /risk <text>     — Check a message for privacy/communication risks
 *   /task <json>     — Extract action items from teacher notes
 *
 * Setup:
 *   1. Set LINE_CHANNEL_ACCESS_TOKEN and LINE_CHANNEL_SECRET in .env
 *   2. Set webhook URL in LINE Developers Console to https://your-domain/webhook
 *   3. npm run line:slash-demo
 */

import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { verifyLineSignature } from "../../src/adapters/line-signature.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const PORT = process.env.PORT || 3000;
const DEFAULT_REQUEST_TIMEOUT_MS = 8_000;

function loadPrompt(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isProcessableEvent(event) {
  return isRecord(event)
    && event.type === "message"
    && isRecord(event.message)
    && event.message.type === "text"
    && typeof event.message.text === "string"
    && typeof event.replyToken === "string"
    && event.replyToken.trim().length > 0;
}

async function ask(systemPrompt, userPayload, deps) {
  const response = await deps.fetchImpl("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${deps.openAiApiKey}`,
    },
    body: JSON.stringify({
      model: deps.model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: typeof userPayload === "string" ? userPayload : JSON.stringify(userPayload) },
      ],
      temperature: 0.3,
    }),
    signal: AbortSignal.timeout(deps.requestTimeoutMs),
  });

  if (!response.ok) {
    const err = await response.text();
    deps.logger.error("OpenAI API error:", err);
    return "⚠️ AI service temporarily unavailable. Please try again.";
  }

  const data = await response.json();
  return data.choices[0].message.content.trim();
}

// ── Command Handlers ──
async function handleSummary(text, deps) {
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
  return await ask(prompt, JSON.stringify(input), deps);
}

async function handleRisk(text, deps) {
  const body = text.replace(/^\/risk\s*/, "").trim();
  if (!body) return "Usage: /risk <draft message to check>\n\nExample:\n/risk Tom did great this week! He will definitely get an A.";

  const prompt = loadPrompt("prompts/parent-message-risk-check.md");
  return await ask(prompt, JSON.stringify({ body }), deps);
}

async function handleTask(text, deps) {
  const body = text.replace(/^\/task\s*/, "").trim();
  if (!body) return "Usage: /task {json with lesson record}\n\nExample:\n/task {\"studentCode\":\"S-001\",\"topic\":\"Past tense\",\"performance\":\"Needs irregular verb practice\",\"followUps\":[\"Send worksheet\"]}";

  let input;
  try {
    input = JSON.parse(body);
  } catch {
    return "⚠️ Invalid JSON. Please send lesson data as JSON after /task.";
  }

  const prompt = loadPrompt("prompts/admin-task-router.md");
  return await ask(prompt, JSON.stringify(input), deps);
}

async function replyToLine(replyToken, text, deps) {
  // LINE has 5000 char limit per message
  const truncated = text.length > 4900 ? text.slice(0, 4900) + "\n...(truncated)" : text;

  await deps.fetchImpl("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${deps.lineChannelAccessToken}`,
    },
    body: JSON.stringify({
      replyToken,
      messages: [{ type: "text", text: truncated }],
    }),
    signal: AbortSignal.timeout(deps.requestTimeoutMs),
  });
}

async function processEvent(event, deps) {
  const text = event.message.text.trim();
  const command = text.match(/^\/\S+/)?.[0];
  let reply;

  try {
    if (command === "/summary") {
      reply = await handleSummary(text, deps);
    } else if (command === "/risk") {
      reply = await handleRisk(text, deps);
    } else if (command === "/task") {
      reply = await handleTask(text, deps);
    } else {
      reply = "🤖 Moosie EduOps Bot\n\nAvailable commands:\n/summary — Generate parent weekly summary\n/risk — Check message for privacy risks\n/task — Extract action items from notes\n\nUnknown commands and other text are not sent to AI.";
    }
  } catch (err) {
    deps.logger.error("Handler error:", err);
    reply = "⚠️ Something went wrong. Please try again.";
  }

  await replyToLine(event.replyToken, reply, deps);
}

export function createApp(options = {}) {
  const deps = {
    openAiApiKey: options.openAiApiKey ?? process.env.OPENAI_API_KEY,
    lineChannelAccessToken: options.lineChannelAccessToken ?? process.env.LINE_CHANNEL_ACCESS_TOKEN,
    lineChannelSecret: options.lineChannelSecret ?? process.env.LINE_CHANNEL_SECRET,
    model: options.model ?? process.env.MODEL ?? "gpt-4o-mini",
    fetchImpl: options.fetchImpl ?? globalThis.fetch,
    logger: options.logger ?? console,
    requestTimeoutMs: Number.isFinite(Number(options.requestTimeoutMs)) && Number(options.requestTimeoutMs) > 0
      ? Number(options.requestTimeoutMs)
      : DEFAULT_REQUEST_TIMEOUT_MS,
  };
  const app = express();

  app.use(express.json({
    strict: false,
    verify: (req, _res, buf) => { req.rawBody = buf; },
  }));

  app.post("/webhook", (req, res) => {
    if (!verifyLineSignature(
      req?.rawBody,
      req?.headers?.["x-line-signature"],
      deps.lineChannelSecret
    )) {
      deps.logger.warn("Invalid signature");
      return res.status(401).end();
    }

    if (!isRecord(req.body) || !Array.isArray(req.body.events)) {
      return res.status(400).json({ error: "Invalid webhook payload" });
    }

    const events = req.body.events.filter(isProcessableEvent);
    res.status(200).end();

    // Acknowledge LINE before doing any work that can wait on an external service.
    // Each event is independent: a failed request must not block sibling events.
    setImmediate(() => {
      for (const event of events) {
        void processEvent(event, deps).catch((err) => {
          deps.logger.error("Event processing error:", err);
        });
      }
    });
  });

  // Health check
  app.get("/", (_req, res) => {
    res.json({ status: "ok", bot: "moosie-eduops", commands: ["/summary", "/risk", "/task"] });
  });

  return app;
}

export const app = createApp();
const isMain = process.argv[1]
  && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (isMain) {
  if (!process.env.OPENAI_API_KEY || !process.env.LINE_CHANNEL_ACCESS_TOKEN || !process.env.LINE_CHANNEL_SECRET) {
    console.error("Missing env vars. Required: OPENAI_API_KEY, LINE_CHANNEL_ACCESS_TOKEN, LINE_CHANNEL_SECRET");
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(`🤖 Moosie LINE Bot running on port ${PORT}`);
    console.log(`   Webhook: http://localhost:${PORT}/webhook`);
  });
}
