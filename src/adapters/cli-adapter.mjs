/**
 * CLI Adapter — Terminal interface for testing core functions.
 *
 * Usage:
 *   node src/adapters/cli-adapter.mjs --input "S-003 past tense 口說比上週順"
 *   node src/adapters/cli-adapter.mjs --file examples/fake-data/lesson-input.json
 *   node src/adapters/cli-adapter.mjs --input-dir examples/fake-data
 *   node src/adapters/cli-adapter.mjs --demo
 */

import fs from "node:fs";
import path from "node:path";
import {
  generateLessonRecord,
  generateParentSummary,
  checkParentMessageRisk,
  extractAdminTasks,
  validateLessonRecord,
  validateConfig,
  runQualityGate,
} from "../core/index.mjs";

function printUsage() {
  console.log("Usage:");
  console.log('  node cli-adapter.mjs --input "S-003 past tense 口說比上週順"');
  console.log("  node cli-adapter.mjs --file examples/fake-data/lesson-input.json");
  console.log("  node cli-adapter.mjs --input-dir examples/fake-data");
  console.log("  node cli-adapter.mjs --demo");
}

function validateRuntimeConfig() {
  const cfg = validateConfig();
  if (!cfg.ok) {
    console.error(`❌ Missing config: ${cfg.missing.join(", ")}`);
    console.error("   Copy .env.example to .env and add your OPENAI_API_KEY");
    process.exit(1);
  }
}

async function loadLessonRecordFromFile(filePath) {
  const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
  if (data.studentCode && data.topic) {
    return { data, warnings: [] };
  }

  return generateLessonRecord(JSON.stringify(data));
}

async function runPipeline(lessonRecord, { compact = false } = {}) {
  const validation = validateLessonRecord(lessonRecord);

  if (!validation.valid) {
    throw new Error(`Invalid lesson record: ${validation.errors.join("; ")}`);
  }

  if (!compact) {
    console.log("\n📋 Lesson Record:");
    console.log(JSON.stringify(lessonRecord, null, 2));

    if (validation.warnings.length > 0) {
      console.log(`\n⚠️  Warnings: ${validation.warnings.join(", ")}`);
    }
  }

  const summary = await generateParentSummary(lessonRecord);
  const quality = runQualityGate(summary, lessonRecord);
  const risk = await checkParentMessageRisk(summary, lessonRecord);
  const tasks = await extractAdminTasks(lessonRecord);

  if (!compact) {
    console.log("\n💬 Parent Summary:");
    console.log(summary);

    console.log("\n🎯 Quality Gate:");
    console.log(`  Score: ${quality.score}/100`);
    console.log(`  Pass: ${quality.pass ? "✅" : "❌"}`);
    for (const check of quality.checks) {
      console.log(`  ${check.pass ? "✓" : "✗"} ${check.name}`);
    }
    if (quality.issues.length > 0) {
      console.log(`  Issues: ${quality.issues.join("; ")}`);
    }

    console.log("\n🔒 Risk Check:");
    console.log(`  Verdict: ${risk.verdict.toUpperCase()}`);
    console.log(`  Privacy: ${risk.privacyRisk} | Promise: ${risk.overPromising} | Tone: ${risk.tone}`);
    if (risk.issues?.length > 0) console.log(`  Issues: ${risk.issues.join(", ")}`);
    if (risk.suggestedRewrite) console.log(`  Rewrite: ${risk.suggestedRewrite}`);

    console.log("\n📋 Tasks:");
    for (const t of tasks.tasks) {
      console.log(`  [${t.pool}] ${t.title} (${t.owner}, ${t.priority})`);
    }

    console.log("\n✅ Done");
  }

  return { validation, summary, quality, risk, tasks };
}

async function runBatch(inputDir) {
  const dir = path.resolve(inputDir);
  const files = fs.readdirSync(dir)
    .filter((name) => name.endsWith(".json"))
    .sort()
    .map((name) => path.join(dir, name));

  if (files.length === 0) {
    throw new Error(`No .json files found in ${dir}`);
  }

  console.log(`🎓 Moosie EduOps — Batch Mode (${files.length} file(s))\n`);

  const rows = [];
  for (const file of files) {
    const row = { file: path.relative(process.cwd(), file), studentCode: "-", quality: "-", risk: "-", tasks: "-", status: "PASS" };
    try {
      const result = await loadLessonRecordFromFile(file);
      const lessonRecord = result.data;
      row.studentCode = lessonRecord.studentCode || "-";
      const output = await runPipeline(lessonRecord, { compact: true });
      row.quality = `${output.quality.score}/100`;
      row.risk = output.risk.verdict;
      row.tasks = String(output.tasks.tasks?.length || 0);
      if (!output.quality.pass || output.risk.verdict === "block") {
        row.status = "REVIEW";
      }
    } catch (err) {
      row.status = "FAIL";
      row.risk = err.message;
    }
    rows.push(row);
  }

  console.table(rows);

  const failed = rows.filter((row) => row.status === "FAIL").length;
  const review = rows.filter((row) => row.status === "REVIEW").length;
  console.log(`\nSummary: ${rows.length - failed}/${rows.length} processed, ${review} need review, ${failed} failed`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--help")) {
    printUsage();
    process.exit(0);
  }

  validateRuntimeConfig();

  let lessonRecord;

  // Parse input
  const inputIdx = args.indexOf("--input");
  const fileIdx = args.indexOf("--file");
  const inputDirIdx = args.indexOf("--input-dir");
  const demoMode = args.includes("--demo");

  if (demoMode) {
    console.log("🎓 Moosie EduOps — Demo Mode\n");
    const input = "S-003 今天上 past tense，口說比上週順，但 irregular verbs 還會混淆。作業完成一半，下次補 irregular verb worksheet。";
    console.log(`Teacher input: "${input}"\n`);
    const result = await generateLessonRecord(input);
    lessonRecord = result.data;
    if (result.warnings.length > 0) console.log(`⚠️  Warnings: ${result.warnings.join(", ")}`);
  } else if (inputIdx !== -1 && args[inputIdx + 1]) {
    const result = await generateLessonRecord(args[inputIdx + 1]);
    lessonRecord = result.data;
    if (result.warnings.length > 0) console.log(`⚠️  Warnings: ${result.warnings.join(", ")}`);
  } else if (fileIdx !== -1 && args[fileIdx + 1]) {
    const result = await loadLessonRecordFromFile(args[fileIdx + 1]);
    lessonRecord = result.data;
    if (result.warnings.length > 0) console.log(`⚠️  Warnings: ${result.warnings.join(", ")}`);
  } else if (inputDirIdx !== -1 && args[inputDirIdx + 1]) {
    await runBatch(args[inputDirIdx + 1]);
    return;
  } else {
    printUsage();
    process.exit(0);
  }

  await runPipeline(lessonRecord);
}

main().catch((err) => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
