/**
 * Minimal LLM provider switch.
 *
 * AI_PROVIDER=claude|openai selects explicitly.
 * When AI_PROVIDER is unset, Claude is used if ANTHROPIC_API_KEY is set;
 * otherwise the caller stays on the existing OpenAI path.
 *
 * Default model id is the current Claude Sonnet from
 * https://docs.anthropic.com/en/docs/about-claude/models/overview
 */

import Anthropic from "@anthropic-ai/sdk";

export const DEFAULT_CLAUDE_MODEL = "claude-sonnet-5-5";

/**
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {"claude" | "openai"}
 */
export function resolveProvider(env = process.env) {
  const explicit = String(env.AI_PROVIDER || "").trim().toLowerCase();
  if (explicit === "claude" || explicit === "openai") return explicit;
  if (explicit) {
    throw new Error(`Unknown AI_PROVIDER "${explicit}". Use "claude" or "openai".`);
  }
  if (env.ANTHROPIC_API_KEY) return "claude";
  return "openai";
}

/**
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {string}
 */
export function claudeModel(env = process.env) {
  return env.ANTHROPIC_MODEL || DEFAULT_CLAUDE_MODEL;
}

/**
 * Join text blocks and drop thinking or tool blocks.
 * @param {{ content?: { type?: string, text?: string }[] }} message
 * @returns {string}
 */
export function textFromClaudeMessage(message) {
  const blocks = Array.isArray(message?.content) ? message.content : [];
  return blocks
    .filter((block) => block && block.type === "text" && typeof block.text === "string")
    .map((block) => block.text)
    .join("")
    .trim();
}

/**
 * Call the official Anthropic SDK Messages API.
 * Temperature is omitted: Claude 4.7 and later reject a non-default temperature.
 *
 * @param {string} systemPrompt
 * @param {string|object} userPayload
 * @param {{ client?: { messages: { create: Function } }, model?: string, maxTokens?: number }} [opts]
 * @returns {Promise<string>}
 */
export async function completeWithClaude(systemPrompt, userPayload, opts = {}) {
  const client = opts.client ?? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const user = typeof userPayload === "string" ? userPayload : JSON.stringify(userPayload);
  const message = await client.messages.create({
    model: opts.model || claudeModel(),
    max_tokens: opts.maxTokens ?? 4096,
    system: systemPrompt,
    messages: [{ role: "user", content: user }],
  });
  const text = textFromClaudeMessage(message);
  if (!text) throw new Error("Claude response contained no text");
  return text;
}
