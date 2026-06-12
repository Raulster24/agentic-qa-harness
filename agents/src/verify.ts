import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

// The verify step writes its machine-readable JSON to this file (so it can be
// parsed) while also emitting the human-readable HTML report to
// playwright-report/. View the report with: npx playwright show-report
const JSON_OUTPUT = "test-results/pipeline-verify.json";

export interface SpecFailure {
  title: string;
  error: string;
}

export interface VerifyResult {
  passed: boolean;
  total: number;
  failed: number;
  failures: SpecFailure[];
}

// eslint-disable-next-line no-control-regex
const ANSI = /\[[0-9;]*m/g;

// Runs a single spec file through Playwright with the JSON reporter and returns
// a structured pass/fail summary. This is the executable feedback that lets the
// agent learn runtime truths it cannot see by reading the page once.
export function runSpec(specPath: string): Promise<VerifyResult> {
  return new Promise((resolve) => {
    const child = spawn("npx", ["playwright", "test", specPath, "--reporter=json,html"], {
      env: {
        ...process.env,
        FORCE_COLOR: "0",
        PLAYWRIGHT_JSON_OUTPUT_NAME: JSON_OUTPUT,
        PW_TEST_HTML_REPORT_OPEN: "never"
      },
      cwd: process.cwd()
    });

    let stderr = "";
    child.stdout.on("data", () => {}); // drain so the pipe never blocks
    child.stderr.on("data", (chunk) => (stderr += chunk));

    child.on("close", () => {
      try {
        const raw = existsSync(JSON_OUTPUT) ? readFileSync(JSON_OUTPUT, "utf-8") : "";
        const report = JSON.parse(raw);
        const failures: SpecFailure[] = [];
        const counts = { total: 0, failed: 0 };
        for (const suite of report.suites ?? []) walkSuite(suite, failures, counts);
        resolve({
          passed: counts.failed === 0 && counts.total > 0,
          total: counts.total,
          failed: counts.failed,
          failures
        });
      } catch {
        resolve({
          passed: false,
          total: 0,
          failed: 0,
          failures: [{ title: "test runner", error: stderr.slice(-2000) || "no output" }]
        });
      }
    });
  });
}

interface RawSuite {
  specs?: RawSpec[];
  suites?: RawSuite[];
}

interface RawSpec {
  title: string;
  ok: boolean;
  tests?: { results?: { error?: { message?: string }; errors?: { message?: string }[] }[] }[];
}

function walkSuite(suite: RawSuite, failures: SpecFailure[], counts: { total: number; failed: number }): void {
  for (const spec of suite.specs ?? []) {
    counts.total += 1;
    if (spec.ok) continue;
    counts.failed += 1;

    const messages: string[] = [];
    for (const test of spec.tests ?? []) {
      for (const result of test.results ?? []) {
        if (result.error?.message) messages.push(result.error.message);
        for (const error of result.errors ?? []) if (error.message) messages.push(error.message);
      }
    }
    failures.push({
      title: spec.title,
      error: messages.join("\n").replace(ANSI, "").slice(0, 1500) || "failed with no error message"
    });
  }
  for (const child of suite.suites ?? []) walkSuite(child, failures, counts);
}
