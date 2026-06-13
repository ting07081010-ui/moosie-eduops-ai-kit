#!/usr/bin/env node

/**
 * Teacher Note CLI Demo
 *
 * Input: a JSON file with teacher's lesson notes
 * Output: 4 sections — internal note, parent summary, tasks, risk check
 *
 * Usage:
 *   npm run cli -- --file examples/fake-data/lesson-input.json
 *   npm run cli -- --input "S-003 practiced past tense speaking and still needs help with went/ate."
 *   npm run cli -- --input-dir examples/fake-data
 *   npm run cli -- --demo
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");

// ── Config ──
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

function loadInput(inputPath) {
  const raw = fs.readFileSync(path.resolve(inputPath), "utf8");
  return JSON.parse(raw);
}

async function ask(systemPrompt, userPayload) {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
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

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenAI API error (${response.status}): ${err}`);
  }

  const data = await response.json();
  return data.choices[0].message.content.trim();
}

// ── Main ──
async function run(inputPath) {
  const input = loadInput(inputPath);

  console.log(`\n📝 Processing lesson record for ${input.studentCode} (${input.date})\n`);
  console.log("─".repeat(60));

  // 1) Structured internal note
  console.log("\n=== Internal Note ===\n");
  const notePrompt = loadPrompt("prompts/teacher-after-class-note.md");
  const note = await ask(notePrompt, JSON.stringify(input));
  console.log(note);

  // 2) Parent weekly summary
  console.log("\n=== Parent Summary (zh-TW) ===\n");
  const summaryPrompt = loadPrompt("prompts/parent-weekly-summary.md");
  const summary = await ask(summaryPrompt, JSON.stringify(input));
  console.log(summary);

  // 3) Tasks
  console.log("\n=== Extracted Tasks ===\n");
  const taskPrompt = loadPrompt("prompts/admin-task-router.md");
  const tasks = await ask(taskPrompt, JSON.stringify(input));
  console.log(tasks);

  // 4) Risk check on the generated summary
  console.log("\n=== Risk Check on Parent Summary ===\n");
  const riskPrompt = loadPrompt("prompts/parent-message-risk-check.md");
  const risk = await ask(riskPrompt, JSON.stringify({ body: summary }));
  console.log(risk);

  console.log("\n" + "─".repeat(60));
  console.log("✅ Done.");
}

// ── Entry ──
const argIndex = process.argv.indexOf("--input");
if (argIndex === -1 || !process.argv[argIndex + 1]) {
  console.error("Usage: npm run cli -- --input <path-to-lesson-input.json>");
  process.exit(1);
}

run(process.argv[argIndex + 1]).catch((err) => {
  console.error("Fatal error:", err.message);
  process.exit(1);
});
