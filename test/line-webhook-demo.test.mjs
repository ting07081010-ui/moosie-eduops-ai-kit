import { describe, it } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { createApp } from "../examples/line-webhook-demo/server.mjs";

const TEST_SECRET = "synthetic-line-channel-secret-for-demo-webhook";
const nativeFetch = globalThis.fetch.bind(globalThis);

function signatureFor(rawBody) {
  return crypto.createHmac("sha256", TEST_SECRET).update(rawBody).digest("base64");
}

async function postWebhook(url, rawBody) {
  return nativeFetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-line-signature": signatureFor(rawBody),
    },
    body: rawBody,
  });
}

async function withServer(options, run) {
  const app = createApp({
    openAiApiKey: "synthetic-openai-key",
    lineChannelAccessToken: "synthetic-line-token",
    lineChannelSecret: TEST_SECRET,
    logger: { warn() {}, error() {} },
    ...options,
  });
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  try {
    await run(`http://127.0.0.1:${server.address().port}/webhook`);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve()))
    );
  }
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function withDeadline(promise, label, ms = 1_500) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Timed out: ${label}`)), ms);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

describe("LINE webhook demo HTTP handling", () => {
  it("shows the command guide for unknown slash prefixes without calling AI", async () => {
    const replySeen = deferred();
    const urls = [];
    let reply;
    const fetchImpl = async (url, options) => {
      urls.push(url);
      if (url === "https://api.line.me/v2/bot/message/reply") {
        reply = JSON.parse(options.body);
        replySeen.resolve();
      }
      return { ok: true, text: async () => "" };
    };

    await withServer({ fetchImpl }, async (url) => {
      const response = await postWebhook(url, JSON.stringify({
        events: [{
          type: "message",
          replyToken: "synthetic-unknown-slash-command",
          message: { type: "text", text: "/riskish should not become lesson input" },
        }],
      }));
      assert.equal(response.status, 200);
      await withDeadline(replySeen.promise, "unknown slash command guide");
      assert.deepEqual(urls, ["https://api.line.me/v2/bot/message/reply"]);
      assert.equal(reply.replyToken, "synthetic-unknown-slash-command");
      assert.match(reply.messages[0].text, /Available commands/);
      assert.match(reply.messages[0].text, /not sent to AI/);
    });
  });

  it("returns a proper response for invalid payloads and skips malformed event entries", async () => {
    const replies = [];
    const replySeen = deferred();
    const fetchImpl = async (_url, options) => {
      const reply = JSON.parse(options.body);
      replies.push(reply);
      replySeen.resolve();
      return { ok: true, text: async () => "" };
    };

    await withServer({ fetchImpl }, async (url) => {
      for (const payload of [[], null, { events: "not-an-array" }]) {
        const response = await postWebhook(url, JSON.stringify(payload));
        assert.equal(response.status, 400);
      }

      const payload = {
        events: [
          null,
          {},
          { type: "message" },
          { type: "message", message: null, replyToken: "synthetic-null-message" },
          {
            type: "message",
            message: { type: "text", text: 42 },
            replyToken: "synthetic-non-string-text",
          },
          {
            type: "message",
            message: { type: "text", text: "missing reply token" },
          },
          {
            type: "message",
            replyToken: "synthetic-valid-reply",
            message: { type: "text", text: "hello" },
          },
        ],
      };
      const response = await postWebhook(url, JSON.stringify(payload));
      assert.equal(response.status, 200);
      await withDeadline(replySeen.promise, "valid event reply");
      assert.equal(replies.length, 1);
      assert.equal(replies[0].replyToken, "synthetic-valid-reply");
      assert.match(replies[0].messages[0].text, /Available commands/);
    });
  });

  it("ACKs before delayed external work and contains its failure without blocking sibling events", async () => {
    const aiStarted = deferred();
    const ordinaryReplyStarted = deferred();
    const failureReplyStarted = deferred();
    const replies = [];
    let rejectAi;

    const fetchImpl = async (url, options) => {
      assert.ok(options.signal instanceof AbortSignal, "outbound fetch must have a bounded timeout signal");
      if (url === "https://api.openai.com/v1/chat/completions") {
        aiStarted.resolve(options.signal);
        return new Promise((_resolve, reject) => {
          rejectAi = reject;
        });
      }

      assert.equal(url, "https://api.line.me/v2/bot/message/reply");
      const reply = JSON.parse(options.body);
      replies.push(reply);
      if (reply.replyToken === "synthetic-ordinary-event") ordinaryReplyStarted.resolve();
      if (reply.replyToken === "synthetic-delayed-ai-event") failureReplyStarted.resolve();
      return { ok: true, text: async () => "" };
    };

    await withServer({ fetchImpl, requestTimeoutMs: 5_000 }, async (url) => {
      const payload = {
        events: [
          {
            type: "message",
            replyToken: "synthetic-delayed-ai-event",
            message: { type: "text", text: "/risk sample message" },
          },
          {
            type: "message",
            replyToken: "synthetic-ordinary-event",
            message: { type: "text", text: "hello" },
          },
        ],
      };

      const response = await withDeadline(
        postWebhook(url, JSON.stringify(payload)),
        "webhook ACK despite delayed OpenAI request"
      );
      assert.equal(response.status, 200);
      const aiSignal = await withDeadline(aiStarted.promise, "OpenAI request start");
      await withDeadline(ordinaryReplyStarted.promise, "sibling event reply");

      rejectAi(new Error("synthetic delayed OpenAI failure"));
      await withDeadline(failureReplyStarted.promise, "failed event fallback reply");

      const failedEventReply = replies.find((reply) => reply.replyToken === "synthetic-delayed-ai-event");
      assert.ok(failedEventReply);
      assert.match(failedEventReply.messages[0].text, /Something went wrong/);
      assert.ok(aiSignal instanceof AbortSignal);
      assert.equal(replies.length, 2);
    });
  });
});
