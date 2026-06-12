import OpenAI, { AzureOpenAI } from "openai";
import { config } from "./config.js";

// maxRetries: agent sessions hit per-minute token limits in normal operation;
// 429s are pacing signals, not failures. The SDK honors retry-after.
const MAX_RETRIES = 8;

export function createLlmClient(): OpenAI {
  if (config.llm.provider === "azure") {
    return new AzureOpenAI({
      endpoint: config.llm.endpoint,
      apiKey: config.llm.apiKey,
      apiVersion: config.llm.apiVersion,
      deployment: config.llm.model,
      maxRetries: MAX_RETRIES
    });
  }
  return new OpenAI({ apiKey: config.llm.apiKey, maxRetries: MAX_RETRIES });
}
