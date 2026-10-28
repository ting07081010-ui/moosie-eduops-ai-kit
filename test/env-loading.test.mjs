import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packageJson = JSON.parse(readFileSync(path.join(ROOT, "package.json"), "utf8"));
const LOADER = path.join(ROOT, "scripts/load-env.mjs");
const CONFIG_URL = pathToFileURL(path.join(ROOT, "src/core/config.mjs")).href;

describe("environment file bootstrap", () => {
  it("loads .env values before config snapshots process.env", () => {
    const cwd = mkdtempSync(path.join(os.tmpdir(), "moosi-env-test-"));
    writeFileSync(
      path.join(cwd, ".env"),
      "OPENAI_API_KEY=synthetic-env-file-key\nMODEL=file-model\n"
    );

    const env = { ...process.env, MODEL: "shell-model" };
    for (const key of ["OPENAI_API_KEY", "ANTHROPIC_API_KEY", "AI_PROVIDER", "ANTHROPIC_MODEL"]) {
      delete env[key];
    }

    try {
      const source = `import { config, validateConfig } from ${JSON.stringify(CONFIG_URL)};\nconsole.log(JSON.stringify({ apiKey: config.openai.apiKey, model: config.openai.model, valid: validateConfig().ok }));`;
      const result = spawnSync(
        process.execPath,
        ["--import", LOADER, "--input-type=module", "--eval", source],
        { cwd, env, encoding: "utf8", timeout: 5000 }
      );

      assert.equal(result.status, 0, result.stderr);
      assert.deepEqual(JSON.parse(result.stdout), {
        apiKey: "synthetic-env-file-key",
        model: "shell-model",
        valid: true,
      });
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("preloads .env for every documented environment-dependent npm command", () => {
    for (const name of [
      "cli",
      "demo",
      "demo:moosi-say",
      "line",
      "line:quick-reply",
      "line:demo",
      "line:slash-demo",
      "eval",
      "eval:structural",
    ]) {
      assert.match(
        packageJson.scripts[name],
        /^node --import \.\/scripts\/load-env\.mjs /,
        `${name} must preload the environment before its entry module`
      );
    }
  });
});
