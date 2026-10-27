/**
 * Moosi Say offline demo core — deterministic, rule-based card drafting.
 *
 * What this is: a first safe vertical slice. A teacher's already-transcribed
 * (typed) note is turned into a curriculum-bounded learning card draft using
 * fixed templates — not AI generation, not speech recognition, no network.
 * Approval only flips a local draft status and is bound to the exact card
 * content hash. Nothing is ever sent to a parent in this demo.
 *
 * Fail-closed rules:
 * - Every English word in the transcript must be allowlisted (unit words,
 *   sentence-pattern words, or a tiny explicit extras set). Anything else is
 *   rejected as out-of-scope instead of being silently allowed.
 * - The card must contain every unit word with transcript evidence; a word
 *   with no evidence blocks the draft instead of being invented.
 * - Approval requires the exact current content hash; missing or mismatched
 *   hashes, blocked drafts, and re-approval are all rejected.
 */

import crypto from "node:crypto";

export class MoosiSayError extends Error {
  /**
   * @param {string} code machine-readable failure code
   * @param {string} message teacher-readable explanation
   * @param {unknown} [details] extra context (e.g. offending words)
   */
  constructor(code, message, details) {
    super(message);
    this.name = "MoosiSayError";
    this.code = code;
    this.details = details;
  }
}

/** Sample classroom note. Typed transcript for demo input — not speech recognition. */
export const SAMPLE_TRANSCRIPT = [
  "S-007 在 Unit 5 水果課上能說出 apple 和 banana，grapes 的字首 g 還需要多練習。",
  "請媽媽在家陪 S-007 玩買水果遊戲，練習說 I want some grapes, please。",
].join("\n");

/** English tokens that may appear in a transcript without being vocabulary. */
const TRANSCRIPT_EXTRA_TOKENS = new Set(["unit", "s", "t", "g"]);

/** Approver roles. AI is never an approver. */
const APPROVER_ROLES = ["teacher", "admin"];

/**
 * Split a transcript into labelled segments for evidence references.
 * @param {string} transcript
 */
export function segmentTranscript(transcript) {
  const parts = String(transcript)
    .split(/\r?\n|。|！|？|!|\?/)
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.map((text, i) => ({
    id: `T-${String(i + 1).padStart(2, "0")}`,
    text,
  }));
}

/**
 * Extract lowercase English tokens from text.
 * @param {string} text
 */
export function englishTokens(text) {
  return (String(text).match(/[A-Za-z]+/g) || []).map((w) => w.toLowerCase());
}

/**
 * Full allowlist for transcript English: unit words + sentence-pattern words
 * (with the {fruit} slot removed) + explicit extras.
 */
export function allowedTranscriptTokens(unit) {
  const allowed = new Set(unit.words.map((w) => w.toLowerCase()));
  for (const pattern of unit.sentencePatterns) {
    for (const token of englishTokens(pattern.replace(/\{[^}]*\}/g, " "))) {
      allowed.add(token);
    }
  }
  for (const token of TRANSCRIPT_EXTRA_TOKENS) allowed.add(token);
  return allowed;
}

/**
 * Validate the transcript and return its segments.
 * Throws MoosiSayError(OUT_OF_SCOPE) for non-allowlisted English words.
 */
export function validateTranscript(transcript, unit) {
  if (typeof transcript !== "string" || !transcript.trim()) {
    throw new MoosiSayError("EMPTY_TRANSCRIPT", "請先輸入老師的課後文字紀錄。");
  }
  const segments = segmentTranscript(transcript);
  const allowed = allowedTranscriptTokens(unit);
  const outOfScope = [
    ...new Set(englishTokens(transcript).filter((t) => !allowed.has(t))),
  ].sort();
  if (outOfScope.length > 0) {
    throw new MoosiSayError(
      "OUT_OF_SCOPE",
      `紀錄中有本單元以外的英文單字（${outOfScope.join(", ")}），已退回，不會產生圖卡。`,
      { words: outOfScope }
    );
  }
  return segments;
}

/**
 * Find segment ids whose text matches a predicate.
 */
function evidenceIn(segments, predicate) {
  return segments.filter((s) => predicate(s.text)).map((s) => s.id);
}

function containsWord(text, word) {
  return new RegExp(`\\b${word}\\b`, "i").test(text);
}

/**
 * Build a deterministic card draft from a validated transcript.
 * Rule templates only — this function performs no AI generation.
 * Throws MoosiSayError(MISSING_EVIDENCE) when a required fact has no
 * transcript support, instead of inventing content.
 */
export function generateCard({ transcript, studentCode, unit, students }) {
  if (!/^S-\d{3}$/.test(String(studentCode || ""))) {
    throw new MoosiSayError("INVALID_CODE", "學生代號格式錯誤，應為 S-XXX。");
  }
  const known = (students || []).some((s) => s.studentCode === studentCode);
  if (!known) {
    throw new MoosiSayError(
      "UNKNOWN_STUDENT",
      `找不到學生 ${studentCode}，請從名單中選擇。`
    );
  }

  const segments = validateTranscript(transcript, unit);

  const foundWords = unit.words.filter((w) =>
    segments.some((s) => containsWord(s.text, w))
  );
  const missing = unit.words.filter((w) => !foundWords.includes(w));
  if (missing.length > 0) {
    throw new MoosiSayError(
      "MISSING_EVIDENCE",
      `紀錄中缺少單字依據（${missing.join(", ")}），請補上後再產生圖卡。`,
      { missing }
    );
  }

  // Practice word: prefer a unit word that appears with a practice cue and is
  // not already marked known-good (e.g. inside an explicit 能說出 clause).
  // Clauses split on Chinese commas so "能說出 apple 和 banana，grapes…還需要
  // 多練習" marks apple/banana known-good while grapes stays practice-eligible.
  const cue = /練|加強|還需要|需要多/;
  const KNOWN_GOOD = /能說出|都會|已經會/;
  const clauses = segments.flatMap((s) =>
    s.text
      .split(/[，、。；]/)
      .map((t) => t.trim())
      .filter(Boolean)
  );
  const knownGoodWords = new Set(
    unit.words.filter((w) =>
      clauses.some((c) => KNOWN_GOOD.test(c) && containsWord(c, w))
    )
  );
  const withCue = (w) =>
    segments.some((s) => containsWord(s.text, w) && cue.test(s.text));
  const practiceWord =
    unit.words.find((w) => !knownGoodWords.has(w) && withCue(w)) ??
    unit.words.find(withCue) ??
    foundWords[foundWords.length - 1];

  const sentence = unit.sentencePatterns[0].replace("{fruit}", practiceWord);
  const others = foundWords.filter((w) => w !== practiceWord);

  const summaryZh =
    `${studentCode} 在 ${unit.title} 水果課` +
    (others.length > 0 ? `能說出 ${others.join("、")}` : "上了水果課") +
    `，${practiceWord} 的字首 ${practiceWord[0]} 需要多練習。`;
  const weakPointZh = `${practiceWord} 的字首 ${practiceWord[0]} 發音需要多練習`;
  const homeMissionZh = `在家玩一分鐘買水果遊戲：輪流說出 ${sentence}`;

  const normalized = segments.map((s) => ({
    id: s.id,
    lower: s.text.toLowerCase(),
  }));
  const sentenceEvidence = evidenceIn(
    segments,
    (text) => text.toLowerCase().includes(sentence.toLowerCase())
  );
  const evidence = [
    {
      field: "key_words",
      segmentIds: evidenceIn(segments, (text) =>
        foundWords.some((w) => containsWord(text, w))
      ),
    },
    {
      field: "sentence",
      segmentIds:
        sentenceEvidence.length > 0
          ? sentenceEvidence
          : normalized
              .filter((s) => containsWord(s.lower, practiceWord))
              .map((s) => s.id),
    },
    {
      field: "weak_point_zh",
      segmentIds: evidenceIn(
        segments,
        (text) => containsWord(text, practiceWord) && cue.test(text)
      ),
    },
    {
      field: "home_mission_zh",
      segmentIds: evidenceIn(segments, (text) =>
        /家|遊戲|玩/.test(text)
      ),
    },
  ];
  const noEvidence = evidence.filter((e) => e.segmentIds.length === 0);
  if (noEvidence.length > 0) {
    throw new MoosiSayError(
      "MISSING_EVIDENCE",
      `以下欄位在紀錄中找不到依據（${noEvidence.map((e) => e.field).join(", ")}），請補上後再產生圖卡。`,
      { fields: noEvidence.map((e) => e.field) }
    );
  }

  return {
    studentCode,
    unit: unit.title,
    summary_zh: summaryZh,
    key_words: [...foundWords],
    sentence,
    weak_point_zh: weakPointZh,
    home_mission_zh: homeMissionZh,
    evidence,
    needs_teacher_input: false,
    method: "rule-template",
    methodNote:
      "樣板規則產生的示範草稿，不是 AI 生成，也沒有使用語音辨識。",
  };
}

/** Canonical JSON with sorted keys for stable hashing. */
export function canonicalJson(value) {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  if (value !== null && typeof value === "object") {
    const keys = Object.keys(value).sort();
    return `{${keys
      .map((k) => `${JSON.stringify(k)}:${canonicalJson(value[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

/** SHA-256 hex digest of the canonical card JSON. */
export function contentHash(card) {
  return crypto.createHash("sha256").update(canonicalJson(card)).digest("hex");
}

/**
 * In-memory draft store with hash-bound approval.
 * Approval only sets a local demo status — it never sends anything.
 */
/** Deep clone a card/record so callers never hold a mutable internal reference. */
function cloneRecord(record) {
  if (typeof structuredClone === "function") return structuredClone(record);
  return JSON.parse(JSON.stringify(record));
}

export function createStore() {
  /** @type {Map<string, object>} */
  const drafts = new Map();
  let counter = 0;

  function issue({ transcript, studentCode, unit, students }) {
    const card = generateCard({ transcript, studentCode, unit, students });
    const hash = contentHash(card);
    counter += 1;
    const id = `D-${String(counter).padStart(3, "0")}`;
    const record = { id, card, contentHash: hash, status: "pending" };
    drafts.set(id, record);
    return cloneRecord(record);
  }

  function get(id) {
    const record = drafts.get(id);
    if (!record) {
      throw new MoosiSayError("NOT_FOUND", `找不到草稿 ${id}。`);
    }
    return cloneRecord(record);
  }

  /** Mark a draft blocked (e.g. a failed review). Blocked drafts stay blocked. */
  function block(id, reason = "未通過檢查") {
    const record = drafts.get(id);
    if (!record) {
      throw new MoosiSayError("NOT_FOUND", `找不到草稿 ${id}。`);
    }
    if (record.status !== "pending") {
      throw new MoosiSayError(
        "NOT_PENDING",
        `只有待核准的草稿可以標示為阻擋（目前：${record.status}）。`
      );
    }
    drafts.set(id, { ...record, status: "blocked", blockReason: reason });
    return cloneRecord(drafts.get(id));
  }

  /**
   * Approve a pending draft. Requires the exact current content hash and a
   * human approver role. Returns a demo-only approved record; sent stays false.
   */
  function approve(id, { contentHash: presentedHash, approvedBy } = {}) {
    const record = drafts.get(id);
    if (!record) {
      throw new MoosiSayError("NOT_FOUND", `找不到草稿 ${id}。`);
    }
    if (!APPROVER_ROLES.includes(approvedBy)) {
      throw new MoosiSayError(
        "INVALID_APPROVER",
        "核准需要老師或管理員身份，AI 不能核准。"
      );
    }
    if (record.status === "blocked") {
      throw new MoosiSayError(
        "BLOCKED",
        "這份草稿已被阻擋，不能核准；請修正後重新產生。"
      );
    }
    if (record.status !== "pending") {
      throw new MoosiSayError(
        "NOT_PENDING",
        `只有待核准的草稿可以核准（目前：${record.status}）。`
      );
    }
    if (!presentedHash) {
      throw new MoosiSayError(
        "HASH_REQUIRED",
        "核准需要附上圖卡內容雜湊，缺少雜湊不能核准。"
      );
    }
    // Recompute from the live stored card so a stale or tampered stored hash
    // can never authorize approval; then bind approval to that current hash.
    const currentHash = contentHash(record.card);
    if (currentHash !== record.contentHash) {
      throw new MoosiSayError(
        "HASH_MISMATCH",
        "草稿內容與紀錄雜湊不符，圖卡可能已被修改，不能核准；請重新產生預覽。"
      );
    }
    if (presentedHash !== currentHash) {
      throw new MoosiSayError(
        "HASH_MISMATCH",
        "內容雜湊不符，圖卡可能已被修改，不能核准；請重新預覽後再核准。"
      );
    }
    const approved = {
      ...record,
      status: "approved",
      approvedBy,
      approvedAt: new Date().toISOString(),
      sent: false,
      demoNote: "示範狀態，不會實際傳送訊息給家長。",
    };
    drafts.set(id, approved);
    return cloneRecord(approved);
  }

  return { issue, get, block, approve };
}

/** Escape text for SVG/HTML text nodes and double-quoted attribute values. */
function esc(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Render the card as a responsive 4:5 SVG (1080x1350 viewBox).
 * Mascot is a simple placeholder shape — no real child imagery.
 * This demo renders SVG/HTML only; it does not export PNG.
 */
export function renderCardSvg(card, hash) {
  const shortHash = String(hash || "").slice(0, 12);
  const chips = card.key_words
    .map(
      (w, i) =>
        `<g transform="translate(${80 + i * 310},0)">` +
        `<rect x="0" y="0" width="270" height="96" rx="48" fill="#fff4de" stroke="#e8a13d" stroke-width="4"/>` +
        `<text x="135" y="62" text-anchor="middle" font-size="44" font-weight="700" fill="#7a4a12" font-family="sans-serif">${esc(w)}</text></g>`
    )
    .join("");
  const evidenceLines = card.evidence
    .map((e) => `${e.field}: ${e.segmentIds.join(", ")}`)
    .join("  ·  ");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1350" role="img" aria-label="Moosi 說課後學習圖卡預覽">
  <rect x="0" y="0" width="1080" height="1350" rx="48" fill="#fffaf0"/>
  <rect x="0" y="0" width="1080" height="220" rx="48" fill="#2f6b4f"/>
  <rect x="0" y="140" width="1080" height="80" fill="#2f6b4f"/>
  <text x="80" y="95" font-size="52" font-weight="700" fill="#ffffff" font-family="sans-serif">Moosi 說 · 課後學習圖卡</text>
  <text x="80" y="160" font-size="34" fill="#dcefe2" font-family="sans-serif">${esc(card.studentCode)} · ${esc(card.unit)} 水果課 · DEMO 預覽</text>
  <g transform="translate(830,300)">
    <ellipse cx="90" cy="150" rx="90" ry="110" fill="#c98d5e"/>
    <circle cx="90" cy="40" r="62" fill="#c98d5e"/>
    <path d="M45 5 L25 -45 L55 -30 L65 0 Z" fill="#8a5a33"/>
    <path d="M135 5 L155 -45 L125 -30 L115 0 Z" fill="#8a5a33"/>
    <circle cx="68" cy="32" r="8" fill="#3a2415"/>
    <circle cx="112" cy="32" r="8" fill="#3a2415"/>
    <ellipse cx="90" cy="58" rx="14" ry="10" fill="#3a2415"/>
    <text x="90" y="295" text-anchor="middle" font-size="30" fill="#8a5a33" font-family="sans-serif">Moosi 吉祥物示意</text>
  </g>
  <text x="80" y="360" font-size="40" font-weight="700" fill="#2f6b4f" font-family="sans-serif">今天學了什麼</text>
  <foreignObject x="80" y="390" width="620" height="180"><div xmlns="http://www.w3.org/1999/xhtml" style="font-size:36px;line-height:1.5;color:#333;font-family:sans-serif;">${esc(card.summary_zh)}</div></foreignObject>
  <text x="80" y="640" font-size="40" font-weight="700" fill="#2f6b4f" font-family="sans-serif">本單元單字</text>
  <g transform="translate(0,670)">${chips}</g>
  <text x="80" y="850" font-size="40" font-weight="700" fill="#2f6b4f" font-family="sans-serif">本單元句型</text>
  <rect x="80" y="880" width="920" height="110" rx="24" fill="#eef6ef" stroke="#2f6b4f" stroke-width="4"/>
  <text x="120" y="950" font-size="44" font-weight="700" fill="#1e4633" font-family="sans-serif">${esc(card.sentence)}</text>
  <text x="80" y="1060" font-size="40" font-weight="700" fill="#2f6b4f" font-family="sans-serif">多練一下</text>
  <text x="80" y="1110" font-size="36" fill="#333" font-family="sans-serif">${esc(card.weak_point_zh)}</text>
  <text x="80" y="1170" font-size="40" font-weight="700" fill="#2f6b4f" font-family="sans-serif">在家這樣陪練</text>
  <foreignObject x="80" y="1190" width="920" height="60"><div xmlns="http://www.w3.org/1999/xhtml" style="font-size:34px;color:#333;font-family:sans-serif;">${esc(card.home_mission_zh)}</div></foreignObject>
  <text x="80" y="1290" font-size="24" fill="#888" font-family="sans-serif">依據 ${esc(evidenceLines)} · hash ${esc(shortHash)} · 示範預覽，不會實際傳送</text>
</svg>`;
}
