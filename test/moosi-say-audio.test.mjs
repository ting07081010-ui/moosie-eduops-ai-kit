import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { once } from "node:events";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import {
  MAX_INPUT_BYTES,
  MAX_DURATION_SEC,
  MAX_FFPROBE_JSON_BYTES,
  MAX_PCM_BYTES,
  normalizeAudio,
  runBoundedProcess,
  transcribeMock,
  defaultTranscriptionProvider,
  validateWav,
} from "../examples/moosi-say-demo/lib/audio.mjs";
import { MoosiSayError, SAMPLE_TRANSCRIPT, createStore } from "../examples/moosi-say-demo/lib/moosi-say.mjs";
import { createApp } from "../examples/moosi-say-demo/server.mjs";

// Synthetic oscillator only: never a human voice, network fixture, or saved audio file.
function syntheticOgg({ duration = 0.25, codec = "libopus", streams = 1 } = {}) {
  const args = [
    "-nostdin", "-hide_banner", "-loglevel", "error", "-f", "lavfi",
    "-i", `sine=frequency=440:sample_rate=48000:duration=${duration}`,
  ];
  for (let i = 0; i < streams; i++) args.push("-map", "0:a:0");
  args.push("-ar", "48000", "-ac", "2", "-c:a", codec, "-f", "ogg", "pipe:1");
  const result = spawnSync("ffmpeg", args, { maxBuffer: 4 * 1024 * 1024, timeout: 10000 });
  assert.equal(result.status, 0, "Installed ffmpeg must generate the synthetic fixture");
  assert.ok(result.stdout.length > 0);
  return result.stdout;
}

const declaration = { synthetic: true, role: "adult-teacher" };
const syntheticStub = Buffer.from("OggSsynthetic-process-injection-only");
const probeData = {
  streams: [{ codec_type: "audio", codec_name: "opus", duration: "N/A" }],
  format: { format_name: "ogg" },
};
const probeResult = (value = probeData) => ({ stdout: Buffer.from(JSON.stringify(value)) });
const injectedOptions = (pcm = Buffer.alloc(8000), extra = {}) => ({
  ...declaration,
  probeFn: async () => probeResult(),
  spawnFn: async () => ({ stdout: pcm }),
  ...extra,
});
let ogg;
let normalized;
before(async () => {
  ogg = syntheticOgg();
  normalized = await normalizeAudio(ogg, declaration);
});

function rejectsCode(promise, code) {
  return assert.rejects(promise, (error) => {
    assert.ok(error instanceof MoosiSayError);
    assert.equal(error.code, code);
    return true;
  });
}

describe("moosi-say audio: actual offline normalization", () => {
  it("converts 48k stereo Opus to canonical 16k mono PCM16 WAV in memory", () => {
    const { wav, meta } = normalized;
    const header = validateWav(wav);
    assert.deepEqual(header, { sampleRate: 16000, channels: 1, bitsPerSample: 16, dataSize: 8000, byteRate: 32000, blockAlign: 2 });
    assert.equal(wav.readUInt32LE(4), wav.length - 8);
    assert.equal(wav.readUInt32LE(40), wav.length - 44);
    assert.deepEqual(meta, { sampleRate: 16000, channels: 1, bitsPerSample: 16, durationSec: 0.25 });
    assert.ok(wav.subarray(44).some((byte) => byte !== 0), "synthetic tone was decoded");
    const inspected = spawnSync("ffprobe", [
      "-v", "error", "-protocol_whitelist", "pipe", "-f", "wav", "-i", "pipe:0",
      "-show_entries", "stream=codec_name,sample_rate,channels,bits_per_sample", "-of", "json",
    ], { input: wav, timeout: 10000, maxBuffer: 65536 });
    assert.equal(inspected.status, 0);
    const [stream] = JSON.parse(inspected.stdout).streams;
    assert.equal(stream.codec_name, "pcm_s16le");
    assert.equal(stream.sample_rate, "16000");
    assert.equal(stream.channels, 1);
    assert.equal(stream.bits_per_sample, 16);
  });

  it("requires literal synthetic and adult-teacher declarations before processing", async () => {
    let calls = 0;
    for (const flags of [{}, { synthetic: true }, { synthetic: "true", role: "adult-teacher" }, { synthetic: true, role: "student" }]) {
      await rejectsCode(normalizeAudio(ogg, { ...flags, spawnFn: async () => { calls++; } }), "DECLARATION_REQUIRED");
    }
    assert.equal(calls, 0);
  });

  it("rejects empty, path/URL/string, oversized, and non-Ogg input before subprocesses", async () => {
    let calls = 0;
    const opts = { ...declaration, spawnFn: async () => { calls++; } };
    for (const value of [null, undefined, Buffer.alloc(0), "/tmp/not-an-audio-path", "https://example.com/not-audio"]) {
      await rejectsCode(normalizeAudio(value, opts), "EMPTY_AUDIO");
    }
    await rejectsCode(normalizeAudio(Buffer.alloc(MAX_INPUT_BYTES + 1), opts), "INPUT_TOO_LARGE");
    await rejectsCode(normalizeAudio(Buffer.from("#EXTM3U\nsynthetic-playlist"), opts), "INVALID_AUDIO");
    assert.equal(calls, 0);
  });

  it("rejects real synthetic non-Opus Ogg, multiple streams, and corrupt Ogg", async () => {
    await rejectsCode(normalizeAudio(syntheticOgg({ codec: "libvorbis" }), declaration), "INVALID_AUDIO");
    await rejectsCode(normalizeAudio(syntheticOgg({ streams: 2 }), declaration), "INVALID_AUDIO");
    await rejectsCode(normalizeAudio(Buffer.from("OggSbroken-synthetic-container"), declaration), "INVALID_AUDIO");
  });

  it("rejects actual decoded duration over a lowered test limit", async () => {
    await rejectsCode(normalizeAudio(ogg, { ...declaration, maxDuration: 0.1 }), "AUDIO_TOO_LONG");
  });

  it("uses fixed pipe-only protocols, forced Ogg, bounded output, and fixed PCM arguments", async () => {
    const calls = [];
    const output = await normalizeAudio(syntheticStub, {
      ...declaration,
      spawnFn: async (command, args, input, timeout, options) => {
        calls.push({ command, args, input, timeout, options });
        return command === "ffprobe" ? probeResult() : { stdout: Buffer.alloc(8000) };
      },
    });
    assert.equal(output.meta.durationSec, 0.25);
    assert.deepEqual(calls.map((call) => call.command), ["ffprobe", "ffmpeg"]);
    for (const call of calls) {
      assert.equal(call.args[call.args.indexOf("-protocol_whitelist") + 1], "pipe");
      assert.equal(call.args[call.args.indexOf("-f") + 1], "ogg");
      assert.equal(call.args[call.args.indexOf("-i") + 1], "pipe:0");
      assert.equal(call.input, syntheticStub);
      assert.ok(call.timeout > 0 && call.timeout <= 15000);
    }
    assert.equal(calls[0].options.maxStdout, MAX_FFPROBE_JSON_BYTES);
    assert.equal(calls[1].options.maxStdout, MAX_PCM_BYTES);
    const args = calls[1].args;
    for (const [flag, value] of [["-ar", "16000"], ["-ac", "1"], ["-c:a", "pcm_s16le"], ["-map", "0:a:0"], ["-map_metadata", "-1"]]) {
      assert.equal(args[args.indexOf(flag) + 1], value);
    }
    assert.ok(args.includes("-vn") && args.includes("-sn") && args.includes("-dn"));
    assert.equal(args.at(-1), "pipe:1");
    assert.equal(args.at(-2), "s16le");
  });

  it("accepts exact sample boundary, but never the decode margin as successful audio", async () => {
    const exact = await normalizeAudio(syntheticStub, injectedOptions(Buffer.alloc(8000), { maxDuration: 0.25 }));
    assert.equal(exact.meta.durationSec, 0.25);
    await rejectsCode(normalizeAudio(syntheticStub, injectedOptions(Buffer.alloc(8002), { maxDuration: 0.25 })), "AUDIO_TOO_LONG");
    await rejectsCode(normalizeAudio(syntheticStub, injectedOptions(Buffer.alloc((MAX_DURATION_SEC * 32000) + 2), { maxDuration: 100 })), "AUDIO_TOO_LONG");
  });

  it("rejects overlong probe metadata before decoding, while allowing missing/N/A duration", async () => {
    let decoded = false;
    await rejectsCode(normalizeAudio(syntheticStub, injectedOptions(Buffer.alloc(8000), {
      probeFn: async () => probeResult({ ...probeData, format: { format_name: "ogg", duration: "61" } }),
      spawnFn: async () => { decoded = true; return { stdout: Buffer.alloc(8000) }; },
    })), "AUDIO_TOO_LONG");
    assert.equal(decoded, false);
    const missing = await normalizeAudio(syntheticStub, injectedOptions());
    assert.equal(missing.meta.durationSec, 0.25);
  });

  it("rejects malformed probe JSON/shape/container/codec and bad decoded PCM", async () => {
    for (const value of [null, {}, { streams: null }, { ...probeData, format: { format_name: "webm" } }, { streams: [{ codec_type: "video", codec_name: "opus" }], format: { format_name: "ogg" } }]) {
      await rejectsCode(normalizeAudio(syntheticStub, injectedOptions(undefined, { probeFn: async () => probeResult(value) })), "INVALID_AUDIO");
    }
    await rejectsCode(normalizeAudio(syntheticStub, injectedOptions(undefined, { probeFn: async () => ({ stdout: Buffer.from("not-json") }) })), "INVALID_AUDIO");
    for (const value of [Buffer.alloc(0), "not-pcm", undefined]) {
      await rejectsCode(normalizeAudio(syntheticStub, injectedOptions(undefined, { spawnFn: async () => ({ stdout: value }) })), "DECODE_EMPTY");
    }
    await rejectsCode(normalizeAudio(syntheticStub, injectedOptions(Buffer.alloc(3))), "WAV_INVALID");
  });

  it("cannot remove production size/duration limits using larger or invalid options", async () => {
    await rejectsCode(normalizeAudio(Buffer.alloc(MAX_INPUT_BYTES + 1), { ...declaration, maxInputBytes: MAX_INPUT_BYTES * 2 }), "INPUT_TOO_LARGE");
    for (const maxDuration of [NaN, Infinity, 0, -1, "60"]) {
      await rejectsCode(normalizeAudio(syntheticStub, injectedOptions(undefined, { maxDuration })), "INVALID_CONFIG");
    }
  });

  it("rejects tampered WAV headers, truncation, or additional bytes", () => {
    for (const offset of [0, 4, 8, 12, 16, 20, 22, 24, 28, 32, 34, 36, 40]) {
      const copy = Buffer.from(normalized.wav);
      copy[offset] ^= 1;
      assert.throws(() => validateWav(copy), { code: "WAV_INVALID" });
    }
    for (const value of [null, Buffer.alloc(0), normalized.wav.subarray(0, -1), Buffer.concat([normalized.wav, Buffer.alloc(1)])]) {
      assert.throws(() => validateWav(value), { code: "WAV_INVALID" });
    }
  });
});

describe("moosi-say audio: bounded subprocess lifecycle", () => {
  it("reports missing binary and nonzero exit without leaking stderr", async () => {
    await rejectsCode(runBoundedProcess("moosi-test-missing-binary", [], Buffer.alloc(0), 1000), "PROCESS_UNAVAILABLE");
    await assert.rejects(runBoundedProcess(process.execPath, ["-e", "process.stderr.write('/private/synthetic-detail');process.exit(7)"], Buffer.alloc(0), 1000), (error) => {
      assert.equal(error.code, "PROCESS_FAILED");
      assert.ok(!error.message.includes("private"));
      return true;
    });
  });

  it("kills a timed-out child and fails instead of returning partial stdout", async () => {
    await rejectsCode(runBoundedProcess(process.execPath, ["-e", "process.stdout.write('partial');setInterval(()=>{},1000)"], Buffer.alloc(0), 100), "PROCESS_TIMEOUT");
  });

  it("fails on stdout overflow without retaining data beyond the cap", async () => {
    await rejectsCode(runBoundedProcess(process.execPath, ["-e", "process.stdout.write(Buffer.alloc(131072));setInterval(()=>{},1000)"], Buffer.alloc(0), 1000, { maxStdout: 1024 }), "OUTPUT_OVERFLOW");
  });

  it("bounds stderr and handles child stdin early-close/EPIPE safely", async () => {
    const result = await runBoundedProcess(process.execPath, ["-e", "process.stderr.write(Buffer.alloc(100000));process.stdout.write('ok')"], Buffer.alloc(0), 1000);
    assert.equal(result.stdout.toString(), "ok");
    assert.ok(result.stderr.length <= 65536);
    const early = await runBoundedProcess(process.execPath, ["-e", "process.exit(0)"], Buffer.alloc(1024 * 1024), 1000);
    assert.equal(early.stdout.length, 0);
  });
});

describe("moosi-say audio: injected mock transcription", () => {
  it("uses fixed sample text independent of audio content and always identifies the mock", async () => {
    const result = await transcribeMock(normalized.wav, normalized.meta, defaultTranscriptionProvider);
    assert.equal(result.transcript, SAMPLE_TRANSCRIPT);
    assert.equal(result.transcriptionIsMock, true);
    assert.equal(result.provenance, "mock-fixed-sample");
    assert.equal(result.sendsMessages, false);
  });

  it("passes only validated normalized WAV to an injected function or object mock", async () => {
    let calls = 0;
    const objectProvider = { marker: "local-injected-mock", transcribe(wav, meta) {
      calls++;
      assert.equal(wav, normalized.wav);
      assert.deepEqual(meta, normalized.meta);
      validateWav(wav);
      return { transcript: SAMPLE_TRANSCRIPT, transcriptionIsMock: true, provenance: this.marker, ignored: "not-returned" };
    } };
    const result = await transcribeMock(normalized.wav, normalized.meta, objectProvider);
    assert.equal(calls, 1);
    assert.equal(result.provenance, "local-injected-mock");
    assert.equal("ignored" in result, false);
    assert.equal("wav" in result, false);
  });

  it("never calls the provider for invalid WAV or mismatched normalization metadata", async () => {
    let calls = 0;
    const provider = () => { calls++; return defaultTranscriptionProvider(); };
    await rejectsCode(transcribeMock(Buffer.from("not-wav"), normalized.meta, provider), "WAV_INVALID");
    await rejectsCode(transcribeMock(normalized.wav, { ...normalized.meta, channels: 2 }, provider), "WAV_INVALID");
    assert.equal(calls, 0);
  });

  it("fails closed for missing/malformed/failing/non-mock providers and malformed responses", async () => {
    await rejectsCode(transcribeMock(normalized.wav, normalized.meta), "PROVIDER_MISSING");
    await rejectsCode(transcribeMock(normalized.wav, normalized.meta, { transcribe: 123 }), "PROVIDER_MALFORMED");
    await rejectsCode(transcribeMock(normalized.wav, normalized.meta, () => { throw new Error("private synthetic provider detail"); }), "PROVIDER_FAILED");
    for (const value of [null, {}, { ...defaultTranscriptionProvider(), transcript: " " }, { ...defaultTranscriptionProvider(), transcript: "a".repeat(5001) }, { ...defaultTranscriptionProvider(), transcriptionIsMock: false }, { ...defaultTranscriptionProvider(), provenance: "" }, { ...defaultTranscriptionProvider(), provenance: "a".repeat(201) }]) {
      await rejectsCode(transcribeMock(normalized.wav, normalized.meta, () => value), "PROVIDER_MALFORMED");
    }
  });

  it("times out a stalled injected provider and clears its own timeout after success", async () => {
    await rejectsCode(transcribeMock(normalized.wav, normalized.meta, () => new Promise(() => {}), { providerTimeoutMs: 10 }), "PROVIDER_TIMEOUT");
    const result = await transcribeMock(normalized.wav, normalized.meta, defaultTranscriptionProvider, { providerTimeoutMs: 1000 });
    assert.equal(result.transcriptionIsMock, true);
  });
});

const voiceHeaders = {
  "Content-Type": "audio/ogg",
  "X-Demo-Synthetic": "true",
  "X-Input-Role": "adult-teacher",
};
async function withApp(options, action) {
  const { app, store } = createApp(options);
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${server.address().port}`;
  try { await action(base, store); }
  finally {
    await new Promise((resolve) => { server.close(resolve); server.closeAllConnections(); });
  }
}
async function jsonResponse(response, status) {
  assert.equal(response.status, status);
  assert.match(response.headers.get("content-type"), /application\/json/);
  return response.json();
}

describe("moosi-say audio: localhost HTTP regression", () => {
  it("accepts raw Ogg under both supported MIME types with explicit mock/no-send metadata", async () => {
    let calls = 0;
    await withApp({ transcriptionProvider: (wav, meta) => {
      calls++;
      assert.equal(validateWav(wav).sampleRate, 16000);
      assert.equal(meta.channels, 1);
      return { ...defaultTranscriptionProvider(), provenance: "http-test-mock" };
    } }, async (base) => {
      for (const type of ["audio/ogg", "application/ogg"]) {
        const data = await jsonResponse(await fetch(`${base}/api/voice/transcribe`, { method: "POST", headers: { ...voiceHeaders, "Content-Type": type }, body: ogg }), 200);
        assert.equal(data.transcript, SAMPLE_TRANSCRIPT);
        assert.equal(data.transcriptionIsMock, true);
        assert.equal(data.provenance, "http-test-mock");
        assert.equal(data.sendsMessages, false);
        assert.deepEqual({ ...data.normalization, durationSec: undefined }, { sampleRate: 16000, channels: 1, bitsPerSample: 16, format: "PCM16 WAV", durationSec: undefined });
        assert.match(data.warning, /模擬|mock/i);
        assert.equal("wav" in data || "audio" in data, false);
      }
      await jsonResponse(await fetch(`${base}/api/drafts/D-001`), 404);
    });
    assert.equal(calls, 2);
  });

  it("rejects headers/type/empty/corrupt/non-Opus/oversize input with JSON and no provider calls", async () => {
    let calls = 0;
    await withApp({ transcriptionProvider: () => { calls++; return defaultTranscriptionProvider(); } }, async (base) => {
      const upload = (headers, body) => fetch(`${base}/api/voice/transcribe`, { method: "POST", headers, body });
      await jsonResponse(await upload({ "Content-Type": "audio/ogg" }, ogg), 400);
      await jsonResponse(await upload({ ...voiceHeaders, "X-Input-Role": "student" }, ogg), 400);
      await jsonResponse(await upload({ ...voiceHeaders, "X-Demo-Synthetic": "false" }, ogg), 400);
      await jsonResponse(await upload({ ...voiceHeaders, "Content-Type": "text/plain" }, ogg), 415);
      await jsonResponse(await upload({ ...voiceHeaders, "Content-Type": "application/json" }, "{"), 415);
      await jsonResponse(await upload(voiceHeaders, Buffer.alloc(0)), 400);
      await jsonResponse(await upload(voiceHeaders, Buffer.from("OggSbroken-synthetic-container")), 422);
      await jsonResponse(await upload(voiceHeaders, syntheticOgg({ codec: "libvorbis" })), 422);
      const large = await jsonResponse(await upload(voiceHeaders, Buffer.alloc(MAX_INPUT_BYTES + 1)), 413);
      assert.ok(large.error.code);
      assert.ok(!JSON.stringify(large).includes("stack"));
    });
    assert.equal(calls, 0);
  });

  it("returns JSON 422 for overlong decoded audio without calling the provider", async () => {
    let calls = 0;
    await withApp({ audioDeps: { maxDuration: 0.1 }, transcriptionProvider: () => { calls++; return defaultTranscriptionProvider(); } }, async (base) => {
      const data = await jsonResponse(await fetch(`${base}/api/voice/transcribe`, { method: "POST", headers: voiceHeaders, body: ogg }), 422);
      assert.equal(data.error.code, "AUDIO_TOO_LONG");
    });
    assert.equal(calls, 0);
  });

  it("maps provider failures and malformed/non-mock output to safe JSON 500", async () => {
    for (const provider of [() => { throw new Error("private-synthetic-provider-marker"); }, () => ({ ...defaultTranscriptionProvider(), transcriptionIsMock: false })]) {
      await withApp({ transcriptionProvider: provider }, async (base) => {
        const data = await jsonResponse(await fetch(`${base}/api/voice/transcribe`, { method: "POST", headers: voiceHeaders, body: ogg }), 500);
        assert.ok(!JSON.stringify(data).includes("private-synthetic"));
        assert.ok(!JSON.stringify(data).includes("stack"));
      });
    }
  });

  it("maps process missing/timeout and unknown server failures without exposing internals", async () => {
    for (const [code, status] of [["PROCESS_UNAVAILABLE", 503], ["PROCESS_TIMEOUT", 504], ["PROCESS_FAILED", 500]]) {
      await withApp({ audioDeps: { probeFn: async () => probeResult(), spawnFn: async () => { throw new MoosiSayError(code, "private-synthetic-process-marker"); } } }, async (base) => {
        const data = await jsonResponse(await fetch(`${base}/api/voice/transcribe`, { method: "POST", headers: voiceHeaders, body: ogg }), status);
        assert.ok(!JSON.stringify(data).includes("private-synthetic"));
      });
    }
    const store = { ...createStore(), issue() { throw new Error("private-synthetic-server-marker"); } };
    await withApp({ store }, async (base) => {
      const data = await jsonResponse(await fetch(`${base}/api/drafts`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ transcript: SAMPLE_TRANSCRIPT, studentCode: "S-007" }) }), 500);
      assert.ok(!JSON.stringify(data).includes("private-synthetic"));
    });
  });

  it("preserves explicit typed draft creation and hash-bound approval after normalization", async () => {
    await withApp({}, async (base) => {
      const voice = await jsonResponse(await fetch(`${base}/api/voice/transcribe`, { method: "POST", headers: voiceHeaders, body: ogg }), 200);
      const draft = await jsonResponse(await fetch(`${base}/api/drafts`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ transcript: voice.transcript, studentCode: "S-007" }) }), 201);
      assert.equal(draft.status, "pending");
      const approve = (contentHash) => fetch(`${base}/api/drafts/${draft.id}/approve`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contentHash, approvedBy: "teacher" }) });
      await jsonResponse(await approve("not-the-current-hash"), 409);
      const approved = await jsonResponse(await approve(draft.contentHash), 200);
      assert.equal(approved.status, "approved");
      assert.equal(approved.sent, false);
      assert.equal(approved.sendsMessages, false);
      const badJson = await jsonResponse(await fetch(`${base}/api/drafts`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{" }), 400);
      assert.ok(badJson.error.code);
    });
  });
});

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}
const uiReply = (data) => ({ ok: true, json: async () => data });
async function syntheticUi(request) {
  const elements = new Map();
  const element = (id) => {
    if (!elements.has(id)) elements.set(id, {
      value: "", textContent: "", innerHTML: "", hidden: true, disabled: false,
      checked: false, files: [], handlers: {},
      addEventListener(event, handler) { this.handlers[event] = handler; },
      removeAttribute(name) { delete this[name]; },
    });
    return elements.get(id);
  };
  const html = readFileSync(new URL("../examples/moosi-say-demo/public/index.html", import.meta.url), "utf8");
  const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  const context = {
    students: [{ studentCode: "S-007", nickname: "Synthetic", level: "L1", unit: "Unit 5" }],
    unit: { title: "Unit 5", topicLabel: "synthetic", words: ["apple", "banana", "grapes"], sentencePatterns: ["I want some {fruit}, please."] },
    sampleTranscript: SAMPLE_TRANSCRIPT,
    notices: ["Synthetic only; no send"],
  };
  runInNewContext(script, {
    document: { getElementById: element },
    fetch: async (url, options) => url === "/api/context" ? uiReply(context) : request(url, options),
  });
  await new Promise(setImmediate);
  element("student").value = "S-007";
  element("approver").value = "teacher";
  return {
    element,
    fire: (id, event) => element(id).handlers[event](),
    selectSyntheticFile() {
      element("voiceFile").files = [{ size: ogg.length, arrayBuffer: async () => Uint8Array.from(ogg).buffer }];
      element("ackSynthetic").checked = true;
    },
  };
}

describe("moosi-say audio: offline UI source-version safety", () => {
  it("invalidates old approval on upload start and ignores audio response after text edits", async () => {
    const response = deferred();
    const started = deferred();
    const ui = await syntheticUi((url) => {
      assert.equal(url, "/api/voice/transcribe");
      started.resolve();
      return response.promise;
    });
    ui.selectSyntheticFile();
    ui.element("approveBtn").disabled = false;
    ui.element("cardImg").hidden = false;
    const upload = ui.fire("voiceBtn", "click");
    assert.equal(ui.element("approveBtn").disabled, true);
    assert.equal(ui.element("cardImg").hidden, true);
    await started.promise;
    ui.element("transcript").value = "new synthetic teacher edit";
    ui.fire("transcript", "input");
    response.resolve(uiReply({ transcript: "stale mock", transcriptionIsMock: true, sendsMessages: false, normalization: normalized.meta, warning: "mock" }));
    await upload;
    assert.equal(ui.element("transcript").value, "new synthetic teacher edit");
    assert.equal(ui.element("approveBtn").disabled, true);
    assert.equal(ui.element("voiceBtn").disabled, false);
  });

  it("never enables approval from a pending draft after the selected student changes", async () => {
    const response = deferred();
    const started = deferred();
    const ui = await syntheticUi((url) => {
      assert.equal(url, "/api/drafts");
      started.resolve();
      return response.promise;
    });
    const request = ui.fire("draftBtn", "click");
    await started.promise;
    ui.element("student").value = "S-008";
    ui.fire("student", "change");
    response.resolve(uiReply({ id: "D-001", contentHash: "stale-hash", status: "pending", card: {} }));
    await request;
    assert.equal(ui.element("approveBtn").disabled, true);
    assert.equal(ui.element("cardImg").hidden, true);
    assert.equal(ui.element("hash").textContent, "—");
  });

  it("shows missing-evidence teacher review without rendering or enabling approval", async () => {
    const ui = await syntheticUi((url) => {
      assert.equal(url, "/api/drafts");
      return Promise.resolve(uiReply({
        id: "D-001",
        status: "needs_teacher_input",
        needsTeacherInput: true,
        card: null,
        contentHash: null,
        review: { message: "請補上 banana 需要練習的觀察。" },
      }));
    });

    await ui.fire("draftBtn", "click");

    assert.match(ui.element("status").textContent, /需要老師補充證據/);
    assert.equal(ui.element("teacherReview").hidden, false);
    assert.match(ui.element("teacherReview").textContent, /banana/);
    assert.equal(ui.element("cardImg").hidden, true);
    assert.equal(ui.element("approveBtn").disabled, true);
    assert.equal(ui.element("hash").textContent, "—");
  });

  it("resets the synthetic acknowledgement and old preview when a new file is selected", async () => {
    const ui = await syntheticUi(() => { throw new Error("No request expected"); });
    ui.selectSyntheticFile();
    ui.element("approveBtn").disabled = false;
    ui.element("cardImg").hidden = false;
    ui.fire("voiceFile", "change");
    assert.equal(ui.element("ackSynthetic").checked, false);
    assert.equal(ui.element("approveBtn").disabled, true);
    assert.equal(ui.element("cardImg").hidden, true);
  });

  it("shows request failures and restores the upload control without enabling approval", async () => {
    const ui = await syntheticUi(() => { throw new Error("synthetic offline request failure"); });
    ui.selectSyntheticFile();
    await ui.fire("voiceBtn", "click");
    assert.equal(ui.element("voiceBtn").disabled, false);
    assert.equal(ui.element("approveBtn").disabled, true);
    assert.match(ui.element("voiceWarn").textContent, /synthetic offline request failure/);
  });
});
