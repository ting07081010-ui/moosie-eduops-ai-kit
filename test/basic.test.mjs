import { describe, it } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { quickRiskCheck, computeVerdict } from "../src/core/check-parent-message-risk.mjs";
import { extractJson } from "../src/core/llm.mjs";
import { validateLessonRecord, validateParentMessage, validateTask } from "../src/core/schema-validator.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

describe("Schemas", () => {
  const schemaDir = path.join(ROOT, "schemas");

  it("all JSON schemas are valid JSON", () => {
    const files = fs.readdirSync(schemaDir).filter((f) => f.endsWith(".json"));
    assert(files.length > 0, "No schema files found");

    for (const file of files) {
      const content = fs.readFileSync(path.join(schemaDir, file), "utf8");
      const parsed = JSON.parse(content);
      assert(parsed.title, `${file} missing title`);
      assert(parsed.properties, `${file} missing properties`);
    }
  });

  it("lesson-record schema requires studentCode with S-XXX pattern", () => {
    const schema = JSON.parse(
      fs.readFileSync(path.join(schemaDir, "lesson-record.schema.json"), "utf8")
    );
    assert.equal(schema.properties.studentCode.pattern, "^S-[0-9]{3}$");
  });

  it("parent-message schema has maxLength on body", () => {
    const schema = JSON.parse(
      fs.readFileSync(path.join(schemaDir, "parent-message.schema.json"), "utf8")
    );
    assert(schema.properties.body.maxLength <= 400, "body maxLength should be <= 400");
  });

  it("all schemas use additionalProperties: false", () => {
    const files = fs.readdirSync(schemaDir).filter((f) => f.endsWith(".json"));
    for (const file of files) {
      const schema = JSON.parse(
        fs.readFileSync(path.join(schemaDir, file), "utf8")
      );
      // Skip schemas that use $ref (composite schemas)
      if (schema.properties?.records) continue;
      assert.strictEqual(
        schema.additionalProperties,
        false,
        `${file} should have additionalProperties: false`
      );
    }
  });
});

describe("Prompts", () => {
  const promptDir = path.join(ROOT, "prompts");

  it("all prompts are non-empty markdown", () => {
    const files = fs.readdirSync(promptDir).filter((f) => f.endsWith(".md"));
    assert(files.length >= 5, `Expected at least 5 prompts, found ${files.length}`);

    for (const file of files) {
      const content = fs.readFileSync(path.join(promptDir, file), "utf8");
      assert(content.length > 100, `${file} is too short`);
    }
  });

  it("all prompts contain Safety Rules section", () => {
    const files = fs.readdirSync(promptDir).filter((f) => f.endsWith(".md"));
    for (const file of files) {
      const content = fs.readFileSync(path.join(promptDir, file), "utf8");
      assert(
        content.includes("Safety") || content.includes("safety"),
        `${file} missing Safety section`
      );
    }
  });

  it("parent-weekly-summary prompt mentions zh-TW", () => {
    const content = fs.readFileSync(
      path.join(promptDir, "parent-weekly-summary.md"),
      "utf8"
    );
    assert(content.includes("zh-TW"), "Should specify zh-TW output language");
  });
});

describe("Fake Data", () => {
  const dataDir = path.join(ROOT, "examples", "fake-data");

  function assertFakeStudentCode(record, file) {
    assert(record.studentCode, `${file} missing studentCode`);
    assert.match(record.studentCode, /^S-\d{3}$/, `${file} studentCode should be S-XXX`);
  }

  it("all fake data files are valid JSON", () => {
    const files = fs.readdirSync(dataDir).filter((f) => f.endsWith(".json"));
    assert(files.length >= 2, "Expected at least 2 fake data files");

    for (const file of files) {
      const content = fs.readFileSync(path.join(dataDir, file), "utf8");
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        assert(parsed.length > 0, `${file} should not be empty`);
        for (const record of parsed) {
          assertFakeStudentCode(record, file);
        }
      } else {
        assertFakeStudentCode(parsed, file);
      }
    }
  });

  it("fake data contains no real PII patterns", () => {
    const files = fs.readdirSync(dataDir).filter((f) => f.endsWith(".json"));
    for (const file of files) {
      const content = fs.readFileSync(path.join(dataDir, file), "utf8");
      // Check for phone patterns
      assert(!content.match(/09\d{8}/), `${file} may contain phone numbers`);
      // Check for email patterns
      assert(!content.match(/[a-z]+@[a-z]+\.[a-z]+/i), `${file} may contain emails`);
    }
  });
});

describe("Eval Files", () => {
  it("eval JSONL files are valid", () => {
    const evalDir = path.join(ROOT, "evals");
    const files = fs.readdirSync(evalDir).filter((f) => f.endsWith(".jsonl"));

    for (const file of files) {
      const lines = fs
        .readFileSync(path.join(evalDir, file), "utf8")
        .split("\n")
        .filter((l) => l.trim());

      assert(lines.length >= 3, `${file} should have at least 3 eval cases`);

      for (const line of lines) {
        const parsed = JSON.parse(line);
        assert(parsed.id, `${file} entry missing id`);
        assert(parsed.expect, `${file} entry missing expect`);
      }
    }
  });
});

describe("Risk Gate", () => {
  it("computes blocking verdicts deterministically", () => {
    assert.equal(computeVerdict({ privacyRisk: "high" }), "block");
    assert.equal(computeVerdict({ overPromising: true }), "block");
    assert.equal(computeVerdict({ mentionsOtherStudent: true }), "block");
    assert.equal(computeVerdict({ tone: "blaming" }), "block");
  });

  it("computes review and approve verdicts deterministically", () => {
    assert.equal(computeVerdict({ hasObservableBehavior: false }), "review");
    assert.equal(computeVerdict({ hasParentAction: false }), "review");
    assert.equal(computeVerdict({ privacyRisk: "low" }), "review");
    assert.equal(computeVerdict({ privacyRisk: "none", tone: "neutral" }), "approve");
  });

  it("flags obvious risky parent message drafts without an LLM call", () => {
    const result = quickRiskCheck("其他同學都會了，他一定會進步，不認真只會更差");

    assert.equal(result.hasIssues, true);
    assert(result.quickFlags.includes("mentionsOther"));
    assert(result.quickFlags.includes("overPromising"));
    assert(result.quickFlags.includes("blamingTone"));
  });
});

describe("LLM JSON Extraction", () => {
  it("parses direct JSON", () => {
    assert.deepEqual(extractJson('{"ok":true}'), { ok: true });
  });

  it("parses JSON inside markdown fences", () => {
    assert.deepEqual(extractJson('```json\n{"verdict":"approve"}\n```'), {
      verdict: "approve",
    });
  });

  it("parses embedded JSON from surrounding text", () => {
    assert.deepEqual(extractJson('Result follows: {"tasks":["call parent"]}'), {
      tasks: ["call parent"],
    });
  });

  it("throws a clear error when no JSON is present", () => {
    assert.throws(() => extractJson("no structured output"), /No valid JSON/);
  });
});

describe("Core Validators", () => {
  it("rejects invalid lesson record enum values and skill ratings", () => {
    const result = validateLessonRecord({
      studentCode: "S-001",
      date: "2026-06-01",
      topic: "Past tense",
      performance: "Improving",
      lessonType: "phonics",
      skills: { speaking: 6 },
    });

    assert.equal(result.valid, false);
    assert(result.errors.some((e) => e.includes("Invalid lessonType")));
    assert(result.errors.some((e) => e.includes("Invalid skill rating")));
  });

  it("warns when parent messages have not passed the risk gate", () => {
    const result = validateParentMessage({ studentCode: "S-001", body: "今天能說出三個過去式句子。" });

    assert.equal(result.valid, true);
    assert(result.warnings.includes("riskStatus should be checked before sending"));
    assert(result.warnings.includes("approvedBy should be set before sending"));
  });

  it("rejects invalid task ownership metadata", () => {
    const result = validateTask({ title: "Send worksheet", owner: "student", status: "todo" });

    assert.equal(result.valid, false);
    assert(result.errors.some((e) => e.includes("Invalid owner")));
    assert(result.errors.some((e) => e.includes("Invalid status")));
  });
});
