/**
 * CLI Adapter — Terminal interface for testing core functions.
 *
 * Usage:
 *   node src/adapters/cli-adapter.mjs --input "S-003 past tense 口說比上週順"
 *   node src/adapters/cli-adapter.mjs --file examples/fake-data/lesson-input.json
 *   node src/adapters/cli-adapter.mjs --demo
 */

import fs from "node:fs";
import {
  generateLessonRecord,
  generateParentSummary,
  checkParentMessageRisk,
  extractAdminTasks,
  validateLessonRecord,
  validateConfig,
} from "../core/index.mjs";

async function main() {
  const args = process.argv.slice(2);

  // Check config
  const cfg = validateConfig();
  if (!cfg.ok) {
    console.error(`❌ Missing config: ${cfg.missing.join(", ")}`);
    console.error("   Copy .env.example to .env and add your OPENAI_API_KEY");
    process.exit(1);
  }

  let lessonRecord;

  // Parse input
  const inputIdx = args.indexOf("--input");
  const fileIdx = args.indexOf("--file");
  const demoMode = args.includes("--demo");

  if (demoMode) {
    console.log("🎓 Moosie EduOps — Demo Mode\n");
    const input = "S-003 今天上 past tense，口說比上週順，但 irregular verbs 還會混淆。作業完成一半，下次補 irregular verb worksheet。";
    console.log(`Teacher input: "${input}"\n`);
    lessonRecord = await generateLessonRecord(input);
  } else if (inputIdx !== -1 && args[inputIdx + 1]) {
    lessonRecord = await generateLessonRecord(args[inputIdx + 1]);
  } else if (fileIdx !== -1 && args[fileIdx + 1]) {
    const data = JSON.parse(fs.readFileSync(args[fileIdx + 1], "utf8"));
    // If it's already a structured lesson record, use it directly
    if (data.studentCode && data.topic) {
      lessonRecord = data;
    } else {
      lessonRecord = await generateLessonRecord(JSON.stringify(data));
    }
  } else {
    console.log("Usage:");
    console.log('  node cli-adapter.mjs --input "S-003 past tense 口說比上週順"');
    console.log("  node cli-adapter.mjs --file examples/fake-data/lesson-input.json");
    console.log("  node cli-adapter.mjs --demo");
    process.exit(0);
  }

  // Validate
  const validation = validateLessonRecord(lessonRecord);
  console.log("\n📋 Lesson Record:");
  console.log(JSON.stringify(lessonRecord, null, 2));

  if (validation.warnings.length > 0) {
    console.log(`\n⚠️  Warnings: ${validation.warnings.join(", ")}`);
  }

  // Generate parent summary
  console.log("\n💬 Parent Summary:");
  const summary = await generateParentSummary(lessonRecord);
  console.log(summary);

  // Risk check
  console.log("\n🔒 Risk Check:");
  const risk = await checkParentMessageRisk(summary, lessonRecord);
  console.log(`  Verdict: ${risk.verdict.toUpperCase()}`);
  console.log(`  Privacy: ${risk.privacyRisk} | Promise: ${risk.overPromising} | Tone: ${risk.tone}`);
  if (risk.issues?.length > 0) console.log(`  Issues: ${risk.issues.join(", ")}`);
  if (risk.suggestedRewrite) console.log(`  Rewrite: ${risk.suggestedRewrite}`);

  // Extract tasks
  console.log("\n📋 Tasks:");
  const tasks = await extractAdminTasks(lessonRecord);
  for (const t of tasks.tasks) {
    console.log(`  [${t.pool}] ${t.title} (${t.owner}, ${t.priority})`);
  }

  console.log("\n✅ Done");
}

main().catch((err) => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
