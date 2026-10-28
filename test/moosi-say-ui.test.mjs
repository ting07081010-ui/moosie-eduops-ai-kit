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

async function createUiHarness() {
  const elements = new Map();
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
      return { ok: true, json: async () => context };
    }
    if (url === "/api/drafts" && options.method === "POST") {
      return { ok: true, json: async () => pendingDraft };
    }
    if (url === "/api/drafts/D-001/approve") {
      return {
        ok: true,
        json: async () => ({ ...pendingDraft, status: "approved", approvedBy: "teacher" }),
      };
    }
    throw new Error(`Unexpected test request: ${url}`);
  };

  vm.runInNewContext(clientScript, { document, fetch }, { filename: htmlPath });
  await new Promise((resolve) => setImmediate(resolve));

  return {
    elements,
    requests,
    async dispatch(id, type) {
      const listener = elements.get(id)?.listeners.get(type);
      assert.ok(listener, `expected ${type} handler on #${id}`);
      await listener({});
    },
  };
}

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
});
