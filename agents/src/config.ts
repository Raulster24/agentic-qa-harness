import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing required environment variable: ${name} (copy .env.example to .env and fill it in)`);
    process.exit(1);
  }
  return value;
}

export const config = {
  anthropic: {
    apiKey: required("ANTHROPIC_API_KEY"),
    // Default to the most capable model. Set ANTHROPIC_MODEL=claude-sonnet-4-6
    // for a faster, lower-cost run of this high-volume agentic loop.
    model: process.env.ANTHROPIC_MODEL ?? "claude-opus-4-8"
  },
  sutBaseUrl: process.env.SUT_BASE_URL ?? "http://localhost:3333",
  headless: process.env.HEADLESS !== "0",
  maxTurns: Number(process.env.MAX_AGENT_TURNS ?? 60)
};
