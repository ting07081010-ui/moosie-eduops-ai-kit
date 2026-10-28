import crypto from "node:crypto";

const SHA256_BASE64_SIGNATURE = /^[A-Za-z0-9+/]{43}=$/;

export function verifyLineSignature(rawBody, signature, secret) {
  if (!Buffer.isBuffer(rawBody)) return false;
  if (typeof signature !== "string" || !SHA256_BASE64_SIGNATURE.test(signature)) {
    return false;
  }
  if (typeof secret !== "string" || secret.length === 0) return false;

  const received = Buffer.from(signature, "base64");
  if (received.length !== 32 || received.toString("base64") !== signature) {
    return false;
  }

  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest();
  return expected.length === received.length && crypto.timingSafeEqual(expected, received);
}
