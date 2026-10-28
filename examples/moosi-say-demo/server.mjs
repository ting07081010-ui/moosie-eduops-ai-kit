#!/usr/bin/env node
/**
 * Offline Moosi Say demo: typed notes become curriculum-bounded drafts;
 * approval is hash-bound and changes local status only. Synthetic audio is
 * normalized locally, then receives a fixed mock transcript (never STT).
 */

import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  MoosiSayError,
  SAMPLE_TRANSCRIPT,
  contentHash,
  createStore,
  renderCardSvg,
  validateStudentRoster,
} from "./lib/moosi-say.mjs";
import {
  defaultTranscriptionProvider,
  normalizeAudio,
  transcribeMock,
} from "./lib/audio.mjs";
import { createAudioAdmissionController } from "./lib/audio-admission.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3107);
const HOST = process.env.HOST || "127.0.0.1";
const unit = JSON.parse(fs.readFileSync(path.join(__dirname, "data/unit5.json"), "utf8"));
const students = validateStudentRoster(
  JSON.parse(fs.readFileSync(path.join(__dirname, "data/students.json"), "utf8"))
);

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
    needsTeacherInput: record.status === "needs_teacher_input",
    review: record.review ?? null,
    demoNote: "示範狀態，不會實際傳送訊息給家長。",
  };
}

function errorStatus(code) {
  if (code === "NOT_FOUND") return 404;
  if (["HASH_MISMATCH", "NOT_PENDING", "BLOCKED", "NEEDS_TEACHER_INPUT"].includes(code)) return 409;
  if (["INPUT_TOO_LARGE", "entity.too.large"].includes(code)) return 413;
  if (code === "DECLARATION_REQUIRED") return 400;
  if (["INVALID_AUDIO", "AUDIO_TOO_LONG", "DECODE_EMPTY"].includes(code)) return 422;
  if (code === "PROCESS_UNAVAILABLE") return 503;
  if (["PROCESS_TIMEOUT", "PROVIDER_TIMEOUT"].includes(code)) return 504;
  if (["WAV_INVALID", "INVALID_CONFIG", "PROCESS_FAILED", "OUTPUT_OVERFLOW", "PROVIDER_FAILED", "PROVIDER_MISSING", "PROVIDER_MALFORMED"].includes(code)) return 500;
  return 400;
}

function publicAudioError(err) {
  const known = err instanceof MoosiSayError;
  const code = known ? err.code : err?.type === "entity.too.large" ? "INPUT_TOO_LARGE"
    : err instanceof SyntaxError && ("body" in err) ? "INVALID_JSON" : "INTERNAL_ERROR";
  const status = code === "INVALID_JSON" ? 400 : known ? errorStatus(code)
    : err?.type === "entity.too.large" ? 413 : 500;
  const messages = {
    INPUT_TOO_LARGE: "音訊超過 2 MiB 限制。",
    INVALID_JSON: "JSON 格式錯誤。",
    EMPTY_AUDIO: "音訊內容不可為空。",
    DECLARATION_REQUIRED: "需聲明 X-Demo-Synthetic:true 與 X-Input-Role:adult-teacher。",
    INVALID_AUDIO: "音訊內容無效；僅接受有效的 Ogg/Opus 音訊。",
    WAV_INVALID: "無法驗證正規化音訊。",
    AUDIO_TOO_LONG: "音訊不可超過 60 秒。",
    DECODE_EMPTY: "解碼後沒有音訊內容。",
    PROCESS_UNAVAILABLE: "本機音訊處理工具不可用。",
    PROCESS_TIMEOUT: "本機音訊處理逾時。",
    PROCESS_FAILED: "本機音訊處理失敗。",
    OUTPUT_OVERFLOW: "本機音訊處理輸出超出限制。",
    PROVIDER_TIMEOUT: "模擬轉寫提供者逾時。",
    PROVIDER_FAILED: "模擬轉寫提供者失敗。",
    PROVIDER_MISSING: "模擬轉寫提供者未設定。",
    PROVIDER_MALFORMED: "模擬轉寫提供者回傳格式無效。",
    INTERNAL_ERROR: "伺服器發生錯誤。",
  };
  return { status, body: { error: { code, message: messages[code] ?? "請求無效。" } } };
}

export function createApp(opts = {}) {
  const transcriptionProvider = opts.transcriptionProvider ?? defaultTranscriptionProvider;
  const audioDeps = opts.audioDeps ?? {};
  const audioAdmission = opts.audioAdmission ?? createAudioAdmissionController();
  const store = opts.store ?? createStore();
  const roster = opts.students === undefined ? students : validateStudentRoster(opts.students);
  const app = express();

  // The voice endpoint gates Content-Type/declarations before any body parser.
  app.use(express.json({
    limit: "50kb",
    type: (req) => !/^\/api\/voice\/transcribe\/?$/i.test(req.path) && Boolean(req.is("application/json")),
  }));
  app.use(express.static(path.join(__dirname, "public")));

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
      students: roster.map(({ studentCode, nickname, level, unit: studentUnit, weakWords }) => ({
        studentCode,
        nickname,
        level,
        unit: studentUnit,
        weakWords: Array.isArray(weakWords) ? [...weakWords] : [],
      })),
      sampleTranscript: SAMPLE_TRANSCRIPT,
      notices: [
        "輸入的是打字逐字稿，不是語音辨識。",
        "全部資料都是合成示範資料，沒有真實學生。",
        "核准只會更新本地草稿狀態，不會實際傳送。",
      ],
    });
  });

  app.post("/api/drafts", (req, res, next) => {
    try {
      const { transcript, studentCode } = req.body ?? {};
      res.status(201).json(publicRecord(store.issue({ transcript, studentCode, unit, students: roster })));
    } catch (err) {
      if (err instanceof MoosiSayError) {
        return res.status(errorStatus(err.code)).json({
          error: { code: err.code, message: err.message, details: err.details ?? null },
        });
      }
      next(err);
    }
  });

  app.get("/api/drafts/:id", (req, res, next) => {
    try {
      res.json(publicRecord(store.get(req.params.id)));
    } catch (err) {
      if (err instanceof MoosiSayError) {
        return res.status(errorStatus(err.code)).json({ error: { code: err.code, message: err.message } });
      }
      next(err);
    }
  });

  app.post("/api/drafts/:id/approve", (req, res, next) => {
    try {
      const { contentHash: presentedHash, approvedBy } = req.body ?? {};
      res.json(publicRecord(store.approve(req.params.id, { contentHash: presentedHash, approvedBy })));
    } catch (err) {
      if (err instanceof MoosiSayError) {
        return res.status(errorStatus(err.code)).json({ error: { code: err.code, message: err.message } });
      }
      next(err);
    }
  });

  app.get("/api/drafts/:id/card.svg", (req, res, next) => {
    try {
      const record = store.get(req.params.id);
      if (!record.card) {
        return res.status(409).json({ error: { code: "NEEDS_TEACHER_INPUT", message: "草稿尚缺逐字稿證據，請補充老師觀察後重新產生。" } });
      }
      if (contentHash(record.card) !== record.contentHash) {
        return res.status(409).json({ error: { code: "HASH_MISMATCH", message: "草稿內容與核准雜湊不符，拒絕顯示。" } });
      }
      res.type("image/svg+xml").send(renderCardSvg(record.card, record.contentHash));
    } catch (err) {
      if (err instanceof MoosiSayError) {
        return res.status(errorStatus(err.code)).json({ error: { code: err.code, message: err.message } });
      }
      next(err);
    }
  });

  // Validate declaration and media type before consuming/parsing any audio body.
  app.post("/api/voice/transcribe", (req, res, next) => {
    const contentType = (req.headers["content-type"] ?? "").split(";")[0].trim().toLowerCase();
    if (!["audio/ogg", "application/ogg"].includes(contentType)) {
      return res.status(415).json({ error: { code: "INVALID_AUDIO", message: "僅接受 audio/ogg 或 application/ogg。" } });
    }
    if (req.headers["x-demo-synthetic"] !== "true" || req.headers["x-input-role"] !== "adult-teacher") {
      return res.status(400).json({ error: { code: "DECLARATION_REQUIRED", message: "需聲明 X-Demo-Synthetic:true 與 X-Input-Role:adult-teacher。" } });
    }
    const admission = audioAdmission.acquire();
    if (!admission.accepted) {
      return res.set("Connection", "close").status(503).json({
        error: { code: "AUDIO_CAPACITY_EXCEEDED", message: "音訊處理容量已滿，請稍後重試。" },
      });
    }
    let releasePermit;
    let normalizationStarted = false;
    const releaseOnce = () => releasePermit?.();
    const onAborted = () => {
      if (releasePermit) {
        if (!normalizationStarted) releaseOnce();
      } else {
        admission.cancel();
      }
    };
    req.once("aborted", onAborted);
    admission.ready.then((release) => {
      if (!release) {
        req.off("aborted", onAborted);
        return;
      }
      releasePermit = release;
      if (req.aborted || res.destroyed) {
        releaseOnce();
        req.off("aborted", onAborted);
        return;
      }
      express.raw({ type: ["audio/ogg", "application/ogg"], limit: "2mb" })(req, res, async (parseErr) => {
        if (parseErr) {
          releaseOnce();
          req.off("aborted", onAborted);
          return next(parseErr);
        }
        if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
          releaseOnce();
          req.off("aborted", onAborted);
          return res.status(400).json({ error: { code: "EMPTY_AUDIO", message: "音訊內容不可為空。" } });
        }
        try {
          normalizationStarted = true;
          const { wav, meta } = await normalizeAudio(req.body, {
            synthetic: true,
            role: "adult-teacher",
            ...audioDeps,
          });
          releaseOnce();
          req.off("aborted", onAborted);
          const result = await transcribeMock(wav, meta, transcriptionProvider);
          res.json({
            transcript: result.transcript,
            transcriptionIsMock: true,
            provenance: result.provenance.slice(0, 200),
            sendsMessages: false,
            normalization: {
              sampleRate: meta.sampleRate,
              channels: meta.channels,
              bitsPerSample: meta.bitsPerSample,
              format: "PCM16 WAV",
              durationSec: meta.durationSec,
            },
            warning: "固定模擬逐字稿並非語音辨識；音訊只作本機正規化，請勿上傳真實錄音。",
          });
        } catch (err) {
          releaseOnce();
          req.off("aborted", onAborted);
          next(err);
        }
      });
    }).catch((err) => {
      releaseOnce();
      admission.cancel();
      req.off("aborted", onAborted);
      next(err);
    });
  });

  app.use((err, _req, res, _next) => {
    if (res.headersSent) return;
    const result = publicAudioError(err);
    res.status(result.status).json(result.body);
  });

  return { app, store };
}

// Importing this module is side-effect free: only the direct runner listens.
const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) {
  if (!["127.0.0.1", "::1", "localhost"].includes(HOST)) {
    throw new Error("HOST must be localhost, 127.0.0.1, or ::1.");
  }
  const { app } = createApp();
  app.listen(PORT, HOST, () => {
    console.log(`Moosi 說 offline demo: http://${HOST}:${PORT}`);
    console.log("Demo only: approval updates local status; nothing is sent.");
  });
}
