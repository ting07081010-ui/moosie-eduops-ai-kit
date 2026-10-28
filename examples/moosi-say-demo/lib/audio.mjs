import { spawn } from "node:child_process";
import { MoosiSayError, SAMPLE_TRANSCRIPT } from "./moosi-say.mjs";

export const MAX_INPUT_BYTES = 2 * 1024 * 1024;
export const MAX_DURATION_SEC = 60;
export const DECODE_MARGIN_SEC = 2;
export const PROCESS_TIMEOUT_MS = 15000;
export const MAX_FFPROBE_JSON_BYTES = 64 * 1024;
export const MAX_PCM_BYTES = 2 * 1024 * 1024;
const MAX_STDERR_BYTES = 64 * 1024;
const BYTE_RATE = 32000;
const PROVIDER_TIMEOUT_MS = 5000;

function boundedOption(value, fallback, maximum, integer = false) {
  const number = value ?? fallback;
  if (typeof number !== "number" || !Number.isFinite(number) || number <= 0 ||
      (integer && !Number.isInteger(number))) {
    throw new MoosiSayError("INVALID_CONFIG", "音訊處理設定無效。");
  }
  return Math.min(number, maximum);
}

/** Fixed-command caller used by the audio pipeline; exported for offline tests. */
export function runBoundedProcess(cmd, args, input, timeoutMs = PROCESS_TIMEOUT_MS, opts = {}) {
  const timeout = boundedOption(timeoutMs, PROCESS_TIMEOUT_MS, PROCESS_TIMEOUT_MS);
  const maxStdout = boundedOption(opts.maxStdout, MAX_PCM_BYTES, MAX_PCM_BYTES, true);
  return new Promise((resolve, reject) => {
    let proc;
    let timer;
    let settled = false;
    let chunks = [];
    let size = 0;
    let stderrChunks = [];
    let stderrSize = 0;
    const fail = (error, kill = false) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      chunks = [];
      stderrChunks = [];
      if (kill && proc) {
        proc.stdin?.destroy();
        try { proc.kill("SIGKILL"); } catch { /* Already exited. */ }
        proc.stdout?.destroy();
        proc.stderr?.destroy();
      }
      reject(error);
    };
    const startError = (error) => new MoosiSayError(
      error?.code === "ENOENT" ? "PROCESS_UNAVAILABLE" : "PROCESS_FAILED",
      error?.code === "ENOENT" ? "需要本機 ffmpeg 與 ffprobe。" : "音訊處理程序啟動失敗。"
    );
    try {
      proc = spawn(cmd, args, { shell: false, stdio: ["pipe", "pipe", "pipe"] });
    } catch (error) {
      fail(startError(error));
      return;
    }
    proc.once("error", (error) => fail(startError(error), true));
    proc.stdout.on("data", (chunk) => {
      if (settled) return;
      if (size + chunk.length > maxStdout) {
        fail(new MoosiSayError("OUTPUT_OVERFLOW", "音訊處理輸出超過限制。"), true);
        return;
      }
      chunks.push(chunk);
      size += chunk.length;
    });
    proc.stderr.on("data", (chunk) => {
      if (settled || stderrSize >= MAX_STDERR_BYTES) return;
      const part = chunk.subarray(0, MAX_STDERR_BYTES - stderrSize);
      stderrChunks.push(part);
      stderrSize += part.length;
    });
    proc.stdin.on("error", (error) => {
      // A child may close stdin early. Its exit status is authoritative for EPIPE.
      if (error.code !== "EPIPE") {
        fail(new MoosiSayError("PROCESS_FAILED", "音訊處理輸入失敗。"), true);
      }
    });
    proc.once("close", (code) => {
      if (settled) return;
      if (code !== 0) {
        fail(new MoosiSayError("PROCESS_FAILED", "音訊處理失敗。"));
        return;
      }
      settled = true;
      clearTimeout(timer);
      const stdout = Buffer.concat(chunks, size);
      const stderr = Buffer.concat(stderrChunks, stderrSize);
      chunks = [];
      stderrChunks = [];
      resolve({ stdout, stderr });
    });
    timer = setTimeout(() => {
      fail(new MoosiSayError("PROCESS_TIMEOUT", "音訊處理逾時。"), true);
    }, timeout);
    try {
      proc.stdin.end(input);
    } catch (error) {
      if (error.code !== "EPIPE") {
        fail(new MoosiSayError("PROCESS_FAILED", "音訊處理輸入失敗。"), true);
      }
    }
  });
}

function buildWavFromPcm(pcm) {
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(16000, 24);
  header.writeUInt32LE(BYTE_RATE, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

/** Accept only the canonical PCM WAV emitted by this pipeline. */
export function validateWav(buffer) {
  const invalid = () => { throw new MoosiSayError("WAV_INVALID", "WAV 格式或資料長度錯誤。"); };
  if (!Buffer.isBuffer(buffer) || buffer.length < 44) invalid();
  if (buffer.toString("ascii", 0, 4) !== "RIFF" ||
      buffer.toString("ascii", 8, 12) !== "WAVE" ||
      buffer.toString("ascii", 12, 16) !== "fmt " ||
      buffer.toString("ascii", 36, 40) !== "data" ||
      buffer.readUInt32LE(4) + 8 !== buffer.length ||
      buffer.readUInt32LE(16) !== 16 || buffer.readUInt16LE(20) !== 1 ||
      buffer.readUInt16LE(22) !== 1 || buffer.readUInt32LE(24) !== 16000 ||
      buffer.readUInt32LE(28) !== BYTE_RATE || buffer.readUInt16LE(32) !== 2 ||
      buffer.readUInt16LE(34) !== 16) invalid();
  const dataSize = buffer.readUInt32LE(40);
  if (dataSize === 0 || dataSize % 2 !== 0 || buffer.length !== 44 + dataSize ||
      dataSize > MAX_DURATION_SEC * BYTE_RATE) invalid();
  return { sampleRate: 16000, channels: 1, bitsPerSample: 16, dataSize, byteRate: BYTE_RATE, blockAlign: 2 };
}

/** Buffers and pipes only: no paths, remote media, recordings, or persisted audio. */
export async function normalizeAudio(buffer, opts = {}) {
  const maxDuration = boundedOption(opts.maxDuration, MAX_DURATION_SEC, MAX_DURATION_SEC);
  const maxInputBytes = boundedOption(opts.maxInputBytes, MAX_INPUT_BYTES, MAX_INPUT_BYTES, true);
  const spawnFn = opts.spawnFn ?? runBoundedProcess;
  if (opts.synthetic !== true || opts.role !== "adult-teacher") {
    throw new MoosiSayError("DECLARATION_REQUIRED", "僅限已聲明的成人教師合成音訊。");
  }
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new MoosiSayError("EMPTY_AUDIO", "請提供合成音訊資料。");
  }
  if (buffer.length > maxInputBytes) throw new MoosiSayError("INPUT_TOO_LARGE", "合成音訊超過大小限制。");
  if (buffer.length < 4 || buffer.toString("ascii", 0, 4) !== "OggS") {
    throw new MoosiSayError("INVALID_AUDIO", "僅接受 Ogg/Opus 合成音訊。");
  }
  const ffprobeArgs = [
    "-v", "error", "-protocol_whitelist", "pipe", "-f", "ogg",
    "-show_entries", "stream=codec_name,codec_type,duration:format=format_name,duration",
    "-of", "json", "-i", "pipe:0",
  ];
  let probeJson;
  try {
    const result = opts.probeFn
      ? await opts.probeFn(buffer)
      : await spawnFn("ffprobe", ffprobeArgs, buffer, PROCESS_TIMEOUT_MS, { maxStdout: MAX_FFPROBE_JSON_BYTES });
    const out = Buffer.isBuffer(result) ? result : result?.stdout;
    if (!Buffer.isBuffer(out) || out.length > MAX_FFPROBE_JSON_BYTES) {
      throw new MoosiSayError("INVALID_AUDIO", "無法驗證音訊格式。");
    }
    probeJson = JSON.parse(out.toString("utf8"));
  } catch (error) {
    if (error instanceof MoosiSayError && ["PROCESS_UNAVAILABLE", "PROCESS_TIMEOUT", "OUTPUT_OVERFLOW"].includes(error.code)) throw error;
    throw new MoosiSayError("INVALID_AUDIO", "無法驗證 Ogg/Opus 音訊。");
  }
  const streams = probeJson?.streams;
  if (!Array.isArray(streams) || streams.length !== 1 ||
      streams[0]?.codec_type !== "audio" || streams[0]?.codec_name !== "opus" ||
      probeJson?.format?.format_name !== "ogg") {
    throw new MoosiSayError("INVALID_AUDIO", "僅接受單串流 Ogg/Opus 音訊。");
  }
  const duration = Number(probeJson.format.duration ?? streams[0].duration);
  if (Number.isFinite(duration) && duration > maxDuration) {
    throw new MoosiSayError("AUDIO_TOO_LONG", "合成音訊超過時間限制。");
  }
  // Missing/N/A probe duration is normal on stdin. Decoded sample count is authoritative.
  const ffmpegArgs = [
    "-nostdin", "-v", "error", "-xerror", "-protocol_whitelist", "pipe", "-f", "ogg",
    "-i", "pipe:0", "-t", String(maxDuration + DECODE_MARGIN_SEC),
    "-vn", "-sn", "-dn", "-map", "0:a:0", "-map_metadata", "-1",
    "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le", "-f", "s16le", "pipe:1",
  ];
  let pcm;
  try {
    const result = await spawnFn("ffmpeg", ffmpegArgs, buffer, PROCESS_TIMEOUT_MS, { maxStdout: MAX_PCM_BYTES });
    pcm = Buffer.isBuffer(result) ? result : result?.stdout;
  } catch (error) {
    if (error instanceof MoosiSayError) throw error;
    throw new MoosiSayError("PROCESS_FAILED", "音訊轉檔失敗。");
  }
  if (!Buffer.isBuffer(pcm) || pcm.length === 0) throw new MoosiSayError("DECODE_EMPTY", "解碼後沒有有效音訊。");
  if (pcm.length % 2 !== 0) throw new MoosiSayError("WAV_INVALID", "PCM 樣本未正確對齊。");
  const durationSec = pcm.length / BYTE_RATE;
  if (durationSec > maxDuration) throw new MoosiSayError("AUDIO_TOO_LONG", "合成音訊超過時間限制。");
  const wav = buildWavFromPcm(pcm);
  validateWav(wav);
  return { wav, meta: { sampleRate: 16000, channels: 1, bitsPerSample: 16, durationSec } };
}

export async function transcribeMock(wavBuffer, meta, provider, opts = {}) {
  const wavMeta = validateWav(wavBuffer);
  if (meta?.sampleRate !== wavMeta.sampleRate || meta?.channels !== wavMeta.channels ||
      meta?.bitsPerSample !== wavMeta.bitsPerSample || meta?.durationSec !== wavMeta.dataSize / BYTE_RATE) {
    throw new MoosiSayError("WAV_INVALID", "WAV 與音訊格式資訊不符。");
  }
  if (!provider) throw new MoosiSayError("PROVIDER_MISSING", "缺少離線模擬轉錄器。");
  const call = typeof provider === "function" ? provider
    : typeof provider.transcribe === "function" ? provider.transcribe.bind(provider) : null;
  if (typeof call !== "function") throw new MoosiSayError("PROVIDER_MALFORMED", "離線模擬轉錄器格式錯誤。");
  const timeoutMs = boundedOption(opts.providerTimeoutMs, PROVIDER_TIMEOUT_MS, PROVIDER_TIMEOUT_MS);
  const timeoutError = new MoosiSayError("PROVIDER_TIMEOUT", "離線模擬轉錄器逾時。");
  let timer;
  let result;
  try {
    result = await Promise.race([
      Promise.resolve().then(() => call(wavBuffer, meta)),
      new Promise((_, reject) => { timer = setTimeout(() => reject(timeoutError), timeoutMs); }),
    ]);
  } catch (error) {
    if (error === timeoutError) throw timeoutError;
    throw new MoosiSayError("PROVIDER_FAILED", "離線模擬轉錄器失敗。");
  } finally {
    clearTimeout(timer);
  }
  if (!result || typeof result.transcript !== "string" || !result.transcript.trim() || result.transcript.length > 5000 ||
      result.transcriptionIsMock !== true || typeof result.provenance !== "string" ||
      !result.provenance.trim() || result.provenance.length > 200) {
    throw new MoosiSayError("PROVIDER_MALFORMED", "離線模擬轉錄器回傳格式錯誤。");
  }
  return { transcript: result.transcript.trim(), transcriptionIsMock: true, provenance: result.provenance.trim(), sendsMessages: false };
}

/** Deliberately independent of audio content: this is not speech recognition. */
export function defaultTranscriptionProvider() {
  return { transcript: SAMPLE_TRANSCRIPT, transcriptionIsMock: true, provenance: "mock-fixed-sample", sendsMessages: false };
}
