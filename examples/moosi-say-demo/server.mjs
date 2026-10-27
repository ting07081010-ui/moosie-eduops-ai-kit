#!/usr/bin/env node
/**
 * Moosi Say offline demo server.
 *
 * Local Express UI: typed transcript -> curriculum-bounded draft preview ->
 * explicit hash-bound approval. Fully offline: no WhatsApp calls, no model
 * APIs, no audio ingestion, no image generation. Approval updates a local
 * draft status only; the server never sends anything to a parent.
 */

import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  MoosiSayError,
  SAMPLE_TRANSCRIPT,
  contentHash,
  createStore,
  renderCardSvg,
} from "./lib/moosi-say.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3107);
// Localhost only: this offline demo must never listen on all network interfaces.
const HOST = process.env.HOST || "127.0.0.1";

const unit = JSON.parse(
  fs.readFileSync(path.join(__dirname, "data/unit5.json"), "utf8")
);
const students = JSON.parse(
  fs.readFileSync(path.join(__dirname, "data/students.json"), "utf8")
);

const store = createStore();
const app = express();
app.use(express.json({ limit: "50kb" }));
app.use(express.static(path.join(__dirname, "public")));

function publicRecord(record) {
  return {
    id: record.id,
    status: record.status,
    card: record.card,
    contentHash: record.contentHash,
    approvedBy: record.approvedBy,
    approvedAt: record.approvedAt,
    sent: record.sent ?? false,
    sendsMessages: false,
    demoNote: "示範狀態，不會實際傳送訊息給家長。",
  };
}

function errorStatus(code) {
  if (code === "NOT_FOUND") return 404;
  if (code === "HASH_MISMATCH" || code === "NOT_PENDING" || code === "BLOCKED")
    return 409;
  return 400;
}

app.get("/health", (_req, res) => {
  res.json({ status: "ok", demo: "moosi-say", sendsMessages: false });
});

app.get("/api/context", (_req, res) => {
  res.json({
    unit: {
      title: unit.title,
      topic: unit.topic,
      topicLabel: unit.topicLabel,
      words: unit.words,
      sentencePatterns: unit.sentencePatterns,
    },
    students: students.map(({ studentCode, nickname, level, unit: u }) => ({
      studentCode,
      nickname,
      level,
      unit: u,
    })),
    sampleTranscript: SAMPLE_TRANSCRIPT,
    notices: [
      "輸入的是打字逐字稿，不是語音辨識。",
      "全部資料都是合成示範資料，沒有真實學生。",
      "核准只會更新本地草稿狀態，不會實際傳送。",
    ],
  });
});

app.post("/api/drafts", (req, res) => {
  try {
    const { transcript, studentCode } = req.body ?? {};
    const record = store.issue({ transcript, studentCode, unit, students });
    res.status(201).json(publicRecord(record));
  } catch (err) {
    if (err instanceof MoosiSayError) {
      return res
        .status(errorStatus(err.code))
        .json({ error: { code: err.code, message: err.message, details: err.details ?? null } });
    }
    throw err;
  }
});

app.get("/api/drafts/:id", (req, res) => {
  try {
    res.json(publicRecord(store.get(req.params.id)));
  } catch (err) {
    if (err instanceof MoosiSayError) {
      return res
        .status(errorStatus(err.code))
        .json({ error: { code: err.code, message: err.message } });
    }
    throw err;
  }
});

app.post("/api/drafts/:id/approve", (req, res) => {
  try {
    const { contentHash: presentedHash, approvedBy } = req.body ?? {};
    const record = store.approve(req.params.id, {
      contentHash: presentedHash,
      approvedBy,
    });
    res.json(publicRecord(record));
  } catch (err) {
    if (err instanceof MoosiSayError) {
      return res
        .status(errorStatus(err.code))
        .json({ error: { code: err.code, message: err.message } });
    }
    throw err;
  }
});

app.get("/api/drafts/:id/card.svg", (req, res) => {
  try {
    const record = store.get(req.params.id);
    const expected = contentHash(record.card);
    if (expected !== record.contentHash) {
      return res.status(409).json({
        error: {
          code: "HASH_MISMATCH",
          message: "草稿內容與核准雜湊不符，拒絕顯示。",
        },
      });
    }
    res.type("image/svg+xml").send(renderCardSvg(record.card, record.contentHash));
  } catch (err) {
    if (err instanceof MoosiSayError) {
      return res
        .status(errorStatus(err.code))
        .json({ error: { code: err.code, message: err.message } });
    }
    throw err;
  }
});

app.listen(PORT, HOST, () => {
  console.log(`Moosi 說 offline demo: http://${HOST}:${PORT}`);
  console.log("Demo only: approval updates local status, nothing is sent.");
});
