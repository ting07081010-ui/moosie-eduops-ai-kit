import { describe, it } from "node:test";
import assert from "node:assert";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { callLLM } from "../src/core/llm.mjs";
import { config, validateConfig } from "../src/core/config.mjs";
import {
  DEFAULT_CLAUDE_MODEL,
  claudeModel,
  completeWithClaude,
  resolveProvider,
  textFromClaudeMessage,
} from "../src/core/provider.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

describe("provider selection", () => {
  it("keeps today's OpenAI default when no Claude key is set", () => {
    assert.equal(resolveProvider({}), "openai");
    assert.equal(resolveProvider({ AI_PROVIDER: "" }), "openai");
  });

  it("defaults to claude when ANTHROPIC_API_KEY is set", () => {
    assert.equal(resolveProvider({ ANTHROPIC_API_KEY: "test-key" }), "claude");
  });

  it("lets AI_PROVIDER choose explicitly", () => {
    assert.equal(
      resolveProvider({ AI_PROVIDER: "openai", ANTHROPIC_API_KEY: "test-key" }),
      "openai"
    );
    assert.equal(resolveProvider({ AI_PROVIDER: "claude" }), "claude");
    assert.equal(resolveProvider({ AI_PROVIDER: "Claude" }), "claude");
  });

  it("rejects an unknown provider", () => {
    assert.throws(
      () => resolveProvider({ AI_PROVIDER: "gemini" }),
      /Unknown AI_PROVIDER/
    );
  });

  it("uses the current Claude Sonnet id unless ANTHROPIC_MODEL is set", () => {
    assert.equal(DEFAULT_CLAUDE_MODEL, "claude-sonnet-5-5");
    assert.equal(claudeModel({}), "claude-sonnet-5-5");
    assert.equal(claudeModel({ ANTHROPIC_MODEL: "claude-haiku-5-5" }), "claude-haiku-5-5");
  });
});

describe("Claude adapter", () => {
  it("calls the SDK messages API and returns text only", async () => {
    const calls = [];
    const client = {
      messages: {
        create: async (params) => {
          calls.push(params);
          return {
            content: [
              { type: "thinking", thinking: "draft" },
              { type: "text", text: "  Hello, S-001.  " },
            ],
          };
        },
      },
    };

    const text = await completeWithClaude("system prompt", { studentCode: "S-001" }, {
      client,
      model: "claude-sonnet-5-5",
    });

    assert.equal(text, "Hello, S-001.");
    assert.equal(calls.length, 1);
    assert.equal(calls[0].model, "claude-sonnet-5-5");
    assert.equal(calls[0].max_tokens, 4096);
    assert.deepEqual(calls[0].system, [
      { type: "text", text: "system prompt", cache_control: { type: "ephemeral" } },
    ]);
    assert.deepEqual(calls[0].messages, [
      { role: "user", content: JSON.stringify({ studentCode: "S-001" }) },
    ]);
    assert.equal("temperature" in calls[0], false);
  });

  it("drops non-text blocks when reading a message", () => {
    assert.equal(
      textFromClaudeMessage({
        content: [
          { type: "thinking", thinking: "hidden" },
          { type: "text", text: "visible" },
        ],
      }),
      "visible"
    );
  });

  it("throws when the SDK returns no text", async () => {
    const client = {
      messages: {
        create: async () => ({ content: [{ type: "thinking", thinking: "only" }] }),
      },
    };
    await assert.rejects(
      () => completeWithClaude("system", "user", { client }),
      /no text/
    );
  });
});

describe("callLLM routing", { concurrency: 1 }, () => {
  it("uses the mocked Claude SDK and does not call fetch", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      throw new Error("OpenAI fetch should not run");
    };
    try {
      const text = await callLLM("system", "user payload", {
        provider: "claude",
        maxRetries: 0,
        anthropicClient: {
          messages: {
            create: async (params) => {
              assert.equal(params.messages[0].content, "user payload");
              return { content: [{ type: "text", text: "claude draft" }] };
            },
          },
        },
      });
      assert.equal(text, "claude draft");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("keeps the OpenAI chat-completions request shape", async () => {
    const originalFetch = globalThis.fetch;
    const calls = [];
    globalThis.fetch = async (url, init) => {
      calls.push({ url, init });
      return {
        ok: true,
        json: async () => ({ choices: [{ message: { content: "  openai draft  " } }] }),
      };
    };
    try {
      const text = await callLLM("system", { studentCode: "S-001" }, {
        provider: "openai",
        maxRetries: 0,
        temperature: 0.2,
      });
      assert.equal(text, "openai draft");
      assert.equal(calls.length, 1);
      assert.match(String(calls[0].url), /\/chat\/completions$/);
      const body = JSON.parse(calls[0].init.body);
      assert.equal(body.model, config.openai.model);
      assert.equal(body.temperature, 0.2);
      assert.deepEqual(body.messages[0], { role: "system", content: "system" });
      assert.equal(body.messages[1].content, JSON.stringify({ studentCode: "S-001" }));
      assert.equal(calls[0].init.headers.Authorization, `Bearer ${config.openai.apiKey}`);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("requires ANTHROPIC_API_KEY when Claude is selected", () => {
    const prevProvider = process.env.AI_PROVIDER;
    const prevKey = process.env.ANTHROPIC_API_KEY;
    process.env.AI_PROVIDER = "claude";
    delete process.env.ANTHROPIC_API_KEY;
    try {
      const result = validateConfig();
      assert.equal(result.ok, false);
      assert.deepEqual(result.missing, ["ANTHROPIC_API_KEY"]);
    } finally {
      if (prevProvider === undefined) delete process.env.AI_PROVIDER;
      else process.env.AI_PROVIDER = prevProvider;
      if (prevKey === undefined) delete process.env.ANTHROPIC_API_KEY;
      else process.env.ANTHROPIC_API_KEY = prevKey;
    }
  });
});

describe("demo dry-run", () => {
  function runDemo(args, env) {
    return spawnSync(process.execPath, ["scripts/demo.mjs", ...args], {
      cwd: ROOT,
      encoding: "utf8",
      env: { ...process.env, ...env },
      timeout: 15000,
    });
  }

  it("prints both fake workflows without an API key", () => {
    const result = runDemo(["--dry-run"], {
      AI_PROVIDER: "",
      ANTHROPIC_API_KEY: "",
      OPENAI_API_KEY: "",
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /dry-run \(no API call\)/);
    assert.match(result.stdout, /Parent-friendly progress report/);
    assert.match(result.stdout, /Level-matched project activity/);
    assert.match(result.stdout, /S-001/);
    assert.match(result.stdout, /claude-sonnet-5-5/);
    assert.match(result.stdout, /Local risk pre-check: no flags/);
    assert.doesNotMatch(result.stdout, /sk-/);
  });

  it("accepts --mock as the same offline mode", () => {
    const result = runDemo(["--mock"], {
      ANTHROPIC_API_KEY: "",
      OPENAI_API_KEY: "",
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Yesterday Photo Story/);
  });

  it("refuses a live run when the selected key is missing", () => {
    const result = runDemo([], {
      AI_PROVIDER: "claude",
      ANTHROPIC_API_KEY: "",
      OPENAI_API_KEY: "",
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /ANTHROPIC_API_KEY/);
    assert.match(result.stderr, /--dry-run/);
  });
});
