#!/usr/bin/env node
/**
 * Fake-data demo for the two pilot workflows:
 *   1. Classroom observation -> parent-friendly progress report
 *   2. The same note -> a level-matched, project-based lesson activity
 *
 *   npm run demo -- --dry-run
 *   npm run demo
 *
 * --dry-run and --mock print a fixed sample and do not call a model.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const INPUT_PATH = path.join(ROOT, "examples/fake-data/classroom-observation.json");

function loadDotEnv(file = path.join(ROOT, ".env")) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadDotEnv();

const { callLLM } = await import("../src/core/llm.mjs");
const { validateConfig, config } = await import("../src/core/config.mjs");
const { resolveProvider, claudeModel, DEFAULT_CLAUDE_MODEL } = await import("../src/core/provider.mjs");
const { quickRiskCheck } = await import("../src/core/check-parent-message-risk.mjs");

const PARENT_SYSTEM = `You write a parent-friendly progress note for a small English class.

Rules:
- Warm, specific, and non-alarming. This is a draft a teacher reviews before sending.
- Use only the student code from the input. Do not invent a personal name.
- Include one observable moment from the note. Do not diagnose, label ability, or compare this learner with anyone else.
- Do not promise future results.
- Offer one home action that takes about three minutes.
- Plain prose, about 120-180 words. No markdown headings.`;

const ACTIVITY_SYSTEM = `You design one project-based English lesson activity matched to the CEFR level in the input.

Rules:
- Name the level in the first line and keep every step at that level.
- The learner makes a small product, such as a page or mini book, rather than a drill worksheet.
- Use a fictional character. Do not ask for a real name, family details, address, or school.
- Include time, materials, numbered steps, and what success looks like.
- One class period. Plain prose. No diagnosis and no comparison with other learners.`;

const DRY_RUN_REPORT = `S-001 had a steady storytelling lesson on 2026-06-01. They volunteered a short weekend story and first said "I goed to the park." After a partner pointed to the verb card, they changed it to "I went to the park." On the writing strip, played, watched, and visited were already in place. The sentence with eat/ate was left unfinished, which is a normal pause while that form is still new.

Speaking is the easier channel right now, and the self-correction shows they can use went when they have a moment to look. There is nothing here that needs a worried conversation.

At home, three minutes is enough: ask S-001 to say one thing about yesterday and stop after three sentences. went or ate can be used if they fit. The goal is a complete little story, not a perfect paragraph.`;

const DRY_RUN_ACTIVITY = `Level: A2
Project: Yesterday Photo Story (one page, about 40 minutes)

Learners make a three-panel page about a fictional character's yesterday. The class staples the pages into a short booklet. The story is invented, so nobody shares a real address, family name, or school.

Materials: three blank panels, pencils, and verb cards for go/went, eat/ate, play/played, watch/watched, and visit/visited.

Steps:
1. Choose a fictional character and a simple place, such as a park or a kitchen.
2. Pick three verb cards, put them in order, and say the sentences with a partner.
3. Write one past-tense sentence in each panel. Two panels can use regular verbs. One panel uses went or ate.
4. Read the page aloud and fix one verb together.
5. Add the page to the class booklet.

Success looks like three past-tense sentences, one irregular verb used correctly, and the learner reading the page aloud.`;

function printUsage() {
  console.log("Usage:");
  console.log("  npm run demo -- --dry-run");
  console.log("  npm run demo -- --mock");
  console.log("  npm run demo");
}

function printDemo({ mode, provider, model, observation, report, activity }) {
  const risk = quickRiskCheck(report);
  console.log("Moosie EduOps — provider demo");
  console.log(`Mode: ${mode}`);
  console.log(`Provider: ${provider}`);
  console.log(`Model: ${model}`);
  console.log(`Input: examples/fake-data/classroom-observation.json (fake student ${observation.studentCode}, CEFR ${observation.cefrLevel})`);
  console.log("");
  console.log("--- Classroom observation ---");
  console.log(observation.observation);
  console.log("");
  console.log("--- Parent-friendly progress report ---");
  console.log(report);
  console.log("");
  console.log(`Local risk pre-check: ${risk.hasIssues ? risk.quickFlags.join(", ") : "no flags"}`);
  console.log("");
  console.log("--- Level-matched project activity ---");
  console.log(activity);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help")) {
    printUsage();
    return;
  }

  const observation = JSON.parse(fs.readFileSync(INPUT_PATH, "utf8"));
  const dryRun = args.includes("--dry-run") || args.includes("--mock");

  if (dryRun) {
    printDemo({
      mode: "dry-run (no API call)",
      provider: "mock",
      model: DEFAULT_CLAUDE_MODEL,
      observation,
      report: DRY_RUN_REPORT,
      activity: DRY_RUN_ACTIVITY,
    });
    return;
  }

  const cfg = validateConfig();
  if (!cfg.ok) {
    console.error(`Missing config: ${cfg.missing.join(", ")}`);
    console.error("Copy .env.example to .env and set the key for the selected provider.");
    console.error("Re-run with --dry-run to preview fake output without an API key.");
    process.exit(1);
  }

  const provider = resolveProvider();
  const model = provider === "claude" ? claudeModel() : config.openai.model;
  const report = await callLLM(PARENT_SYSTEM, observation);
  const activity = await callLLM(ACTIVITY_SYSTEM, observation);
  printDemo({
    mode: "live",
    provider,
    model,
    observation,
    report,
    activity,
  });
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
