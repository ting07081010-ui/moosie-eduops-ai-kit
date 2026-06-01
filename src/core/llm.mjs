/**
 * LLM caller with structured output, schema validation, and retry logic.
 *
 * Flow:
 * 1. Call LLM with system prompt + user payload
 * 2. Parse response as JSON
 * 3. Validate against schema (if provided)
 * 4. If validation fails, retry with error feedback appended to prompt
 * 5. After max retries, throw with full diagnostic
 */

import { config } from "./config.mjs";

/**
 * Call the LLM with a system prompt and user payload.
 * Returns raw text output.
 *
 * @param {string} systemPrompt
 * @param {string|object} userPayload
 * @param {{ temperature?: number, maxRetries?: number }} opts
 * @returns {Promise<string>}
 */
export async function callLLM(systemPrompt, userPayload, opts = {}) {
  const { temperature = 0.2, maxRetries = 2 } = opts;
  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(`${config.openai.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.openai.apiKey}`,
        },
        body: JSON.stringify({
          model: config.openai.model,
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content:
                typeof userPayload === "string"
                  ? userPayload
                  : JSON.stringify(userPayload),
            },
          ],
          temperature,
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`LLM API error ${response.status}: ${text}`);
      }

      const data = await response.json();
      return data.choices[0].message.content.trim();
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
      }
    }
  }

  throw lastError;
}

/**
 * Call the LLM and parse the response as JSON.
 * Retries if JSON parsing fails.
 *
 * @param {string} systemPrompt
 * @param {string|object} userPayload
 * @param {{ temperature?: number, maxRetries?: number }} opts
 * @returns {Promise<object>}
 */
export async function callLLMJson(systemPrompt, userPayload, opts = {}) {
  const { maxRetries = 2 } = opts;
  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const raw = await callLLM(systemPrompt, userPayload, {
      ...opts,
      maxRetries: 0,
    });

    try {
      const parsed = extractJson(raw);
      return parsed;
    } catch (err) {
      lastError = new Error(
        `JSON parse failed (attempt ${attempt + 1}): ${err.message}\nRaw: ${raw.slice(0, 300)}`
      );
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, 500));
      }
    }
  }

  throw lastError;
}

/**
 * Call the LLM, parse JSON, and validate against a schema validator function.
 * If validation fails, retries with error feedback appended to the prompt.
 *
 * @param {string} systemPrompt - System prompt for the LLM
 * @param {string|object} userPayload - User message
 * @param {function} validatorFn - Function that returns { valid, errors, warnings }
 * @param {{ temperature?: number, maxRetries?: number }} opts
 * @returns {Promise<{ data: object, warnings: string[] }>}
 */
export async function callLLMJsonValidated(systemPrompt, userPayload, validatorFn, opts = {}) {
  const { maxRetries = 3 } = opts;
  let lastError;
  let lastRaw = "";
  let accumulatedFeedback = "";

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    // On retry, append validation errors to the prompt
    const userMessage = accumulatedFeedback
      ? `${typeof userPayload === "string" ? userPayload : JSON.stringify(userPayload)}\n\n⚠️ PREVIOUS ATTEMPT FAILED — FIX THESE ISSUES:\n${accumulatedFeedback}\n\nReturn ONLY valid JSON. No markdown, no explanation.`
      : userPayload;

    const raw = await callLLM(systemPrompt, userMessage, {
      ...opts,
      maxRetries: 0,
    });
    lastRaw = raw;

    try {
      const parsed = extractJson(raw);

      // Validate
      const validation = validatorFn(parsed);

      if (validation.valid) {
        return { data: parsed, warnings: validation.warnings || [] };
      }

      // Validation failed — build feedback for retry
      accumulatedFeedback = validation.errors.join("\n");
      lastError = new Error(
        `Schema validation failed (attempt ${attempt + 1}):\n${validation.errors.join("\n")}`
      );
    } catch (err) {
      accumulatedFeedback = `JSON parse error: ${err.message}`;
      lastError = new Error(
        `JSON parse failed (attempt ${attempt + 1}): ${err.message}`
      );
    }

    if (attempt < maxRetries) {
      await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
    }
  }

  // All retries exhausted
  throw new Error(
    `LLM output validation failed after ${maxRetries + 1} attempts.\n` +
    `Last error: ${lastError?.message}\n` +
    `Last raw output: ${lastRaw.slice(0, 500)}`
  );
}

/**
 * Extract JSON from LLM output.
 * Handles: raw JSON, markdown code blocks, text with embedded JSON.
 *
 * @param {string} raw - Raw LLM output
 * @returns {object} Parsed JSON
 * @throws {Error} If no valid JSON found
 */
function extractJson(raw) {
  const trimmed = raw.trim();

  // Try 1: Direct parse
  try {
    return JSON.parse(trimmed);
  } catch {
    // continue
  }

  // Try 2: Extract from markdown code block
  const codeBlockMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    try {
      return JSON.parse(codeBlockMatch[1].trim());
    } catch {
      // continue
    }
  }

  // Try 3: Find first { ... } or [ ... ]
  const jsonMatch = trimmed.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[1]);
    } catch {
      // continue
    }
  }

  throw new Error("No valid JSON found in LLM output");
}
