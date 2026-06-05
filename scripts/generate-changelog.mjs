#!/usr/bin/env node
/**
 * Generate release notes from Conventional Commits.
 *
 * Usage:
 *   node scripts/generate-changelog.mjs
 *   node scripts/generate-changelog.mjs --since v0.1.0 --version v0.2.0 --output RELEASE_NOTES.md
 */

import fs from "node:fs";
import { execFileSync } from "node:child_process";

const args = process.argv.slice(2);

function getArg(name) {
  const idx = args.indexOf(name);
  return idx === -1 ? null : args[idx + 1];
}

function git(args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

function getLastTag() {
  try {
    return git(["describe", "--tags", "--abbrev=0"]);
  } catch {
    return null;
  }
}

function getCommitLines(since) {
  const range = since ? `${since}..HEAD` : "HEAD";
  return git(["log", range, "--pretty=format:%H%x09%s"])
    .split("\n")
    .filter(Boolean);
}

function parseCommit(line) {
  const [hash, subject] = line.split("\t");
  const match = subject.match(/^(\w+)(?:\(([^)]+)\))?(!)?:\s+(.+)$/);
  if (!match) return null;

  const [, type, scope, breaking, description] = match;
  return {
    hash: hash.slice(0, 7),
    type,
    scope,
    breaking: Boolean(breaking),
    description,
  };
}

function groupFor(commit) {
  if (commit.breaking) return "Breaking Changes";
  if (commit.type === "feat") return "Features";
  if (commit.type === "fix") return "Fixes";
  if (commit.type === "docs") return "Documentation";
  if (["test", "eval"].includes(commit.type)) return "Tests & Evals";
  if (["ci", "build"].includes(commit.type)) return "CI";
  if (["security", "privacy"].includes(commit.type) || ["security", "privacy"].includes(commit.scope)) {
    return "Privacy & Security";
  }
  return "Internal";
}

function render(version, since, commits) {
  const date = new Date().toISOString().slice(0, 10);
  const groups = new Map();

  for (const commit of commits) {
    const group = groupFor(commit);
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group).push(commit);
  }

  const order = [
    "Breaking Changes",
    "Features",
    "Fixes",
    "Documentation",
    "Privacy & Security",
    "Tests & Evals",
    "CI",
    "Internal",
  ];

  const lines = [
    `## ${version} - ${date}`,
    "",
    since ? `Changes since ${since}.` : "Changes from the available commit history.",
    "",
  ];

  for (const group of order) {
    const items = groups.get(group) || [];
    if (items.length === 0) continue;

    lines.push(`### ${group}`, "");
    for (const item of items) {
      const scope = item.scope ? `**${item.scope}:** ` : "";
      lines.push(`- ${scope}${item.description} (${item.hash})`);
    }
    lines.push("");
  }

  if (commits.length === 0) {
    lines.push("No conventional commits found.", "");
  }

  return lines.join("\n");
}

const since = getArg("--since") || getLastTag();
const version = getArg("--version") || "Unreleased";
const output = getArg("--output");
const commits = getCommitLines(since).map(parseCommit).filter(Boolean);
const markdown = render(version, since, commits);

if (output) {
  fs.writeFileSync(output, markdown);
  console.log(`Wrote ${output}`);
} else {
  console.log(markdown);
}
