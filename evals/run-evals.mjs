#!/usr/bin/env node

/**
 * Eval Runner — Moosie EduOps AI Kit
 *
 * Reads JSONL eval sets, runs prompts, checks expectations, outputs pass/fail.
 *
 * Usage:
 *   node evals/run-evals.mjs                    # structural validation (no API)
 *   node evals/run-evals.mjs --live              # live eval with OpenAI API
 *   node evals/run-evals.mjs --set parent-message
 *   node evals/run-evals.mjs --set privacy-risk
 *   node evals/run-evals.mjs --set all (default)
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

// ── Helpers ──
function loadJsonl(relativePath) {
  return fs
    .readFileSync(path.join(ROOT, relativePath), "utf8")
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line));
}

// ── Structural Validation (no API needed) ──

function validateParentMessageStructure(cases) {
  console.log("\n📋 Parent Message Eval — Structure Validation");
  console.log("─".repeat(60));

  let pass = 0;
  let fail = 0;

  for (const tc of cases) {
    const issues = [];

    if (!tc.id) issues.push("missing id");
    if (!tc.input) issues.push("missing input");
    if (!tc.expect) issues.push("missing expect");

    if (tc.input) {
      if (!tc.input.studentCode) issues.push("missing studentCode");
      if (!tc.input.topic) issues.push("missing topic");
      if (!tc.input.performance) issues.push("missing performance");
    }

    if (tc.expect) {
      // Check that expected fields are valid
      const validExpectKeys = [
        "mentionsOtherStudent", "overPromising", "tone", "minLen",
        "hasObservableBehavior", "hasParentAction", "specificity"
      ];
      for (const key of Object.keys(tc.expect)) {
        if (!validExpectKeys.includes(key)) {
          issues.push(`unknown expect key: ${key}`);
        }
      }
    }

    const ok = issues.length === 0;
    if (ok) pass++; else fail++;

    console.log(`  ${ok ? "✅" : "❌"} ${tc.id}: ${ok ? "valid" : issues.join(", ")}`);
  }

  console.log(`\n  Result: ${pass}/${pass + fail} cases structurally valid`);
  return fail === 0;
}

function validatePrivacyRiskStructure(cases) {
  console.log("\n🔒 Privacy Risk Eval — Structure Validation");
  console.log("─".repeat(60));

  let pass = 0;
  let fail = 0;

  for (const tc of cases) {
    const issues = [];

    if (!tc.id) issues.push("missing id");
    if (!tc.draft && !tc.input) issues.push("missing draft/input");
    if (!tc.expect) issues.push("missing expect");

    if (tc.expect) {
      const validExpectKeys = [
        "privacyRisk", "overPromising", "tone",
        "mentionsOtherStudent", "hasObservableBehavior", "hasParentAction"
      ];
      for (const key of Object.keys(tc.expect)) {
        if (!validExpectKeys.includes(key)) {
          issues.push(`unknown expect key: ${key}`);
        }
      }
    }

    const ok = issues.length === 0;
    if (ok) pass++; else fail++;

    console.log(`  ${ok ? "✅" : "❌"} ${tc.id}: ${ok ? "valid" : issues.join(", ")}`);
  }

  console.log(`\n  Result: ${pass}/${pass + fail} cases structurally valid`);
  return fail === 0;
}

function validateProgressDiagnosisStructure(cases) {
  console.log("\n📊 Progress Diagnosis Eval — Structure Validation");
  console.log("─".repeat(60));

  let pass = 0;
  let fail = 0;

  for (const tc of cases) {
    const issues = [];

    if (!tc.id) issues.push("missing id");
    if (!tc.input) issues.push("missing input");
    if (!tc.expect) issues.push("missing expect");

    if (tc.input && !Array.isArray(tc.input.records)) {
      issues.push("input.records should be an array");
    }

    const ok = issues.length === 0;
    if (ok) pass++; else fail++;

    console.log(`  ${ok ? "✅" : "❌"} ${tc.id}: ${ok ? "valid" : issues.join(", ")}`);
  }

  console.log(`\n  Result: ${pass}/${pass + fail} cases structurally valid`);
  return fail === 0;
}

function runSecretScan() {
  console.log("\n🔑 Secret Scan");
  console.log("─".repeat(60));

  const exts = [".mjs", ".js", ".ts", ".json", ".yml", ".yaml", ".md"];
  const secretPatterns = [
    /sk-[A-Za-z0-9]{20,}/g,
    /ghp_[A-Za-z0-9]{36}/g,
    /xoxb-[0-9]+-[A-Za-z0-9]+/g,
  ];

  let found = false;

  function scanDir(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory() && !entry.name.startsWith(".") && entry.name !== "node_modules") {
        scanDir(full);
      } else if (entry.isFile() && exts.includes(path.extname(entry.name))) {
        const content = fs.readFileSync(full, "utf8");
        for (const pat of secretPatterns) {
          const matches = content.match(pat);
          if (matches) {
            console.log(`  ❌ ${path.relative(ROOT, full)}: found ${matches.length} potential secret(s)`);
            found = true;
          }
        }
      }
    }
  }

  scanDir(ROOT);

  if (!found) {
    console.log("  ✅ No hardcoded secrets found");
  }
  return !found;
}

function validateLessonRecordSchema() {
  console.log("\n📐 Lesson Record Schema Validation");
  console.log("─".repeat(60));

  try {
    const schema = JSON.parse(
      fs.readFileSync(path.join(ROOT, "schemas/lesson-record.schema.json"), "utf8")
    );
    const requiredFields = schema.required || [];
    const props = Object.keys(schema.properties || {});

    console.log(`  Required: ${requiredFields.join(", ")}`);
    console.log(`  Properties: ${props.length} fields`);

    // Check new Moosie fields exist
    const moosieFields = ["classCode", "lessonType", "cefrTarget", "skills", "evidence", "parentAction", "teacherNextStep", "retentionSignal"];
    const missing = moosieFields.filter((f) => !props.includes(f));

    if (missing.length > 0) {
      console.log(`  ❌ Missing Moosie fields: ${missing.join(", ")}`);
      return false;
    }

    console.log("  ✅ All Moosie fields present in schema");
    return true;
  } catch (err) {
    console.log(`  ❌ Schema parse error: ${err.message}`);
    return false;
  }
}

function validateFakeData() {
  console.log("\n📁 Fake Data Validation");
  console.log("─".repeat(60));

  const files = [
    "examples/fake-data/lesson-input.json",
    "examples/fake-data/lesson-input-2.json",
    "examples/fake-data/lesson-input-3.json",
  ];

  let allValid = true;

  for (const f of files) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(ROOT, f), "utf8"));
      const hasCode = !!data.studentCode;
      const hasTopic = !!data.topic;
      const hasParentAction = !!data.parentAction;
      const ok = hasCode && hasTopic;

      if (!hasParentAction) {
        console.log(`  ⚠️  ${f}: missing parentAction (recommended)`);
      }

      console.log(`  ${ok ? "✅" : "❌"} ${f}: ${ok ? "valid" : "missing required fields"}`);
      if (!ok) allValid = false;
    } catch (err) {
      console.log(`  ❌ ${f}: ${err.message}`);
      allValid = false;
    }
  }

  return allValid;
}

// ── Live Eval (requires OPENAI_API_KEY) ──

async function ask(systemPrompt, userPayload) {
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  const MODEL = process.env.MODEL || "gpt-4o-mini";

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: typeof userPayload === "string" ? userPayload : JSON.stringify(userPayload) },
      ],
      temperature: 0.3,
    }),
  });

  if (!response.ok) throw new Error(`API error ${response.status}: ${await response.text()}`);
  const data = await response.json();
  return data.choices[0].message.content.trim();
}

function loadPrompt(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

async function runLiveParentMessageEvals() {
  const cases = loadJsonl("evals/parent-message-eval.jsonl");
  const prompt = loadPrompt("prompts/parent-weekly-summary.md");
  const results = [];

  console.log("\n📋 Parent Message Evals (Live)");
  console.log("─".repeat(60));

  for (const tc of cases) {
    const output = await ask(prompt, JSON.stringify(tc.input));
    const checks = {};

    if (tc.expect.mentionsOtherStudent !== undefined) {
      const names = ["Amy", "Tom", "Bob", "S-002", "S-003", "other student"];
      const actual = names.some((n) => output.includes(n));
      checks.mentionsOtherStudent = { expected: tc.expect.mentionsOtherStudent, actual, pass: actual === tc.expect.mentionsOtherStudent };
    }

    if (tc.expect.overPromising !== undefined) {
      const promiseWords = ["guarantee", "definitely", "will get", "will improve", "一定", "保證"];
      const actual = promiseWords.some((w) => output.toLowerCase().includes(w));
      checks.overPromising = { expected: tc.expect.overPromising, actual, pass: actual === tc.expect.overPromising };
    }

    if (tc.expect.hasObservableBehavior !== undefined) {
      // Simple heuristic: output should contain specific evidence, not just vague praise
      const vaguePhrases = ["表現很好", "很認真", "繼續加油", "很棒"];
      const hasVague = vaguePhrases.some((p) => output.includes(p));
      const hasSpecific = output.includes("能") || output.includes("會") || output.includes("已") || output.includes("句");
      const actual = hasSpecific && !hasVague;
      checks.hasObservableBehavior = { expected: tc.expect.hasObservableBehavior, actual, pass: actual === tc.expect.hasObservableBehavior };
    }

    if (tc.expect.hasParentAction !== undefined) {
      const actionIndicators = ["在家", "每天", "請孩子", "可以", "分鐘"];
      const actual = actionIndicators.some((a) => output.includes(a));
      checks.hasParentAction = { expected: tc.expect.hasParentAction, actual, pass: actual === tc.expect.hasParentAction };
    }

    if (tc.expect.minLen !== undefined) {
      checks.minLen = { expected: `>= ${tc.expect.minLen}`, actual: output.length, pass: output.length >= tc.expect.minLen };
    }

    const allPass = Object.values(checks).every((c) => c.pass);
    console.log(`\n${allPass ? "✅" : "❌"} ${tc.id}: ${allPass ? "PASS" : "FAIL"}`);
    console.log(`   Output: ${output.slice(0, 100)}...`);
    for (const [key, val] of Object.entries(checks)) {
      console.log(`   ${val.pass ? "✓" : "✗"} ${key}: expected=${val.expected}, got=${val.actual}`);
    }
    results.push({ id: tc.id, pass: allPass });
  }

  const passed = results.filter((r) => r.pass).length;
  console.log(`\n📊 Parent Message: ${passed}/${results.length} passed`);
  return results;
}

// ── Main ──

async function main() {
  const liveMode = process.argv.includes("--live");
  const setArg = process.argv.indexOf("--set");
  const set = setArg !== -1 ? process.argv[setArg + 1] : "all";

  console.log("🧪 Moosie EduOps AI Kit — Eval Runner");
  console.log(`   Mode: ${liveMode ? "live (OpenAI API)" : "structural validation"}`);
  console.log(`   Set: ${set}`);

  const results = {};

  if (liveMode) {
    // Live mode requires API key
    if (!process.env.OPENAI_API_KEY) {
      console.error("\n❌ OPENAI_API_KEY not set. Use structural mode or set key in .env");
      process.exit(1);
    }
    if (set === "all" || set === "parent-message") {
      results.parentMessage = await runLiveParentMessageEvals();
    }
  } else {
    // Structural validation mode (no API needed)
    if (set === "all" || set === "parent-message") {
      const cases = loadJsonl("evals/parent-message-eval.jsonl");
      results.parentMessageStructure = validateParentMessageStructure(cases);
    }
    if (set === "all" || set === "privacy-risk") {
      const cases = loadJsonl("evals/privacy-risk-eval.jsonl");
      results.privacyRiskStructure = validatePrivacyRiskStructure(cases);
    }
    if (set === "all" || set === "progress-diagnosis") {
      try {
        const cases = loadJsonl("evals/progress-diagnosis-eval.jsonl");
        results.progressDiagnosisStructure = validateProgressDiagnosisStructure(cases);
      } catch {
        console.log("\n📊 Progress Diagnosis: file not found, skipping");
      }
    }
    if (set === "all") {
      results.schema = validateLessonRecordSchema();
      results.fakeData = validateFakeData();
      results.secretScan = runSecretScan();
    }
  }

  // Summary
  console.log("\n═".repeat(60));
  console.log("  Summary");
  console.log("═".repeat(60));

  let allPass = true;
  for (const [name, val] of Object.entries(results)) {
    const pass = Array.isArray(val) ? val.every((r) => r.pass) : val;
    console.log(`  ${pass ? "✅" : "❌"} ${name}`);
    if (!pass) allPass = false;
  }

  console.log(`\n  Overall: ${allPass ? "✅ ALL PASSED" : "❌ SOME FAILED"}`);
  process.exit(allPass ? 0 : 1);
}

main().catch((err) => {
  console.error("Fatal error:", err.message);
  process.exit(1);
});
