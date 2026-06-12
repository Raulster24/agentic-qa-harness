import { defineConfig, devices } from "@playwright/test";
import "dotenv/config";

export default defineConfig({
  testDir: "./tests",
  // The flows here complete in a few seconds; a tighter timeout surfaces a
  // wrong locator quickly, which keeps the agent's self-heal loop responsive.
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 4 : undefined,
  reporter: [["line"], ["html", { open: "never" }]],
  use: {
    baseURL: process.env.SUT_BASE_URL ?? "http://localhost:3333",
    trace: "retain-on-failure",
    screenshot: "only-on-failure"
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }]
});
