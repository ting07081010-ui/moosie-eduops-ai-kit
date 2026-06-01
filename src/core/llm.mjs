/**
 * LLM caller with structured output support and retry logic.
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
  const { temperature = 0.3, maxRetries = 2 } = opts;
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
        // Exponential backoff: 1s, 2s
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
      }
    }
  }

  throw lastError;
}

/**
 * Call the LLM and parse the response as JSON.
 * Retries once if JSON parsing fails.
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
      maxRetries: 0, // don't retry inside callLLM, we handle retries here
    });

    try {
      // Extract JSON from output (may be wrapped in markdown code block)
      const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, raw];
      return JSON.parse(jsonMatch[1].trim());
    } catch (err) {
      lastError = new Error(`JSON parse failed (attempt ${attempt + 1}): ${err.message}\nRaw: ${raw.slice(0, 200)}`);
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, 500));
      }
    }
  }

  throw lastError;
}
