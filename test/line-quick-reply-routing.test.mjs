import assert from "node:assert/strict";
import { it } from "node:test";
import { handleMessage } from "../src/adapters/line-webhook-server.mjs";

it("keeps slash-prefixed messages out of the quick-reply lesson pipeline", async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    return { ok: true, text: async () => "" };
  };

  try {
    await handleMessage({
      source: { type: "user", userId: "synthetic-line-user-slash-route" },
      replyToken: "synthetic-slash-route-reply",
      message: { type: "text", text: "/unknown this must not become a lesson note" },
    });

    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "https://api.line.me/v2/bot/message/reply");
    const reply = JSON.parse(calls[0].options.body);
    assert.equal(reply.replyToken, "synthetic-slash-route-reply");
    assert.match(reply.messages[0].text, /不使用斜線指令/);
    assert.match(reply.messages[0].text, /npm run line:slash-demo/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
