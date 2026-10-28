import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import {
  app,
  dispatchWebhookEventSafely,
} from "../src/adapters/line-webhook-server.mjs";

const TEST_SECRET = "synthetic-line-channel-secret-for-webhook-validation";
const originalLineSecret = process.env.LINE_CHANNEL_SECRET;
const nativeFetch = globalThis.fetch.bind(globalThis);
process.env.LINE_CHANNEL_SECRET = TEST_SECRET;

after(() => {
  if (originalLineSecret === undefined) delete process.env.LINE_CHANNEL_SECRET;
  else process.env.LINE_CHANNEL_SECRET = originalLineSecret;
});

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

async function withWebhookServer(run) {
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  try {
    await run(`http://127.0.0.1:${server.address().port}/webhook`);
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve()))
    );
  }
}

function createSignal() {
  let resolve;
  let timeout;
  const promise = new Promise((res, reject) => {
    resolve = res;
    timeout = setTimeout(() => reject(new Error("Timed out waiting for webhook event handling")), 1000);
  });
  return {
    promise,
    signal() {
      clearTimeout(timeout);
      resolve();
    },
  };
}

describe("LINE webhook payload validation", () => {
  it("returns 400 for a malformed top-level body or a body without events", async () => {
    await withWebhookServer(async (url) => {
      for (const payload of [[], {}]) {
        const response = await postWebhook(url, JSON.stringify(payload));
        assert.equal(response.status, 400);
      }
    });
  });

  it("returns 400 when events is not an array", async () => {
    await withWebhookServer(async (url) => {
      const response = await postWebhook(url, JSON.stringify({ events: "not-an-array" }));
      assert.equal(response.status, 400);
    });
  });

  it("skips null and malformed message entries while processing a valid message", async () => {
    const originalFetch = globalThis.fetch;
    const replies = [];
    const replyReceived = createSignal();
    globalThis.fetch = async (_url, options) => {
      replies.push(JSON.parse(options.body));
      replyReceived.signal();
      return { ok: true, text: async () => "" };
    };

    try {
      await withWebhookServer(async (url) => {
        const payload = {
          events: [
            null,
            {},
            { type: "message" },
            { type: "message", message: { type: "text", text: 42 }, replyToken: "synthetic-bad-text" },
            { type: "message", message: { type: "text", text: "missing reply token" } },
            {
              type: "message",
              replyToken: "synthetic-valid-reply",
              source: { type: "user", userId: "synthetic-line-user" },
              message: { type: "text", text: "hello" },
            },
          ],
        };
        const response = await postWebhook(url, JSON.stringify(payload));
        assert.equal(response.status, 200);
        await replyReceived.promise;
        assert.equal(replies.length, 1);
        assert.equal(replies[0].replyToken, "synthetic-valid-reply");
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("contains a per-event async failure without an unhandled rejection or blocking its sibling", async () => {
    const originalFetch = globalThis.fetch;
    const originalConsoleError = console.error;
    const calls = [];
    const errors = [];
    const bothCallsStarted = createSignal();
    const unhandledRejections = [];
    const onUnhandledRejection = (reason) => unhandledRejections.push(reason);
    process.on("unhandledRejection", onUnhandledRejection);
    console.error = (...args) => errors.push(args);
    globalThis.fetch = async (_url, options) => {
      const reply = JSON.parse(options.body);
      calls.push(reply.replyToken);
      if (calls.length === 2) bothCallsStarted.signal();
      if (reply.replyToken === "synthetic-failing-reply") {
        throw new Error("synthetic outbound failure");
      }
      return { ok: true, text: async () => "" };
    };

    try {
      await withWebhookServer(async (url) => {
        const payload = {
          events: [
            {
              type: "message",
              replyToken: "synthetic-failing-reply",
              source: { type: "user", userId: "synthetic-line-user-a" },
              message: { type: "text", text: "first" },
            },
            {
              type: "message",
              replyToken: "synthetic-successful-reply",
              source: { type: "user", userId: "synthetic-line-user-b" },
              message: { type: "text", text: "second" },
            },
          ],
        };
        const response = await postWebhook(url, JSON.stringify(payload));
        assert.equal(response.status, 200);
        await bothCallsStarted.promise;
        await new Promise((resolve) => setImmediate(resolve));
        assert.equal(calls.filter((token) => token === "synthetic-failing-reply").length, 2);
        assert.equal(calls.filter((token) => token === "synthetic-successful-reply").length, 1);
        assert.equal(errors.length, 2);
        assert.deepEqual(unhandledRejections, []);
      });
    } finally {
      process.removeListener("unhandledRejection", onUnhandledRejection);
      console.error = originalConsoleError;
      globalThis.fetch = originalFetch;
    }
  });

  it("sends safe retry guidance after a quick-reply handler failure", async () => {
    const replies = [];
    const errors = [];
    const event = {
      type: "message",
      replyToken: "synthetic-quick-reply-failure",
      source: { type: "user", userId: "synthetic-line-user" },
      message: { type: "text", text: "generate_summary" },
    };

    await dispatchWebhookEventSafely(event, {
      processMessage: async (receivedEvent) => {
        assert.equal(receivedEvent.message.text, "generate_summary");
        throw new Error("synthetic internal API diagnostic and secret");
      },
      sendReply: async (replyToken, message) => replies.push({ replyToken, message }),
      logError: (...args) => errors.push(args),
    });

    assert.equal(replies.length, 1);
    assert.equal(replies[0].replyToken, event.replyToken);
    assert.deepEqual(replies[0].message, {
      type: "text",
      text: "處理這則訊息時發生問題，請稍後再試一次。",
    });
    assert.equal(JSON.stringify(replies).includes("synthetic internal API diagnostic"), false);
    assert.equal(errors.length, 1);
  });

  it("contains fallback-send failures without an unhandled rejection", async () => {
    const errors = [];
    const unhandledRejections = [];
    const onUnhandledRejection = (reason) => unhandledRejections.push(reason);
    process.on("unhandledRejection", onUnhandledRejection);

    try {
      await dispatchWebhookEventSafely({
        type: "message",
        replyToken: "synthetic-fallback-send-failure",
        source: { type: "user", userId: "synthetic-line-user" },
        message: { type: "text", text: "check_risk" },
      }, {
        processMessage: async () => {
          throw new Error("synthetic quick-reply processing failure");
        },
        sendReply: async () => {
          throw new Error("synthetic fallback transport failure");
        },
        logError: (...args) => errors.push(args),
      });
      await new Promise((resolve) => setImmediate(resolve));

      assert.equal(errors.length, 2);
      assert.deepEqual(unhandledRejections, []);
    } finally {
      process.removeListener("unhandledRejection", onUnhandledRejection);
    }
  });
});
