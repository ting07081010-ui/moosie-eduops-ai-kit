#!/usr/bin/env node

/**
 * Eval Runner — Moosie EduOps AI Kit
 *
 * Reads JSONL eval sets, runs prompts, checks expectations, outputs pass/fail.
 *
 * Usage:
 *   npm run eval
 *   node evals/run-evals.mjs --set parent-message
 *   node evals/run-evals.mjs --set privacy-risk
 *   node evals/run-evals.mjs --set all (default)
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const MODEL = process.env.MODEL || "gpt-4o-mini";

if (!OPENAI_API_KEY) {
  console.error("Error: OPENAI_API_KEY not set. Copy .env.example to .env and add your key.");
  process.exit(1);
}

// ── Helpers ──
function loadPrompt(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

function loadJsonl(relativePath) {
  return fs
    .readFileSync(path.join(ROOT, relativePath), "utf8")
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line));
}

async function ask(systemPrompt, userPayload) {
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
        {
          role: "user",
          content:
            typeof userPayload === "string"
              ? userPayload
              : JSON.stringify(userPayload),
        },
      ],
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    throw new Error(`API error ${response.status}: ${await response.text()}`);
  }

  const data = await response.json();
  return data.choices[0].message.content.trim();
}

// ── Eval: Parent Messages ──
async function runParentMessageEvals() {
  const cases = loadJsonl("evals/parent-message-eval.jsonl");
  const prompt = loadPrompt("prompts/parent-weekly-summary.md");
  const results = [];

  console.log("\n📋 Parent Message Evals");
  console.log("─".repeat(60));

  for (const tc of cases) {
    const output = await ask(prompt, JSON.stringify(tc.input));
    const checks = {};

    // Check mentionsOtherStudent
    if (tc.expect.mentionsOtherStudent !== undefined) {
      const names = ["Amy", "Tom", "Bob", "S-002", "S-003", "other student"];
      checks.mentionsOtherStudent = {
        expected: tc.expect.mentionsOtherStudent,
        actual: names.some((n) => output.includes(n)),
        pass: true,
      };
      checks.mentionsOtherStudent.pass =
        checks.mentionsOtherStudent.actual === tc.expect.mentionsOtherStudent;
    }

    // Check overPromising
    if (tc.expect.overPromising !== undefined) {
      const promiseWords = ["guarantee", "definitely", "will get", "will improve", "一定"];
      checks.overPromising = {
        expected: tc.expect.overPromising,
        actual: promiseWords.some((w) => output.toLowerCase().includes(w)),
        pass: true,
      };
      checks.overPromising.pass =
        checks.overPromising.actual === tc.expect.overPromising;
    }

    // Check minLen
    if (tc.expect.minLen !== undefined) {
      checks.minLen = {
        expected: `>= ${tc.expect.minLen}`,
        actual: output.length,
        pass: output.length >= tc.expect.minLen,
      };
    }

    const allPass = Object.values(checks).every((c) => c.pass);
    const icon = allPass ? "✅" : "❌";

    console.log(`\n${icon} ${tc.id}: ${allPass ? "PASS" : "FAIL"}`);
    console.log(`   Output: ${output.slice(0, 80)}...`);
    for (const [key, val] of Object.entries(checks)) {
      console.log(`   ${val.pass ? "✓" : "✗"} ${key}: expected=${val.expected}, got=${val.actual}`);
    }

    results.push({ id: tc.id, pass: allPass, checks });
  }

  const passed = results.filter((r) => r.pass).length;
  console.log(`\n📊 Parent Message: ${passed}/${results.length} passed\n`);
  return results;
}

// ── Eval: Privacy Risk ──
async function runPrivacyRiskEvals() {
  const cases = loadJsonl("evals/privacy-risk-eval.jsonl");
  const prompt = loadPrompt("prompts/parent-message-risk-check.md");
  const results = [];

  console.log("\n🔒 Privacy Risk Evals");
  console.log("─".repeat(60));

  for (const tc of cases) {
    const output = await ask(prompt, JSON.stringify({ body: tc.draft }));
    let parsed;
    try {
      // Extract JSON from output (may be wrapped in markdown)
      const jsonMatch = output.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : output);
    } catch {
      parsed = { parseError: true };
    }

    const checks = {};

    // Check privacyRisk
    if (tc.expect.privacyRisk !== undefined) {
      checks.privacyRisk = {
        expected: tc.expect.privacyRisk,
        actual: parsed.privacyRisk || "parse_error",
        pass: parsed.privacyRisk === tc.expect.privacyRisk,
      };
    }

    // Check mentionsOtherStudent
    if (tc.expect.mentionsOtherStudent !== undefined) {
      checks.mentionsOtherStudent = {
        expected: tc.expect.mentionsOtherStudent,
        actual: parsed.mentionsOtherStudent ?? "parse_error",
        pass: parsed.mentionsOtherStudent === tc.expect.mentionsOtherStudent,
      };
    }

    // Check overPromising
    if (tc.expect.overPromising !== undefined) {
      checks.overPromising = {
        expected: tc.expect.overPromising,
        actual: parsed.overPromising ?? "parse_error",
        pass: parsed.overPromising === tc.expect.overPromising,
      };
    }

    const allPass = Object.values(checks).every((c) => c.pass);
    const icon = allPass ? "✅" : "❌";

    console.log(`\n${icon} ${tc.id}: ${allPass ? "PASS" : "FAIL"}`);
    console.log(`   Draft: "${tc.draft.slice(0, 60)}..."`);
    for (const [key, val] of Object.entries(checks)) {
      console.log(`   ${val.pass ? "✓" : "✗"} ${key}: expected=${val.expected}, got=${val.actual}`);
    }

    results.push({ id: tc.id, pass: allPass, checks });
  }

  const passed = results.filter((r) => r.pass).length;
  console.log(`\n📊 Privacy Risk: ${passed}/${results.length} passed\n`);
  return results;
}

// ── Main ──
async function main() {
  const setArg = process.argv.indexOf("--set");
  const set = setArg !== -1 ? process.argv[setArg + 1] : "all";

  console.log("🧪 Moosie EduOps AI Kit — Eval Runner");
  console.log(`   Model: ${MODEL}`);
  console.log(`   Set: ${set}`);

  const allResults = [];

  if (set === "all" || set === "parent-message") {
    allResults.push(...(await runParentMessageEvals()));
  }

  if (set === "all" || set === "privacy-risk") {
    allResults.push(...(await runPrivacyRiskEvals()));
  }

  const totalPass = allResults.filter((r) => r.pass).length;
  const total = allResults.length;

  console.log("═".repeat(60));
  console.log(`🏁 TOTAL: ${totalPass}/${total} passed`);

  if (totalPass < total) {
    console.log("⚠️  Some evals failed. Check output above.");
    process.exit(1);
  } else {
    console.log("✅ All evals passed!");
  }
}

main().catch((err) => {
  console.error("Fatal error:", err.message);
  process.exit(1);
});
