import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing required environment variable: ${name} (copy .env.example to .env and fill it in)`);
    process.exit(1);
  }
  return value;
}

// Azure OpenAI when an endpoint is configured (target deployment environment),
// otherwise plain OpenAI (local development). Same chat-completions surface.
const useAzure = Boolean(process.env.AZURE_OPENAI_ENDPOINT);

export const config = {
  llm: useAzure
    ? {
        provider: "azure" as const,
        endpoint: required("AZURE_OPENAI_ENDPOINT"),
        apiKey: required("AZURE_OPENAI_API_KEY"),
        model: required("AZURE_OPENAI_DEPLOYMENT"),
        apiVersion: process.env.AZURE_OPENAI_API_VERSION ?? "2024-10-21"
      }
    : {
        provider: "openai" as const,
        apiKey: required("OPENAI_API_KEY"),
        model: process.env.OPENAI_MODEL ?? "gpt-4.1"
      },
  sutBaseUrl: process.env.SUT_BASE_URL ?? "http://localhost:3333",
  headless: process.env.HEADLESS !== "0",
  maxTurns: Number(process.env.MAX_AGENT_TURNS ?? 40)
};
