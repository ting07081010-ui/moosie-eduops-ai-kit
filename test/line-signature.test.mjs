import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { app, verifySignature } from "../src/adapters/line-webhook-server.mjs";
import { verifyLineSignature } from "../src/adapters/line-signature.mjs";

const TEST_SECRET = "synthetic-line-channel-secret";
const rawBody = Buffer.from('{"events":[]}');
const validSignature = crypto
  .createHmac("sha256", TEST_SECRET)
  .update(rawBody)
  .digest("base64");
const originalSecret = process.env.LINE_CHANNEL_SECRET;
process.env.LINE_CHANNEL_SECRET = TEST_SECRET;

after(() => {
  if (originalSecret === undefined) delete process.env.LINE_CHANNEL_SECRET;
  else process.env.LINE_CHANNEL_SECRET = originalSecret;
});

describe("LINE webhook signature verification", () => {
  it("fails closed for missing or non-Buffer raw bodies and missing signatures", () => {
    assert.equal(verifyLineSignature(undefined, validSignature, TEST_SECRET), false);
    assert.equal(verifyLineSignature("{\"events\":[]}", validSignature, TEST_SECRET), false);
    assert.equal(verifyLineSignature(rawBody, undefined, TEST_SECRET), false);
    assert.equal(verifyLineSignature(rawBody, validSignature, ""), false);

    assert.equal(verifySignature({ headers: { "x-line-signature": validSignature } }), false);
    assert.equal(
      verifySignature({ rawBody: "{\"events\":[]}", headers: { "x-line-signature": validSignature } }),
      false
    );
  });

  it("rejects malformed signature encodings and correctly shaped but invalid signatures", () => {
    assert.equal(verifyLineSignature(rawBody, "not-base64", TEST_SECRET), false);
    assert.equal(verifyLineSignature(rawBody, `${"A".repeat(43)}=`, TEST_SECRET), false);
    assert.equal(verifyLineSignature(rawBody, `${validSignature.slice(0, -2)}AA`, TEST_SECRET), false);
    assert.equal(
      verifyLineSignature(Buffer.from('{"events":[1]}'), validSignature, TEST_SECRET),
      false
    );
  });

  it("accepts the matching HMAC-SHA256 signature", () => {
    assert.equal(verifyLineSignature(rawBody, validSignature, TEST_SECRET), true);
    assert.equal(
      verifySignature({ rawBody, headers: { "x-line-signature": validSignature } }),
      true
    );
  });

  it("returns 401 for unsupported content types with no captured raw body", async () => {
    const server = app.listen(0, "127.0.0.1");
    await new Promise((resolve) => server.once("listening", resolve));
    try {
      const response = await fetch(`http://127.0.0.1:${server.address().port}/webhook`, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: "synthetic body",
      });
      assert.equal(response.status, 401);
    } finally {
      await new Promise((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve()))
      );
    }
  });

  it("accepts valid signatures and rejects invalid signatures at the webhook route", async () => {
    const server = app.listen(0, "127.0.0.1");
    await new Promise((resolve) => server.once("listening", resolve));
    try {
      const url = `http://127.0.0.1:${server.address().port}/webhook`;
      const accepted = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-line-signature": validSignature },
        body: rawBody,
      });
      assert.equal(accepted.status, 200);

      const rejected = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-line-signature": "malformed" },
        body: rawBody,
      });
      assert.equal(rejected.status, 401);
    } finally {
      await new Promise((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve()))
      );
    }
  });
});
