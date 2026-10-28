import { describe, it } from "node:test";
import assert from "node:assert";
import {
  MoosiSayError,
  SAMPLE_TRANSCRIPT,
  allowedTranscriptTokens,
  canonicalJson,
  contentHash,
  createStore,
  englishTokens,
  generateCard,
  renderCardSvg,
  segmentTranscript,
  validateStudentRoster,
} from "../examples/moosi-say-demo/lib/moosi-say.mjs";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "../examples/moosi-say-demo/server.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const demoRoot = path.join(__dirname, "..", "examples", "moosi-say-demo");
const unit = JSON.parse(fs.readFileSync(path.join(demoRoot, "data/unit5.json"), "utf8"));
const students = JSON.parse(
  fs.readFileSync(path.join(demoRoot, "data/students.json"), "utf8")
);

const validInput = { transcript: SAMPLE_TRANSCRIPT, studentCode: "S-007", unit, students };
const duplicateRoster = [
  { studentCode: "S-007", nickname: "Fixture A", weakWords: ["grapes"] },
  { studentCode: "S-007", nickname: "Fixture B", weakWords: ["banana"] },
];

describe("moosi-say demo: valid generation", () => {
  it("unit data holds exactly the allowlisted words and one pattern", () => {
    assert.deepEqual(unit.words, ["apple", "banana", "grapes"]);
    assert.deepEqual(unit.sentencePatterns, ["I want some {fruit}, please."]);
  });

  it("produces a deterministic card with 3 words, 1 pattern, evidence ids", () => {
    const card = generateCard(validInput);
    assert.deepEqual(card.key_words, ["apple", "banana", "grapes"]);
    assert.equal(card.sentence, "I want some grapes, please.");
    assert.match(card.weak_point_zh, /grapes/);
    assert.match(card.home_mission_zh, /I want some grapes, please\./);
    assert.equal(card.needs_teacher_input, false);
    assert.equal(card.method, "rule-template");
    assert.ok(Array.isArray(card.evidence) && card.evidence.length === 4);
    for (const item of card.evidence) {
      assert.ok(item.segmentIds.length > 0, `${item.field} needs evidence`);
      for (const id of item.segmentIds) assert.match(id, /^T-\d{2}$/);
    }
  });

  it("picks grapes (not apple/banana) as the practice target", () => {
    // The sample note says apple and banana are already known (能說出) and
    // only grapes carries a practice cue, so the practice word, sentence,
    // and weak point must all target grapes.
    const card = generateCard(validInput);
    assert.ok(card.sentence.includes("grapes"));
    assert.ok(!card.sentence.includes("apple"));
    assert.match(card.weak_point_zh, /grapes/);
    assert.match(card.summary_zh, /apple.*banana/);
  });

  it("is deterministic: same input gives the same content hash", () => {
    const a = generateCard(validInput);
    const b = generateCard(validInput);
    assert.equal(contentHash(a), contentHash(b));
    assert.match(contentHash(a), /^[0-9a-f]{64}$/);
  });

  it("segments the transcript with stable ids", () => {
    const segments = segmentTranscript(SAMPLE_TRANSCRIPT);
    assert.deepEqual(
      segments.map((s) => s.id),
      ["T-01", "T-02"]
    );
  });

  it("allowlist covers unit words, pattern words, and known extras only", () => {
    const allowed = allowedTranscriptTokens(unit);
    for (const w of ["apple", "banana", "grapes", "i", "want", "some", "please"]) {
      assert.ok(allowed.has(w), `allowlist should contain ${w}`);
    }
    assert.ok(!allowed.has("orange"), "allowlist must not contain orange");
  });
});

describe("moosi-say demo: out-of-scope words", () => {
  it("rejects a transcript word outside the Unit JSON", () => {
    assert.throws(
      () =>
        generateCard({
          ...validInput,
          transcript: `${SAMPLE_TRANSCRIPT}\n今天也練習了 orange。`,
        }),
      (err) =>
        err instanceof MoosiSayError &&
        err.code === "OUT_OF_SCOPE" &&
        err.details.words.includes("orange")
    );
  });

  it("rejects an out-of-allowlist sentence fruit", () => {
    const bad = SAMPLE_TRANSCRIPT.replace(
      "I want some grapes, please",
      "I want some pineapple, please"
    );
    assert.throws(() => generateCard({ ...validInput, transcript: bad }), (err) => {
      assert.equal(err.code, "OUT_OF_SCOPE");
      assert.ok(err.details.words.includes("pineapple"));
      return true;
    });
  });

  it("fails closed on missing word evidence instead of inventing it", () => {
    assert.throws(
      () =>
        generateCard({
          ...validInput,
          transcript: "S-007 在 Unit 5 水果課上能說出 apple，grapes 還需要多練習。",
        }),
      (err) => {
        assert.equal(err.code, "MISSING_EVIDENCE");
        assert.ok(err.details.missing.includes("banana"));
        return true;
      }
    );
  });

  it("rejects unknown student codes and empty transcripts", () => {
    assert.throws(
      () => generateCard({ ...validInput, studentCode: "S-999" }),
      (err) => err.code === "UNKNOWN_STUDENT"
    );
    assert.throws(
      () => generateCard({ ...validInput, transcript: "   " }),
      (err) => err.code === "EMPTY_TRANSCRIPT"
    );
  });

  it("never creates a draft when validation fails", () => {
    const store = createStore();
    assert.throws(() =>
      store.issue({
        ...validInput,
        transcript: `${SAMPLE_TRANSCRIPT}\n今天也練習了 orange。`,
      })
    );
    assert.throws(() => store.get("D-001"), (err) => err.code === "NOT_FOUND");
  });
});

describe("moosi-say demo: roster-backed practice focus", () => {
  it("rejects duplicate student codes before either profile can be selected", () => {
    assert.equal(validateStudentRoster(students), students);
    for (const roster of [duplicateRoster, [...duplicateRoster].reverse()]) {
      for (const useRoster of [
        () => generateCard({ ...validInput, students: roster }),
        () => createStore().issue({ ...validInput, students: roster }),
      ]) {
        assert.throws(useRoster, (err) => {
          assert.ok(err instanceof MoosiSayError);
          assert.equal(err.code, "DUPLICATE_STUDENT_CODE");
          assert.match(err.message, /S-007/);
          assert.deepEqual(err.details.studentCodes, ["S-007"]);
          return true;
        });
      }
    }
  });

  it("returns a teacher-input draft when the selected student's weak word lacks transcript evidence", () => {
    const store = createStore();
    const draft = store.issue({ ...validInput, studentCode: "S-008" });

    assert.equal(draft.status, "needs_teacher_input");
    assert.equal(draft.card, null);
    assert.equal(draft.review.code, "MISSING_FOCUS_EVIDENCE");
    assert.deepEqual(draft.review.focusCandidates, ["banana"]);
    assert.throws(
      () => store.approve(draft.id, { contentHash: draft.contentHash, approvedBy: "teacher" }),
      (err) => err.code === "NEEDS_TEACHER_INPUT"
    );
  });

  it("returns a teacher-input draft when a required curriculum word has no transcript evidence", () => {
    const transcript = SAMPLE_TRANSCRIPT.replace("apple 和 banana，", "apple，");
    const draft = createStore().issue({ ...validInput, transcript });

    assert.equal(draft.status, "needs_teacher_input");
    assert.equal(draft.card, null);
    assert.equal(draft.review.code, "MISSING_EVIDENCE");
    assert.deepEqual(draft.review.missing, ["banana"]);
  });

  it("chooses an evidence-backed weak word from the selected student's roster", () => {
    const draft = createStore().issue({ ...validInput, studentCode: "S-010" });

    assert.equal(draft.status, "pending");
    assert.equal(draft.card.practice_focus, "grapes");
    assert.deepEqual(
      draft.card.evidence.find((item) => item.field === "weak_point_zh").segmentIds,
      ["T-01"]
    );
  });

  it("uses a roster weak word once the teacher adds explicit transcript evidence", () => {
    const transcript = `${SAMPLE_TRANSCRIPT.replaceAll("S-007", "S-008")}\nbanana 還需要多練習。`;
    const draft = createStore().issue({ ...validInput, transcript, studentCode: "S-008" });

    assert.equal(draft.status, "pending");
    assert.equal(draft.card.practice_focus, "banana");
    assert.ok(draft.card.evidence.find((item) => item.field === "weak_point_zh").segmentIds.length > 0);
  });
});

describe("moosi-say demo: teacher-input API guard", () => {
  it("returns an unresolved record and blocks preview/approval when focus evidence is missing", async () => {
    const { app } = createApp();
    const server = app.listen(0, "127.0.0.1");
    await new Promise((resolve) => server.on("listening", resolve));
    try {
      const base = `http://127.0.0.1:${server.address().port}`;
      const created = await fetch(`${base}/api/drafts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentCode: "S-008", transcript: SAMPLE_TRANSCRIPT }),
      });
      assert.equal(created.status, 201);
      const draft = await created.json();
      assert.equal(draft.status, "needs_teacher_input");
      assert.equal(draft.needsTeacherInput, true);
      assert.equal(draft.card, null);
      assert.equal(draft.contentHash, null);

      const preview = await fetch(`${base}/api/drafts/${draft.id}/card.svg`);
      assert.equal(preview.status, 409);
      assert.equal((await preview.json()).error.code, "NEEDS_TEACHER_INPUT");

      const approval = await fetch(`${base}/api/drafts/${draft.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentHash: draft.contentHash, approvedBy: "teacher" }),
      });
      assert.equal(approval.status, 409);
      assert.equal((await approval.json()).error.code, "NEEDS_TEACHER_INPUT");
    } finally {
      await new Promise((resolve, reject) => server.close((err) => err ? reject(err) : resolve()));
    }
  });
});

describe("moosi-say demo: hash-bound approval", () => {
  it("approves only with the exact current content hash", () => {
    const store = createStore();
    const draft = store.issue(validInput);
    assert.equal(draft.status, "pending");
    const approved = store.approve(draft.id, {
      contentHash: draft.contentHash,
      approvedBy: "teacher",
    });
    assert.equal(approved.status, "approved");
    assert.equal(approved.sent, false);
    assert.match(approved.demoNote, /不會實際傳送/);
  });

  it("rejects missing hashes", () => {
    const store = createStore();
    const draft = store.issue(validInput);
    assert.throws(
      () => store.approve(draft.id, { approvedBy: "teacher" }),
      (err) => err.code === "HASH_REQUIRED"
    );
  });

  it("rejects mismatched hashes (modified content cannot be approved)", () => {
    const store = createStore();
    const draft = store.issue(validInput);
    const tampered = {
      ...draft.card,
      home_mission_zh: "changed after preview",
    };
    assert.notEqual(contentHash(tampered), draft.contentHash);
    assert.throws(
      () =>
        store.approve(draft.id, {
          contentHash: contentHash(tampered),
          approvedBy: "teacher",
        }),
      (err) => err.code === "HASH_MISMATCH"
    );
    // The untouched draft is still pending, not approved by the attempt.
    assert.equal(store.get(draft.id).status, "pending");
  });

  it("rejects double approval and non-human approvers", () => {
    const store = createStore();
    const draft = store.issue(validInput);
    store.approve(draft.id, {
      contentHash: draft.contentHash,
      approvedBy: "admin",
    });
    assert.throws(
      () =>
        store.approve(draft.id, {
          contentHash: draft.contentHash,
          approvedBy: "teacher",
        }),
      (err) => err.code === "NOT_PENDING"
    );
    const draft2 = store.issue(validInput);
    assert.throws(
      () =>
        store.approve(draft2.id, {
          contentHash: draft2.contentHash,
          approvedBy: "ai",
        }),
      (err) => err.code === "INVALID_APPROVER"
    );
  });

  it("never approves a blocked draft", () => {
    const store = createStore();
    const draft = store.issue(validInput);
    store.block(draft.id, "review failed");
    assert.throws(
      () =>
        store.approve(draft.id, {
          contentHash: draft.contentHash,
          approvedBy: "teacher",
        }),
      (err) => err.code === "BLOCKED"
    );
  });
});

const httpFixtureStudents = [
  {
    studentCode: "S-007",
    nickname: "Fixture Student",
    level: "Beginner",
    unit: "Unit 5",
    weakWords: ["grapes"],
  },
];

async function withHttpApp(options, run) {
  const { app } = createApp({ students: httpFixtureStudents, ...options });
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.once("listening", resolve);
  });
  try {
    await run(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve()))
    );
  }
}

function postJson(base, route, payload) {
  return fetch(`${base}${route}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

describe("moosi-say demo: HTTP success paths", () => {
  it("serves the static page and health response with their public content", async () => {
    await withHttpApp({}, async (base) => {
      const pageResponse = await fetch(`${base}/`);
      assert.equal(pageResponse.status, 200);
      assert.match(pageResponse.headers.get("content-type"), /^text\/html\b/i);
      const page = await pageResponse.text();
      assert.match(page, /<h1>Moosi 說 · 課後學習圖卡示範 \(DEMO\)<\/h1>/);
      assert.match(page, /名冊與弱點詞皆為虛構 synthetic fixture/);

      const healthResponse = await fetch(`${base}/health`);
      assert.equal(healthResponse.status, 200);
      assert.match(healthResponse.headers.get("content-type"), /^application\/json\b/i);
      assert.deepEqual(await healthResponse.json(), {
        status: "ok",
        demo: "moosi-say",
        sendsMessages: false,
      });
    });
  });

  it("retrieves a created draft and renders its SVG over HTTP", async () => {
    await withHttpApp({}, async (base) => {
      const createResponse = await postJson(base, "/api/drafts", {
        transcript: SAMPLE_TRANSCRIPT,
        studentCode: "S-007",
      });
      assert.equal(createResponse.status, 201);
      const created = await createResponse.json();
      assert.equal(created.id, "D-001");
      assert.equal(created.status, "pending");

      const getResponse = await fetch(`${base}/api/drafts/${created.id}`);
      assert.equal(getResponse.status, 200);
      assert.match(getResponse.headers.get("content-type"), /^application\/json\b/i);
      const draft = await getResponse.json();
      assert.deepEqual(Object.keys(draft).sort(), [
        "card",
        "contentHash",
        "demoNote",
        "id",
        "needsTeacherInput",
        "review",
        "sendsMessages",
        "sent",
        "status",
      ]);
      assert.equal(draft.id, created.id);
      assert.equal(draft.status, "pending");
      assert.equal(draft.card.studentCode, "S-007");
      assert.equal(draft.card.practice_focus, "grapes");
      assert.match(draft.contentHash, /^[0-9a-f]{64}$/);
      assert.equal(draft.sent, false);
      assert.equal(draft.sendsMessages, false);
      assert.equal(draft.needsTeacherInput, false);
      assert.equal(draft.review, null);

      const svgResponse = await fetch(`${base}/api/drafts/${created.id}/card.svg`);
      assert.equal(svgResponse.status, 200);
      assert.match(svgResponse.headers.get("content-type"), /^image\/svg\+xml\b/i);
      const svg = await svgResponse.text();
      assert.match(svg, /^<svg\b/);
      assert.match(svg, /viewBox="0 0 1080 1350"/);
      assert.ok(svg.includes("S-007") && svg.includes("grapes"));
      assert.ok(svg.includes("不會實際傳送"));
    });
  });
});

const fakeAudioDeps = {
  probeFn: async () => Buffer.from(JSON.stringify({
    streams: [{ codec_type: "audio", codec_name: "opus", duration: "0.001" }],
    format: { format_name: "ogg", duration: "0.001" },
  })),
  spawnFn: async () => ({ stdout: Buffer.from([0, 0]) }),
};

let timeoutProviderCalls = 0;
const httpErrorCases = [
  {
    code: "OUT_OF_SCOPE",
    status: 400,
    request: (base) => postJson(base, "/api/drafts", {
      studentCode: "S-007",
      transcript: `${SAMPLE_TRANSCRIPT}\n今天也練習了 orange。`,
    }),
  },
  {
    code: "UNKNOWN_STUDENT",
    status: 400,
    request: (base) => postJson(base, "/api/drafts", {
      studentCode: "S-999",
      transcript: SAMPLE_TRANSCRIPT,
    }),
  },
  {
    code: "NOT_PENDING",
    status: 409,
    request: async (base) => {
      const createdResponse = await postJson(base, "/api/drafts", {
        studentCode: "S-007",
        transcript: SAMPLE_TRANSCRIPT,
      });
      assert.equal(createdResponse.status, 201);
      const draft = await createdResponse.json();
      const approval = {
        contentHash: draft.contentHash,
        approvedBy: "teacher",
      };
      const firstApproval = await postJson(base, `/api/drafts/${draft.id}/approve`, approval);
      assert.equal(firstApproval.status, 200);
      return postJson(base, `/api/drafts/${draft.id}/approve`, approval);
    },
  },
  {
    code: "PROVIDER_TIMEOUT",
    status: 504,
    options: {
      audioDeps: fakeAudioDeps,
      transcriptionProvider: () => {
        timeoutProviderCalls += 1;
        return new Promise(() => {});
      },
    },
    request: (base) => fetch(`${base}/api/voice/transcribe`, {
      method: "POST",
      headers: {
        "Content-Type": "audio/ogg",
        "X-Demo-Synthetic": "true",
        "X-Input-Role": "adult-teacher",
      },
      body: Buffer.from("OggS synthetic fixture"),
    }),
    verify: () => assert.equal(timeoutProviderCalls, 1),
  },
];

describe("moosi-say demo: HTTP error mappings", () => {
  for (const scenario of httpErrorCases) {
    it(`maps ${scenario.code} to HTTP ${scenario.status}`, async () => {
      timeoutProviderCalls = 0;
      await withHttpApp(scenario.options ?? {}, async (base) => {
        const response = await scenario.request(base);
        assert.equal(response.status, scenario.status);
        assert.match(response.headers.get("content-type"), /^application\/json\b/i);
        const body = await response.json();
        assert.equal(body.error.code, scenario.code);
        assert.equal(typeof body.error.message, "string");
        scenario.verify?.();
      });
    });
  }
});

describe("moosi-say demo: card rendering", () => {
  it("renders a 4:5 SVG without claiming PNG export", () => {
    const card = generateCard(validInput);
    const svg = renderCardSvg(card, contentHash(card));
    assert.match(svg, /viewBox="0 0 1080 1350"/);
    assert.ok(svg.includes("apple") && svg.includes("grapes"));
    assert.ok(svg.includes("S-007"));
    assert.ok(!/png/i.test(svg), "must not claim PNG export");
    assert.ok(svg.includes("不會實際傳送"));
  });

  it("canonical JSON is key-order stable", () => {
    const card = generateCard(validInput);
    const reordered = Object.fromEntries(
      Object.entries(card).reverse()
    );
    assert.equal(canonicalJson(reordered), canonicalJson(card));
  });

  it("english token extraction is case-insensitive", () => {
    assert.deepEqual(englishTokens("Apple BANANA grapes"), [
      "apple",
      "banana",
      "grapes",
    ]);
  });

  it("mutation of a returned card cannot bypass hash-bound approval", () => {
    const store = createStore();
    const draft = store.issue(validInput);
    const originalHash = draft.contentHash;
    // Tamper through the returned reference (no internal access).
    draft.card.home_mission_zh = "tampered after preview";
    draft.card.key_words.push("orange");
    // The tampered content's hash must be rejected.
    assert.throws(
      () =>
        store.approve(draft.id, {
          contentHash: contentHash(draft.card),
          approvedBy: "teacher",
        }),
      (err) => err.code === "HASH_MISMATCH"
    );
    // Internal state is unaffected: the original hash still approves,
    // and the stored card has no trace of the tampering.
    const approved = store.approve(draft.id, {
      contentHash: originalHash,
      approvedBy: "teacher",
    });
    assert.equal(approved.status, "approved");
    assert.deepEqual(approved.card.key_words, ["apple", "banana", "grapes"]);
    assert.ok(!approved.card.home_mission_zh.includes("tampered"));
    // Same for get(): mutating a fetched copy must not change the store.
    const fetched = store.get(draft.id);
    fetched.card.sentence = "tampered";
    assert.notEqual(store.get(draft.id).card.sentence, "tampered");
  });
});
