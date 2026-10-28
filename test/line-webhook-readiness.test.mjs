import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SERVER_URL = pathToFileURL(
  resolve(PROJECT_ROOT, "src/adapters/line-webhook-server.mjs")
).href;
const EMPTY_CONFIG = {
  AI_PROVIDER: "",
  ANTHROPIC_API_KEY: "",
  OPENAI_API_KEY: "",
  LINE_CHANNEL_ACCESS_TOKEN: "",
  LINE_CHANNEL_SECRET: "",
  PORT: "0",
};
const HEALTH_PROBE = `
  import { app } from ${JSON.stringify(SERVER_URL)};
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  try {
    const response = await fetch(
      \`http://127.0.0.1:\${server.address().port}/health\`
    );
    console.log(JSON.stringify({ httpStatus: response.status, body: await response.json() }));
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve()))
    );
  }
`;

function runHealthProbe(overrides = {}) {
  const result = spawnSync(
    process.execPath,
    ["--input-type=module", "-e", HEALTH_PROBE],
    {
      cwd: PROJECT_ROOT,
      env: { ...process.env, ...EMPTY_CONFIG, ...overrides },
      encoding: "utf8",
      timeout: 5000,
    }
  );
  assert.equal(result.error, undefined, result.error?.message);
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout.trim());
}

describe("LINE webhook readiness", () => {
  it("returns HTTP 503 and only missing variable names when config is absent", () => {
    const result = runHealthProbe();

    assert.equal(result.httpStatus, 503);
    assert.deepEqual(result.body, {
      status: "not_ready",
      service: "moosie-line-webhook",
      missing: [
        "LINE_CHANNEL_ACCESS_TOKEN",
        "LINE_CHANNEL_SECRET",
        "OPENAI_API_KEY",
      ],
    });
  });

  it("reports ready with complete synthetic LINE and provider config", () => {
    const result = runHealthProbe({
      AI_PROVIDER: "openai",
      OPENAI_API_KEY: "synthetic-openai-key-not-a-real-secret",
      LINE_CHANNEL_ACCESS_TOKEN: "synthetic-line-token-not-a-real-secret",
      LINE_CHANNEL_SECRET: "synthetic-line-secret-not-a-real-secret",
    });

    assert.equal(result.httpStatus, 200);
    assert.deepEqual(result.body, {
      status: "ok",
      service: "moosie-line-webhook",
      records: 0,
    });
    assert.doesNotMatch(JSON.stringify(result.body), /synthetic-/);
  });

  it("exits before binding when startup config is missing", () => {
    const result = spawnSync(
      process.execPath,
      ["--import", "./scripts/load-env.mjs", "src/adapters/line-webhook-server.mjs"],
      {
        cwd: PROJECT_ROOT,
        env: { ...process.env, ...EMPTY_CONFIG },
        encoding: "utf8",
        timeout: 5000,
      }
    );

    assert.equal(result.error, undefined, result.error?.message);
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stderr, /LINE_CHANNEL_ACCESS_TOKEN/);
    assert.match(result.stderr, /LINE_CHANNEL_SECRET/);
    assert.match(result.stderr, /OPENAI_API_KEY/);
    assert.doesNotMatch(result.stdout, /listening on/);
  });
});
