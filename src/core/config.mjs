/**
 * Core configuration — shared across all adapters.
 */

export const config = {
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.MODEL || "gpt-4o-mini",
    baseUrl: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
  },
  riskGate: {
    blockOnHighPrivacy: true,
    blockOnOverPromising: true,
    blockOnMentionsOther: true,
    blockOnBlaming: true,
  },
};

/**
 * Validate that required config is present.
 * @returns {{ ok: boolean, missing: string[] }}
 */
export function validateConfig() {
  const missing = [];
  if (!config.openai.apiKey) missing.push("OPENAI_API_KEY");
  return { ok: missing.length === 0, missing };
}
