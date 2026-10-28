import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const htmlPath = path.join(
  __dirname,
  "..",
  "examples",
  "moosi-say-demo",
  "public",
  "index.html"
);
const html = fs.readFileSync(htmlPath, "utf8");
const clientScript = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(clientScript, "demo page should contain its client script");

class MockElement {
  constructor(id = "") {
    this.id = id;
    this.value = "";
    this.textContent = "";
    this.innerHTML = "";
    this.hidden = false;
    this.disabled = false;
    this.checked = false;
    this.files = [];
    this.children = [];
    this.listeners = new Map();
    this.src = "";
  }

  addEventListener(type, listener) {
    this.listeners.set(type, listener);
  }

  appendChild(child) {
    this.children.push(child);
    if (this.id === "student" && this.children.length === 1) {
      this.value = child.value;
    }
    return child;
  }

  removeAttribute(name) {
    if (name === "src") this.src = "";
  }
}

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

async function createUiHarness({ draftResponse, approvalResponse, contextResponse, voiceResponse } = {}) {
  const elements = new Map();
  for (const [, id] of html.matchAll(/\bid="([^"]+)"/g)) {
    elements.set(id, new MockElement(id));
  }
  elements.get("approveBtn").textContent = "核准此版本";
  elements.get("approveBtn").disabled = true;
  elements.get("status").textContent = "尚未產生草稿";
  elements.get("hash").textContent = "—";
  elements.get("notices").textContent = "載入中…";
  elements.get("cardImg").hidden = true;
  elements.get("cardJson").hidden = true;
  const document = {
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, new MockElement(id));
      return elements.get(id);
    },
    createElement(tagName) {
      return new MockElement(tagName);
    },
  };
  const context = {
    unit: {
      title: "Unit 5",
      topicLabel: "水果",
      words: ["apple", "banana", "grapes"],
      sentencePatterns: ["I want some {fruit}, please."],
    },
    students: [
      { studentCode: "S-007", nickname: "Demo A", level: "A1", unit: "Unit 5", weakWords: ["grapes"] },
      { studentCode: "S-008", nickname: "Demo B", level: "A1", unit: "Unit 5", weakWords: ["banana"] },
    ],
    sampleTranscript: "Synthetic teacher note.",
    notices: ["Synthetic demo data only."],
  };
  const pendingDraft = {
    id: "D-001",
    status: "pending",
    contentHash: "preview-hash-before-edit",
    card: { practice_focus: "grapes" },
    review: null,
  };
  const requests = [];
  const fetch = async (url, options = {}) => {
    requests.push({ url, options });
    if (url === "/api/context") {
      if (contextResponse) return contextResponse({ url, options, context });
      return { ok: true, json: async () => context };
    }
    if (url === "/api/drafts" && options.method === "POST") {
      if (draftResponse) return draftResponse({ url, options, requests });
      return { ok: true, json: async () => pendingDraft };
    }
    if (url === "/api/voice/transcribe" && voiceResponse) {
      return voiceResponse({ url, options, requests });
    }
    const approval = url.match(/^\/api\/drafts\/([^/]+)\/approve$/);
    if (approval) {
      if (approvalResponse) return approvalResponse({ url, options, requests });
      return {
        ok: true,
        json: async () => ({ ...pendingDraft, id: approval[1], status: "approved", approvedBy: "teacher" }),
      };
    }
    throw new Error(`Unexpected test request: ${url}`);
  };

  const contextLoadPromise = vm.runInNewContext(clientScript, { document, fetch }, { filename: htmlPath });
  await new Promise((resolve) => setImmediate(resolve));

  return {
    elements,
    requests,
    contextLoadPromise,
    async dispatch(id, type) {
      const listener = elements.get(id)?.listeners.get(type);
      assert.ok(listener, `expected ${type} handler on #${id}`);
      await listener({});
    },
    async attemptUserEvent(id, type, mutate) {
      const element = elements.get(id);
      assert.ok(element, `expected element #${id}`);
      if (element.disabled) return false;
      if (mutate) mutate(element);
      const listener = element.listeners.get(type);
      if (listener) await listener({});
      return true;
    },
  };
}

describe("moosi-say demo UI: context and sample loading", () => {
  it("shows a context failure notice and leaves draft approval unavailable", async () => {
    const ui = await createUiHarness({
      contextResponse: () => { throw new Error("synthetic context unavailable"); },
    });
    await ui.contextLoadPromise;
    const get = (id) => ui.elements.get(id);

    assert.equal(get("error").textContent, "錯誤 [CONTEXT_ERROR] synthetic context unavailable");
    assert.equal(get("notices").textContent, "示範資料載入失敗。");
    assert.equal(get("student").children.length, 0);
    assert.equal(get("transcript").value, "");
    assert.equal(get("status").textContent, "尚未產生草稿");
    assert.equal(get("hash").textContent, "—");
    assert.equal(get("cardImg").hidden, true);
    assert.equal(get("cardJson").hidden, true);
    assert.equal(get("approveBtn").disabled, true);
  });

  it("loads the sample transcript and clears an old preview", async () => {
    const sampleResponse = deferred();
    let contextCalls = 0;
    const ui = await createUiHarness({
      contextResponse: ({ context }) => {
        contextCalls++;
        return contextCalls === 1
          ? { ok: true, json: async () => context }
          : sampleResponse.promise;
      },
    });
    await ui.contextLoadPromise;
    const get = (id) => ui.elements.get(id);
    await ui.dispatch("draftBtn", "click");
    assert.equal(get("approveBtn").disabled, false);

    const loading = ui.dispatch("sampleBtn", "click");
    assert.equal(get("status").textContent, "正在載入範例文字…");
    assert.equal(get("hash").textContent, "—");
    assert.equal(get("cardImg").hidden, true);
    assert.equal(get("cardJson").hidden, true);
    assert.equal(get("approveBtn").disabled, true);

    sampleResponse.resolve({ ok: true, json: async () => ({ sampleTranscript: "Manual synthetic sample." }) });
    await loading;

    assert.equal(get("transcript").value, "Manual synthetic sample.");
    assert.equal(get("status").textContent, "已載入範例文字，請重新產生草稿");
    assert.equal(get("hash").textContent, "—");
    assert.equal(get("cardImg").hidden, true);
    assert.equal(get("cardImg").src, "");
    assert.equal(get("cardJson").hidden, true);
    assert.equal(get("cardJson").textContent, "");
    assert.equal(get("approveBtn").disabled, true);
    assert.equal(get("error").textContent, "");
  });

  it("reports sample loading failure and keeps the preview invalidated", async () => {
    let contextCalls = 0;
    const ui = await createUiHarness({
      contextResponse: ({ context }) => {
        contextCalls++;
        if (contextCalls === 1) return { ok: true, json: async () => context };
        throw new Error("synthetic sample unavailable");
      },
    });
    await ui.contextLoadPromise;
    const get = (id) => ui.elements.get(id);
    await ui.dispatch("draftBtn", "click");
    const originalTranscript = get("transcript").value;
    await ui.dispatch("sampleBtn", "click");

    assert.equal(get("transcript").value, originalTranscript);
    assert.equal(get("status").textContent, "範例文字載入失敗，請重試");
    assert.equal(get("hash").textContent, "—");
    assert.equal(get("cardImg").hidden, true);
    assert.equal(get("cardJson").hidden, true);
    assert.equal(get("approveBtn").disabled, true);
    assert.equal(get("error").textContent, "錯誤 [CONTEXT_ERROR] synthetic sample unavailable");
  });
});

describe("moosi-say demo UI: draft and voice success/failure states", () => {
  it("shows a draft request failure without leaving stale preview data", async () => {
    const ui = await createUiHarness({
      draftResponse: () => ({
        ok: false,
        json: async () => ({ error: { code: "DRAFT_REJECTED", message: "synthetic draft rejected" } }),
      }),
    });
    await ui.contextLoadPromise;
    const get = (id) => ui.elements.get(id);
    get("hash").textContent = "old-preview-hash";
    get("cardImg").hidden = false;
    get("cardImg").src = "/api/drafts/D-OLD/card.svg";
    get("cardJson").hidden = false;
    get("cardJson").textContent = "old preview";
    get("approveBtn").disabled = false;

    await ui.dispatch("draftBtn", "click");

    assert.equal(get("status").textContent, "草稿產生失敗，請重試");
    assert.equal(get("hash").textContent, "—");
    assert.equal(get("cardImg").hidden, true);
    assert.equal(get("cardImg").src, "");
    assert.equal(get("cardJson").hidden, true);
    assert.equal(get("cardJson").textContent, "");
    assert.equal(get("approveBtn").disabled, true);
    assert.equal(get("error").textContent, "錯誤 [DRAFT_REJECTED] synthetic draft rejected");
  });

  it("shows a retryable failure state when the draft request itself rejects", async () => {
    const ui = await createUiHarness({
      draftResponse: () => { throw new Error("synthetic offline draft failure"); },
    });
    await ui.contextLoadPromise;
    const get = (id) => ui.elements.get(id);
    await ui.dispatch("draftBtn", "click");

    assert.equal(get("status").textContent, "草稿產生失敗，請重試");
    assert.equal(get("hash").textContent, "—");
    assert.equal(get("cardImg").hidden, true);
    assert.equal(get("cardJson").hidden, true);
    assert.equal(get("approveBtn").disabled, true);
    assert.equal(get("error").textContent, "錯誤 [REQUEST_FAILED] synthetic offline draft failure");
  });

  it("inserts only the fixed mock transcript after successful synthetic voice processing", async () => {
    const mockTranscript = "Fixed synthetic mock transcript.";
    let voiceRequest;
    const ui = await createUiHarness({
      voiceResponse: ({ url, options }) => {
        voiceRequest = { url, options };
        return {
          ok: true,
          json: async () => ({
            transcript: mockTranscript,
            transcriptionIsMock: true,
            sendsMessages: false,
            normalization: { sampleRate: 16000, channels: 1, bitsPerSample: 16, durationSec: 0.25 },
            warning: "Fixed mock only; no messages sent.",
          }),
        };
      },
    });
    await ui.contextLoadPromise;
    const get = (id) => ui.elements.get(id);
    await ui.dispatch("draftBtn", "click");
    get("voiceFile").files = [{ size: 4, arrayBuffer: async () => new Uint8Array([1, 2, 3, 4]).buffer }];
    get("ackSynthetic").checked = true;

    await ui.dispatch("voiceBtn", "click");

    assert.equal(voiceRequest.url, "/api/voice/transcribe");
    assert.deepEqual(JSON.parse(JSON.stringify(voiceRequest.options.headers)), {
      "Content-Type": "audio/ogg",
      "X-Demo-Synthetic": "true",
      "X-Input-Role": "adult-teacher",
    });
    assert.equal(get("transcript").value, mockTranscript);
    assert.equal(get("status").textContent, "已載入固定模擬逐字稿，請確認並重新產生草稿");
    assert.equal(get("hash").textContent, "—");
    assert.equal(get("cardImg").hidden, true);
    assert.equal(get("cardImg").src, "");
    assert.equal(get("cardJson").hidden, true);
    assert.equal(get("cardJson").textContent, "");
    assert.equal(get("approveBtn").disabled, true);
    assert.match(get("voiceMeta").textContent, /固定 mock：true；傳送訊息：false/);
    assert.equal(get("voiceWarn").textContent, "Fixed mock only; no messages sent.");
    assert.equal(get("voiceBtn").disabled, false);
    assert.equal(get("error").textContent, "");
  });
});

describe("moosi-say demo UI: delayed initial context", () => {
  it("preserves teacher text entered before the context response completes", async () => {
    const response = deferred();
    const ui = await createUiHarness({ contextResponse: () => response.promise });
    const transcript = ui.elements.get("transcript");
    const teacherText = "Teacher entered while context was loading.";

    assert.equal(transcript.value, "");
    transcript.value = teacherText;
    await ui.dispatch("transcript", "input");
    response.resolve({ ok: true, json: async () => ({
      students: [],
      unit: { title: "Unit 5", topicLabel: "Fruit", words: [], sentencePatterns: [] },
      sampleTranscript: "Synthetic teacher note.",
      notices: [],
    }) });
    await ui.contextLoadPromise;

    assert.equal(transcript.value, teacherText);
  });

  it("initializes the sample transcript when the teacher has not edited it", async () => {
    const response = deferred();
    const ui = await createUiHarness({ contextResponse: () => response.promise });
    const transcript = ui.elements.get("transcript");

    assert.equal(transcript.value, "");
    response.resolve({ ok: true, json: async () => ({
      students: [],
      unit: { title: "Unit 5", topicLabel: "Fruit", words: [], sentencePatterns: [] },
      sampleTranscript: "Synthetic teacher note.",
      notices: [],
    }) });
    await ui.contextLoadPromise;

    assert.equal(transcript.value, "Synthetic teacher note.");
  });
});

async function assertStalePreviewCannotBeApproved({ elementId, eventType, newValue }) {
  const ui = await createUiHarness();
  const get = (id) => ui.elements.get(id);

  await ui.dispatch("draftBtn", "click");
  assert.equal(get("status").textContent, "待核准（D-001）");
  assert.equal(get("hash").textContent, "preview-hash-before-edit");
  assert.equal(get("approveBtn").disabled, false);
  assert.equal(get("cardImg").hidden, false);
  assert.equal(get("cardJson").hidden, false);

  get(elementId).value = newValue;
  await ui.dispatch(elementId, eventType);

  assert.match(get("status").textContent, /已變更|已變更/);
  assert.equal(get("hash").textContent, "—", "old preview hash must be cleared");
  assert.equal(get("cardImg").hidden, true, "old card image must be hidden");
  assert.equal(get("cardImg").src, "", "old card image source must be removed");
  assert.equal(get("cardJson").hidden, true, "old card JSON must be hidden");
  assert.equal(get("cardJson").textContent, "", "old card JSON must be cleared");
  assert.equal(get("approveBtn").disabled, true, "approval must be disabled");

  await ui.dispatch("approveBtn", "click");
  assert.equal(
    ui.requests.filter(({ url }) => url.endsWith("/approve")).length,
    0,
    "stale preview must not issue an approval request"
  );
}

describe("moosi-say demo UI: stale preview invalidation", () => {
  it("clears the old preview and blocks approval when the selected student changes", async () => {
    await assertStalePreviewCannotBeApproved({
      elementId: "student",
      eventType: "change",
      newValue: "S-008",
    });
  });

  it("clears the old preview and blocks approval when the transcript is edited", async () => {
    await assertStalePreviewCannotBeApproved({
      elementId: "transcript",
      eventType: "input",
      newValue: "Edited synthetic teacher note.",
    });
  });

  it("lets only the latest of three rapid draft requests update the preview", async () => {
    const responses = [deferred(), deferred(), deferred()];
    let requestIndex = 0;
    const ui = await createUiHarness({
      draftResponse: () => responses[requestIndex++].promise,
      approvalResponse: ({ url, options }) => {
        const id = url.match(/^\/api\/drafts\/([^/]+)\/approve$/)[1];
        const { contentHash, approvedBy } = JSON.parse(options.body);
        return {
          ok: true,
          json: async () => ({ id, status: "approved", contentHash, approvedBy }),
        };
      },
    });
    const get = (id) => ui.elements.get(id);

    get("transcript").value = "First synthetic teacher note.";
    const first = ui.dispatch("draftBtn", "click");
    get("transcript").value = "Second synthetic teacher note.";
    await ui.dispatch("transcript", "input");
    const second = ui.dispatch("draftBtn", "click");
    get("student").value = "S-008";
    await ui.dispatch("student", "change");
    const latest = ui.dispatch("draftBtn", "click");

    const draftRequests = ui.requests.filter(({ url }) => url === "/api/drafts");
    assert.equal(draftRequests.length, 3);
    assert.deepEqual(
      draftRequests.map(({ options }) => JSON.parse(options.body)),
      [
        { studentCode: "S-007", transcript: "First synthetic teacher note." },
        { studentCode: "S-007", transcript: "Second synthetic teacher note." },
        { studentCode: "S-008", transcript: "Second synthetic teacher note." },
      ]
    );

    const responseFor = (id) => ({
      ok: true,
      json: async () => ({
        id,
        status: "pending",
        contentHash: `hash-${id}`,
        card: { practice_focus: id },
      }),
    });

    responses[1].resolve(responseFor("D-SECOND"));
    await second;
    assert.equal(get("status").textContent, "正在產生草稿…");
    assert.equal(get("hash").textContent, "—");
    assert.equal(get("cardImg").hidden, true);
    assert.equal(get("cardJson").hidden, true);
    assert.equal(get("approveBtn").disabled, true);

    responses[2].resolve(responseFor("D-LATEST"));
    await latest;
    assert.equal(get("status").textContent, "待核准（D-LATEST）");
    assert.equal(get("hash").textContent, "hash-D-LATEST");
    assert.equal(get("cardImg").src, "/api/drafts/D-LATEST/card.svg");
    assert.deepEqual(JSON.parse(get("cardJson").textContent), { practice_focus: "D-LATEST" });
    assert.equal(get("approveBtn").disabled, false);

    responses[0].resolve(responseFor("D-FIRST"));
    await first;
    assert.equal(get("status").textContent, "待核准（D-LATEST）");
    assert.equal(get("hash").textContent, "hash-D-LATEST");
    assert.equal(get("cardImg").src, "/api/drafts/D-LATEST/card.svg");
    assert.deepEqual(JSON.parse(get("cardJson").textContent), { practice_focus: "D-LATEST" });

    get("approver").value = "admin";
    await ui.dispatch("approveBtn", "click");
    const approvalRequests = ui.requests.filter(({ url }) => url.endsWith("/approve"));
    assert.equal(approvalRequests.length, 1, "exactly one approval request should be sent");
    assert.deepEqual(approvalRequests.map(({ url, options }) => ({
      url,
      body: JSON.parse(options.body),
    })), [{
      url: "/api/drafts/D-LATEST/approve",
      body: { contentHash: "hash-D-LATEST", approvedBy: "admin" },
    }], "only the latest draft's exact hash and chosen approver may be approved");
    assert.equal(
      get("status").textContent,
      "已核准（D-LATEST，admin）· 本地示範狀態，未傳送",
      "successful server approval should update the UI for the latest draft"
    );
    assert.equal(get("error").textContent, "");
    assert.equal(get("approveBtn").disabled, true, "approved draft cannot be approved again");
  });
});

describe("moosi-say demo UI: approval in progress", () => {
  it("locks draft-changing controls and displays the completed server approval", async () => {
    const approval = deferred();
    const ui = await createUiHarness({ approvalResponse: () => approval.promise });
    const get = (id) => ui.elements.get(id);

    get("approver").value = "teacher";
    await ui.dispatch("draftBtn", "click");
    const inFlight = ui.dispatch("approveBtn", "click");
    const approveRequest = ui.requests.find(({ url }) => url.endsWith("/approve"));
    assert.ok(approveRequest, "approval request should start");
    assert.deepEqual(JSON.parse(approveRequest.options.body), {
      contentHash: "preview-hash-before-edit",
      approvedBy: "teacher",
    });

    const guardedControls = ["student", "transcript", "sampleBtn", "draftBtn", "voiceFile", "ackSynthetic", "voiceBtn", "approver"];
    for (const id of guardedControls) {
      assert.equal(get(id).disabled, true, `#${id} should be locked during approval`);
    }
    assert.equal(get("approveBtn").disabled, true);
    assert.equal(get("approveBtn").textContent, "核准中…");
    assert.equal(get("status").textContent, "正在核准（D-001）…");

    const blockedUserEvents = [
      ["student", "change", (element) => { element.value = "S-008"; }],
      ["transcript", "input", (element) => { element.value = "Changed during approval."; }],
      ["sampleBtn", "click"],
      ["draftBtn", "click"],
      ["voiceFile", "change"],
      ["ackSynthetic", "change"],
      ["voiceBtn", "click"],
      ["approver", "change", (element) => { element.value = "admin"; }],
    ];
    for (const [id, type, mutate] of blockedUserEvents) {
      assert.equal(await ui.attemptUserEvent(id, type, mutate), false, `user change to #${id} should be blocked`);
    }
    assert.equal(get("student").value, "S-007");
    assert.equal(get("transcript").value, "Synthetic teacher note.");
    assert.equal(get("approver").value, "teacher");
    assert.equal(ui.requests.filter(({ url }) => url === "/api/drafts").length, 1);
    assert.equal(ui.requests.filter(({ url }) => url.endsWith("/approve")).length, 1);

    // A change event queued just before the controls were disabled must not invalidate the approval.
    await ui.dispatch("transcript", "input");
    assert.equal(get("status").textContent, "正在核准（D-001）…");

    approval.resolve({
      ok: true,
      json: async () => ({
        id: "D-001",
        status: "approved",
        contentHash: "preview-hash-before-edit",
        card: { practice_focus: "grapes" },
        approvedBy: "teacher",
      }),
    });
    await inFlight;

    assert.equal(get("status").textContent, "已核准（D-001，teacher）· 本地示範狀態，未傳送");
    assert.equal(get("error").textContent, "");
    assert.equal(get("approveBtn").disabled, true, "approved draft cannot be approved again");
    assert.equal(get("approveBtn").textContent, "核准此版本");
    for (const id of guardedControls) {
      assert.equal(get(id).disabled, false, `#${id} should be restored after success`);
    }
  });

  it("restores controls and keeps the draft retryable when approval fails", async () => {
    const approval = deferred();
    const ui = await createUiHarness({ approvalResponse: () => approval.promise });
    const get = (id) => ui.elements.get(id);

    get("approver").value = "admin";
    await ui.dispatch("draftBtn", "click");
    const inFlight = ui.dispatch("approveBtn", "click");
    for (const id of ["student", "transcript", "sampleBtn", "draftBtn", "voiceFile", "ackSynthetic", "voiceBtn", "approver"]) {
      assert.equal(get(id).disabled, true, `#${id} should be locked during approval`);
    }

    approval.resolve({
      ok: false,
      json: async () => ({ error: { code: "APPROVAL_CONFLICT", message: "The draft hash changed." } }),
    });
    await inFlight;

    assert.equal(get("status").textContent, "待核准（D-001）");
    assert.equal(get("hash").textContent, "preview-hash-before-edit");
    assert.equal(get("error").textContent, "錯誤 [APPROVAL_CONFLICT] The draft hash changed.");
    assert.equal(get("approveBtn").disabled, false, "failed approval should be retryable");
    assert.equal(get("approveBtn").textContent, "核准此版本");
    for (const id of ["student", "transcript", "sampleBtn", "draftBtn", "voiceFile", "ackSynthetic", "voiceBtn", "approver"]) {
      assert.equal(get(id).disabled, false, `#${id} should be restored after failure`);
    }
  });
});
