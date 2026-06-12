// Cheap connectivity check: verifies the Anthropic key and model id work
// before spending a long agent run. Run with: npm run smoke:llm
import { config } from "./config.js";
import { createLlmClient } from "./llm.js";

const llm = createLlmClient();
const response = await llm.messages.create({
  model: config.anthropic.model,
  max_tokens: 64,
  messages: [{ role: "user", content: "Reply with exactly: pipeline ready" }]
});

const text = response.content.find((b) => b.type === "text");
console.log(`model: ${config.anthropic.model}`);
console.log(`reply: ${text && text.type === "text" ? text.text : "(no text)"}`);
console.log(`usage: in=${response.usage.input_tokens} out=${response.usage.output_tokens}`);
process.exit(0);
