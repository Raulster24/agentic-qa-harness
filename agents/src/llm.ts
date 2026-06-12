import Anthropic from "@anthropic-ai/sdk";
import { config } from "./config.js";

// maxRetries: agentic loops can brush per-minute limits in normal operation.
// The SDK retries 429 and 5xx with exponential backoff, honoring retry-after.
const MAX_RETRIES = 8;

export function createLlmClient(): Anthropic {
  return new Anthropic({ apiKey: config.anthropic.apiKey, maxRetries: MAX_RETRIES });
}
