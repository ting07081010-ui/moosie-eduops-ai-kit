#!/usr/bin/env node
/**
 * PII Scanner — Pre-commit hook + standalone scanner.
 *
 * Scans staged files for patterns that look like real PII:
 * - Taiwan mobile numbers (09xx-xxx-xxx)
 * - LINE IDs (@username)
 * - Chinese names (common surnames + 1-2 chars)
 * - Email addresses
 * - National ID numbers (A123456789 format)
 *
 * Usage:
 *   node scripts/pii-scanner.mjs                    # scan all tracked files
 *   node scripts/pii-scanner.mjs --staged            # scan staged files only (for pre-commit)
 *   node scripts/pii-scanner.mjs --file <path>       # scan a specific file
 *
 * Exit codes:
 *   0 = no PII found
 *   1 = PII detected (blocks commit)
 */

import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

// ── PII Patterns ───────────────────────────────────────────────

const PII_PATTERNS = [
  {
    name: "TW_MOBILE",
    pattern: /09\d{2}[-\s]?\d{3}[-\s]?\d{3}/g,
    severity: "high",
    description: "Taiwan mobile number",
    excludeIf: (match, line) =>
      line.includes("0912-345-678") || line.includes("0987-654-321") ||
      line.includes("Example") || line.includes("example") || line.includes("例如") ||
      line.includes("Taiwan mobile") || line.includes("PHONE_REDACTED") ||
      line.includes("PRIVACY") || line.includes("pii-scanner"),
  },
  {
    name: "TW_ID",
    pattern: /[A-Z][12]\d{8}/g,
    severity: "critical",
    description: "Taiwan national ID",
    // Exclude common false positives: S-001, A1234 test patterns
    excludeIf: (match, line) => /^[Ss]-\d/.test(match) || match.length !== 10 || line.includes("A123456789") || line.includes("excludeIf") || line.includes("pattern"),
  },
  {
    name: "EMAIL",
    pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    severity: "high",
    description: "Email address",
    // Exclude common test/placeholder emails
    excludeIf: (match, line) =>
      /example\.com|test\.com|localhost|openclaw\.local|moosie-edu\.com|noreply\./.test(match) ||
      line.includes("Example") || line.includes("example") || line.includes("例如") || line.includes("譬如") ||
      line.includes("0912-345-678") || line.includes("@moosie123") || line.includes("王小明") || line.includes("PHONE_REDACTED")
  },
  {
    name: "LINE_ID",
    pattern: /@[A-Za-z0-9._-]{3,}/g,
    severity: "medium",
    description: "LINE ID",
    // Exclude common code patterns (@import, @param, etc.)
    excludeIf: (match) => /^@(import|param|returns?|type|see|deprecated|override|inheritdoc|link|example|since|version|author|throws|enum|default|namespace|module|public|private|protected|readonly|abstract|static|async|await|yield|from|as|of|in|for|if|else|while|do|switch|case|break|continue|return|throw|try|catch|finally|new|delete|typeof|instanceof|void|null|undefined|true|false|this|super|class|extends|implements|interface|type|const|let|var|function|username|moosie|teacher|parent|student|admin|=>)/.test(match),
  },
  {
    name: "ZH_NAME",
    pattern: /[\u738b\u674e\u5f35\u5289\u9673\u694a\u9ec3\u8d99\u5433\u5468\u5f90\u5b6b\u80e1\u6731\u9ad8\u6797\u4f55\u90ed\u99ac\u7f85][\u4e00-\u9fff]{1,2}/g,
    severity: "medium",
    description: "Chinese name (common surname)",
    // Exclude if it appears in a comment about names or in test data markers
    excludeIf: (match, line) =>
      (line.includes("//") || line.includes("*")) && (line.includes("name") || line.includes("姓名") || line.includes("surnames") || line.includes("常見")) ||
      line.includes("黃燈") || line.includes("excludeIf") || line.includes("pattern") || line.includes("description") ||
      line.includes("0912-345-678") || line.includes("@moosie123") || line.includes("王小明") ||
      line.includes("PRIVACY") || line.includes("Taiwan mobile") || line.includes("PHONE_REDACTED") ||
      line.includes("LINE ID") || line.includes("Chinese name")
  },
];

// ── File Scanning ──────────────────────────────────────────────

const SCAN_EXTENSIONS = new Set([
  ".mjs", ".js", ".ts", ".jsx", ".tsx",
  ".json", ".yml", ".yaml", ".md",
  ".env", ".env.example",
]);

const SCAN_FILE_NAMES = new Set([
  ".env.example",
]);

const SKIP_DIRS = new Set([
  "node_modules", ".git", ".husky", "coverage", "dist", "build",
]);

const SKIP_FILES = new Set([
  "package-lock.json", "yarn.lock", "pnpm-lock.yaml",
]);

/**
 * Get files to scan.
 */
function getFiles(mode, specificFile) {
  if (specificFile) return [specificFile];

  if (mode === "staged") {
    try {
      const output = execSync("git diff --cached --name-only --diff-filter=ACM", {
        encoding: "utf-8",
        cwd: findRepoRoot(),
      });
      return output.trim().split("\n").filter(Boolean);
    } catch {
      return [];
    }
  }

  // Scan all tracked files
  return getAllFiles(findRepoRoot());
}

function getAllFiles(dir, root = dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) {
        results.push(...getAllFiles(full, root));
      }
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name);
      if ((SCAN_EXTENSIONS.has(ext) || SCAN_FILE_NAMES.has(entry.name)) && !SKIP_FILES.has(entry.name)) {
        results.push(path.relative(root, full));
      }
    }
  }
  return results;
}

function findRepoRoot() {
  try {
    return execSync("git rev-parse --show-toplevel", {
      encoding: "utf-8",
    }).trim();
  } catch {
    return process.cwd();
  }
}

/**
 * Scan a single file for PII.
 */
function scanFile(filePath) {
  const findings = [];

  let content;
  try {
    content = fs.readFileSync(filePath, "utf-8");
  } catch {
    return findings; // binary or unreadable
  }

  const lines = content.split("\n");

  for (const pii of PII_PATTERNS) {
    for (let lineNum = 0; lineNum < lines.length; lineNum++) {
      const line = lines[lineNum];
      const matches = line.matchAll(pii.pattern);

      for (const match of matches) {
        // Apply exclusion filter
        if (pii.excludeIf && pii.excludeIf(match[0], line)) continue;

        findings.push({
          file: filePath,
          line: lineNum + 1,
          column: match.index + 1,
          match: match[0],
          type: pii.name,
          severity: pii.severity,
          description: pii.description,
        });
      }
    }
  }

  return findings;
}

// ── Main ───────────────────────────────────────────────────────

function main() {
  const args = process.argv.slice(2);
  const staged = args.includes("--staged");
  const fileIdx = args.indexOf("--file");
  const specificFile = fileIdx !== -1 ? args[fileIdx + 1] : null;

  const files = getFiles(staged ? "staged" : "all", specificFile);

  if (files.length === 0) {
    console.log("✅ No files to scan");
    process.exit(0);
  }

  console.log(`🔍 PII Scanner — scanning ${files.length} file(s)${staged ? " (staged)" : ""}\n`);

  const allFindings = [];

  for (const file of files) {
    const absPath = specificFile && path.isAbsolute(file)
      ? file
      : path.join(findRepoRoot(), file);

    if (!fs.existsSync(absPath)) continue;

    const findings = scanFile(absPath);
    allFindings.push(...findings);
  }

  // Report
  if (allFindings.length === 0) {
    console.log("✅ No PII detected");
    process.exit(0);
  }

  // Group by severity
  const critical = allFindings.filter((f) => f.severity === "critical");
  const high = allFindings.filter((f) => f.severity === "high");
  const medium = allFindings.filter((f) => f.severity === "medium");

  if (critical.length > 0) {
    console.log("🚨 CRITICAL — Must fix before commit:");
    for (const f of critical) {
      console.log(`   ${f.file}:${f.line}:${f.column} — ${f.type}: ${f.match}`);
    }
    console.log();
  }

  if (high.length > 0) {
    console.log("🔴 HIGH — Likely real PII:");
    for (const f of high) {
      console.log(`   ${f.file}:${f.line}:${f.column} — ${f.type}: ${f.match}`);
    }
    console.log();
  }

  if (medium.length > 0) {
    console.log("🟡 MEDIUM — Possible PII (review recommended):");
    for (const f of medium) {
      console.log(`   ${f.file}:${f.line}:${f.column} — ${f.type}: ${f.match}`);
    }
    console.log();
  }

  console.log(`Found ${allFindings.length} potential PII pattern(s): ${critical.length} critical, ${high.length} high, ${medium.length} medium`);

  // Block on critical or high
  if (critical.length > 0 || high.length > 0) {
    console.log("\n❌ Commit blocked. Remove PII or add false positive to excludeIf.");
    process.exit(1);
  }

  // Warn but allow on medium
  console.log("\n⚠️  Medium findings reviewed. Proceeding.");
  process.exit(0);
}

main();
